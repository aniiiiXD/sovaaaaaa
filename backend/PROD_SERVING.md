# Sova production serving

Real production infra for serving open models (Qwen, GLM) as an API.
Cloud-portable: AWS now (Bedrock later if a lane demands it), the artifact
and the OpenAI-shaped contract never change.

## Layout

```text
backend/
├── infra/          Terraform: VPC, GPU ASG (spot + rebalance), ALB, EBS,
│                   IAM, budget alarm, health alarm. One apply, one destroy.
├── serve/          Dockerfile + entrypoint wrapping the pinned vLLM server
│                   (one model per GPU box; scale per model by adding boxes)
└── ops/            deploy.sh · teardown.sh · keys.py · margin.py
```

The website (`website/src/lib/vllm.ts`) is the gateway: OpenAI-shaped
`/api/v1/chat/completions`, per-key auth (`sk-sova-...`, fingerprint match),
token metering into Vercel log drains. `ops/margin.py` consumes the drain.

## Model sizing (first box)

| Model | bf16 | fits g5.2xlarge (A10G 24GB) |
|---|---|---|
| Qwen3-4B | ~8GB | yes, plenty of KV cache |
| Qwen3-8B | ~16GB | yes (default) |
| GLM-4-9B | ~18GB | yes, tight |
| GLM-4.5-Air (106B MoE) | 200GB+ | no — H100 class, out of budget |

## Money mechanics

- Always-on on-demand: ~$950/mo · spot with rebalance: ~$350/mo (default)
- Revenue: per-token, $0.05–0.15/M in, $0.20–0.50/M out for this class
- Utilization is the business: batching turns the same $1.20/hr into ~10x tokens
- Customer commits (minimum monthly per key) kill the idle-risk
- Break-even at blended $0.30/M output: ~1B tokens/mo on spot, ~2.7B on-demand

## Approval gates (compute policy)

1. `deploy.sh` plan shows the GPU box — apply starts the meter
2. First validation invocations — cents, but real
3. Public cutover + keys issued — ongoing spend begins, daily cap set

## Runbook

```bash
# up (starts paying)
backend/ops/deploy.sh

# smoke
curl http://<alb-dns>/v1/models

# the real speed table (tok/s, TTFT, p95 per concurrency level)
python3 backend/ops/bench.py --url http://<alb-dns> --model qwen3-4b

# keys
python3 backend/ops/keys.py mint --label acme

# teardown (the kill switch)
backend/ops/teardown.sh

# margin
vercel logs <project> --json | ... > usage.jsonl
python3 backend/ops/margin.py usage.jsonl --instance-cost 350
```

## Cloud-portability notes

- The vLLM box is replaceable by Azure (AI Foundry / AKS + vLLM) with the same
  merged weights and the same gateway contract; only `serving-config.ts` gains
  a backend
- NVIDIA Inception lane: same artifact under TensorRT-LLM/NIM when credits land

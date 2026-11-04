# HANDOFF — Sova serving launch (for the next agent)

Date: 2026-11-04. Everything below is current and verified unless marked otherwise.

## State

- **Done, committed** (`main`, `dadfd66` + earlier): full serving stack code lives in `backend/`
  - `infra/` Terraform: VPC, ALB, spot GPU ASG (g5.2xlarge, capacity rebalance), DL AMI via SSM,
    pinned vLLM `v0.11.0` + Qwen3-4B `1cfa9a7`, budget alarm ($50 → aniruddh302004@gmail.com),
    unhealthy-host alarm, SSM-only instance access
  - `serve/` Dockerfile + entrypoint (locked defaults)
  - `ops/` deploy.sh (interactive yes-gate) · teardown.sh (kill switch) · keys.py · margin.py · bench.py
  - `website/src/lib/`: `vllm.ts` backend, `api-auth.ts` (sk-sova- fingerprint auth),
    `usage-meter.ts` (JSONL → Vercel log drain); wired into both `/api/v1/*` routes; tsc clean
  - `PROD_SERVING.md` = architecture + money mechanics + runbook
- **Local machine:** terraform v1.17.1 at `~/.local/bin/terraform`; AWS creds active for profile
  `passkarwado` (IAM user PassKarwado, account 169970912263)
- **Nothing deployed. $0 spent. No resources created** (all deploys failed at plan phase).

## The single blocker

`PassKarwado` has no EC2/IAM/autoscaling/ELB/budgets permissions (S3, Bedrock, CloudWatch-read
only). Terraform plan fails at `ec2:DescribeAvailabilityZones`.

**Unblock (account owner, admin console):**
IAM → Users → PassKarwado → Add permissions → Create policy (JSON) → paste
`backend/infra/deploy-policy.json` → name `SovaServingDeploy` → attach.
(Alternative: dedicated `sova-deploy` user with the same policy, then
`aws configure --profile sova-deploy` and use `AWS_PROFILE=sova-deploy` everywhere.)

## Launch runbook (after perms land)

```bash
cd /Users/anixd/Documents/Sova/HeavyWork/backend/infra
export AWS_PROFILE=passkarwado          # or sova-deploy
terraform init && terraform plan        # expect: 15-18 resources to add
echo yes | ../ops/deploy.sh             # the "yes" IS the spend gate (~$0.40/hr spot)
terraform output alb_dns_name           # e.g. sova-serving-alb-123.us-east-2.elb.amazonaws.com
curl http://<alb>/v1/models             # wait for ASG healthy first (3-6 min: boot + 8GB pull)
python3 ../ops/bench.py --url http://<alb> --model qwen3-4b    # THE real tok/s table
```

Then wire the gateway (Vercel project = `website/`):
```bash
vercel env add SOVA_VLLM_BASE_URL       # http://<alb>
vercel env add SOVA_VLLM_MODEL          # qwen3-4b
python3 ../ops/keys.py mint --label first-customer   # plaintext shown once; fingerprint → SOVA_API_KEY_HASHES
# end-to-end: POST /api/v1/chat/completions on the deployed site with Bearer sk-sova-...
```

Kill switch anytime: `backend/ops/teardown.sh` (destroys everything, verified clean).

## Expected numbers (measure, don't trust)

Qwen3-4B on A10G bf16: single stream ~60-80 tok/s; batched 32-64 concurrent ~3-4k tok/s;
TTFT ~80-150ms p50. bench.py replaces these with real values.

## Gotchas already burned through (don't re-hit)

1. `user_data.sh.tftpl`: shell vars need `$${...}` escaping for templatefile (REVISION_FLAG fixed)
2. `capacity_rebalance` belongs on the ASG top level, NOT inside instances_distribution (provider 5.x)
3. AMI comes from public SSM param
   `/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-22.04/latest/ami-id` —
   if that path moves, swap the data source
4. us-east-2 chosen for g5 spot capacity; profile default region (us-east-1) is overridden by tfvars
5. Orca sets `XDG_CONFIG_HOME` → OpenCode CLI config actually lives in
   `~/.hyde-opencode/config/opencode/cli.json` (not `~/.config/opencode/`)
6. bench.py needs the endpoint warm; it self-warms once before measuring

## Gates / policy

- Every spend step needs explicit human approval (deploy.sh enforces a yes-prompt)
- Budget alarm fires at 80% of $50/mo; teardown.sh must always work — never deploy without it
- Post-launch hardening backlog: ACM cert + HTTPS on ALB (needs domain), GLM-4-9B as second
  box, scale-to-zero, DynamoDB-backed key store (currently fingerprints live in Vercel env)

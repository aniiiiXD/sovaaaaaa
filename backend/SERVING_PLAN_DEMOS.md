# Serving plan — the three demos

Date: 2026-10-29. Design only; every paid launch follows ask-before-compute
(exact command, machine, duration, cost, approval — one session at a time).

## Reality check vs the playbook

| Playbook assumption | Actual (as of 2026-10-29) |
|---|---|
| "Fireworks baseline works" | **Blocked**: account `anixd` fails validation, `payment method is required`. Fix billing or skip |
| "Launch EC2 g5.xlarge" | **Blocked**: EC2 G-family quota is 0 in Mumbai, Virginia, Ohio, Oregon; the IAM user cannot inspect EC2 |
| GPU needed for everything | No: the 14B specialist is **already live** on Bedrock; the M5 runs MLX locally for dev |
| Baseline must be Fireworks | Bedrock frontier baseline is already wired in `/api/demo/run` |

## Model × demo matrix

| Role | Model | Served via | Status |
|---|---|---|---|
| Arena baseline (frontier) | `BEDROCK_DEMO_BASELINE_ID` | Bedrock on-demand | **wired, live** |
| Extract + arena specialist | Fin-o1-14B (imported) | Bedrock custom model import, `sova-native.vercel.app` | **LIVE 2026-10-24** (~$0.57 per active 5-min CMU window, $3.90/mo storage) |
| Small LoRA specialist (extract demo v2) | Qwen2.5-1.5B-Instruct + LoRA | see options below | not started |
| Private demo | specialist of the day | see `AIRGAP_RUNBOOK.md` | design |

## The small specialist: serving options, in order

1. **SageMaker endpoint, Mumbai** (working route per `aws/README.md`):
   registered vLLM image pattern already exists for the 14B; a 1.5B fits a
   cheaper instance (check `ml.g5.xlarge` quota; the granted one is
   `ml.g6e.2xlarge`). Cost ~$1-3.4/hr while up; model-network-isolation is
   default-on. Zero new infrastructure concepts.
2. **M5 local (MLX)** for all development and even a live demo: the triage
   LoRA was trained and evaluated this way. $0. Use for prompt iteration;
   don't confuse its latency numbers with GPU serving numbers.
3. **EC2 g5 + vLLM** (the playbook's path): only after a quota increase
   request. Do the request early if we want this path at all.
4. **Fireworks serverless/SFT**: fastest path to a *trained* small
   specialist (`Lab/arena/fw_train.sh` exists, gates written) — but blocked
   on billing. Fix billing and this becomes option 1 for training.

## Lifecycle and cost discipline (non-negotiable)

- One paid session at a time; 60-minute first sessions; teardown at end and
  on failure, independent of client disconnects (pattern: `serving/aws/session.py`)
- SageMaker endpoints deleted after eval; the Bedrock import (storage) is
  the only always-on cost by choice
- Billing alarm at $50 before any GPU launch
- Every session logs: machine, window, instance-seconds, tokens, cost —
  into `Lab/<demo>/reports/`

## Execution order (maps to the 10-item checklist)

1. **Tonight, $0:** fix-or-skip Fireworks billing; request EC2 G quota (if
   path 3 wanted); assemble 30-50 sample invoices with ground truth
2. **$0:** `/api/v1/extract` against the **live 14B** — this alone makes
   Demo 1 real before any GPU exists
3. **$0:** arena harness re-run: Bedrock 14B vs frontier baseline on the
   invoice suite; commit results; build `/arena` page from scoreboard JSON
4. **First paid session (approval gate):** small specialist — train via
   Fireworks (if billing fixed) or SageMaker/MLX-LoRA; eval; compare
5. **Second paid session:** private/isolated serving per airgap runbook
6. Wire `/extract`, `/arena`, `/private` pages; publish cached results

Steps 1-3 are the playbook's "tonight" promise, adjusted to reality:
no GPU, no new services, one live backend.

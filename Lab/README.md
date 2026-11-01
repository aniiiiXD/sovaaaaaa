# Lab

All ML work: models, training kernels, eval harnesses, datasets, adapters.
Two self-contained experiment labs and the modular Rig. Nothing imports across
these folders; Rig orchestrates its own workflow → data → train → eval → serve loop.

```
Lab/
├── triage/   Banking77 specialist (done)  → numbers on the website
├── arena/    FinQA benchmark (active)     → /arena scoreboard JSON
└── rig/      Customer workflow lifecycle (written; not executed)
```

## `triage/` — first real specialist (done)

Banking77 intent triage: Qwen3-0.6B + LoRA trained on the M5 (MLX).
Accuracy, P50 TTFT, P50 throughput, estimated cost — these are the measured
numbers that replaced the site's illustrative table. See `triage/README.md`
(runbook) and `triage/reports/REPORT.md` (results).

## `arena/` — live benchmark (active)

FinQA: Base Qwen vs SOVA specialist vs Fino1-8B vs frontier, scored on
200 held-out questions. Trained and served via Fireworks (`fw_train.sh`,
`fw_deploy.sh`); `build_scoreboard.py` writes the static JSON rendered by
the website's `/arena` page. Plan and gates: `arena/PLAN.md`; serving
design: `arena/SERVING_PLAN.md`. The eval harness reuses the pattern proven
in `triage/eval.py` (deliberately copied, not imported — labs stay decoupled).

## `rig/` — Sova's customer workflow loop

Named workflows, versioned data, incumbent baselines, SFT, evaluation, optimization,
explicit release audits, local serving and reviewed production-feedback cycles.
The current backend is MLX; RL and NVIDIA execution are extension work. No Rig
training, serving or tests have been run. Start with [the workflow guide](rig/docs/WORKFLOW.md).

## Conventions

- Each lab owns its `.venv` (created by `uv run`). The two venvs are the
  same install; consolidating them is possible but not worth the risk yet.
- Datasets live in `<lab>/data/`, run outputs in `<lab>/reports/`,
  LoRA checkpoints in `<lab>/adapters/`. Nothing writes outside its lab
  (exception: `arena/build_scoreboard.py` writes its JSON into the website).
- Honesty rules inherited from triage apply everywhere: test sets are never
  trained on, per-case CSVs are kept, cost estimates are labeled as estimates.

## Sibling folders (outside this repo)

- `../backend/` — AWS/Bedrock serving configs used by these labs
- `../Research/` — research notes and site previews
- `../website/` — the site that renders this lab's numbers

# Sova Rig

A modular Python lab for **data → post-training → evaluation → iteration → performance engineering → serving**.

**Delivery status:** source, API contracts, examples and tests have been written. Nothing has been installed, executed, trained, benchmarked, downloaded or deployed. Tests have not been run. Existing `arena/.venv` and `triage/.venv` have not been changed.

## Implemented path

1. Import an immutable, explicitly split dataset.
2. Register a base model at a pinned Hugging Face commit.
3. Queue individual stages or an entire pipeline.
4. The separately launched worker measures a baseline, trains an MLX LoRA adapter, and evaluates it.
5. Failed validation examples inform new human-authored training examples. An iteration creates a new dataset version while preserving existing holdouts.
6. Fuse the adapter or fuse and quantize to 4/8 bits. Re-evaluate against a freshly measured baseline and reject excessive quality/latency regressions.
7. Explicitly promote a passing report to a named deployment.
8. Serve non-streaming chat completions. Collect feedback and explicitly import reviewed corrections into the next dataset.

No API submission automatically launches a worker. Model downloads and execution default to **off**. There is no automatically repeating training loop and no automatic production promotion.

## Layout

```text
rig/
├── src/rig/
│   ├── api/             App factory, auth, request boundary, resource routers
│   ├── domain/          Pydantic contracts and provider interfaces
│   ├── data/            Immutable datasets, split registry, feedback import
│   ├── training/        Candidate lineage, LoRA orchestration, manifests
│   ├── evaluation/      Exact/numeric scoring, per-case results, quality/cost gates
│   ├── optimization/    Fusion/quantization orchestration and regression checks
│   ├── pipeline/        Full workflow and iterative dataset versions
│   ├── serving/         Deployment aliases, inference traces, feedback
│   ├── backends/        MLX implementation and cancellable subprocess runner
│   ├── jobs/            Persistent queue, cancellation, worker, stage events
│   ├── storage/         SQLite repository, artifacts, cross-process locks
│   ├── container.py     Dependency composition; replace providers here
│   ├── config.py        Environment settings
│   └── cli.py           Separate API and worker entry points
├── tests/               Isolated behavior tests using a test-only backend
├── examples/            Dataset and REST request examples
└── docs/                API, architecture, operations and extension guides
```

Read [the API guide](docs/API.md), [architecture](docs/ARCHITECTURE.md), and [operations](docs/OPERATIONS.md). Configuration is documented in [.env.example](.env.example); it is not loaded automatically.

## API shape

| Resource | Main operations |
|---|---|
| `/api/v1/datasets` | Create, version, inspect, export, import reviewed feedback |
| `/api/v1/candidates` | Register pinned base models, inspect lineage and manifests |
| `/api/v1/training` | Queue LoRA training |
| `/api/v1/evaluations` | Queue evaluation, inspect reports, download per-case evidence |
| `/api/v1/optimizations` | Queue fusion/quantization and mandatory comparison |
| `/api/v1/pipelines` | Queue the complete baseline → train → eval → optimize workflow |
| `/api/v1/iterations` | Append training examples to a versioned dataset and queue another pipeline |
| `/api/v1/jobs` | Inspect state, cancel, retrieve events/logs/artifacts |
| `/api/v1/deployments` | Promote, inspect history, roll back by re-promoting an older passing report |
| `/api/v1/feedback`, `/api/v1/traces` | Record corrections and inspect serving evidence |
| `/v1/models`, `/v1/chat/completions` | OpenAI-shaped model listing and non-streaming text chat |

All resource routes require a bearer token. `/health`, `/docs`, and `/openapi.json` expose health/schema only. FastAPI builds the live OpenAPI schema when the app is started; no server was started for this delivery.

## Intended environment

Python 3.12+, Apple Silicon, and `mlx-lm==0.32.2` for real execution. This matches the MLX-LM version found in the existing Lab environments. The API dependency declarations are in `pyproject.toml`; their presence in your environment has **not** been assumed. No lockfile was generated because dependency resolution/install commands were not run.

Use the existing environment when execution is authorized. The [operations guide](docs/OPERATIONS.md) contains future-use commands, not a record of commands executed.

## Deliberate boundaries

- This is a single-owner, single-host lab implementation, not a multi-tenant hosted platform.
- MLX LoRA, adapter fusion, quantization and local MLX generation are implemented. DPO, remote GPU schedulers, vLLM, custom kernels and distributed training are extension points, not claimed integrations.
- Serving implements text-only, non-streaming chat with serialized GPU access. It loads/unloads the model per request; persistent model pools and batching belong in a dedicated serving backend.
- Numeric evaluation requires a bare numeric answer. Exact-match tasks use exact or normalized exact scoring. There is no unvalidated LLM judge.
- Measured latency and estimated cost are different fields. An hourly-rate estimate is not a cloud bill or profit prediction.
- Holdout protection detects normalized duplicate prompts, not semantic paraphrases or every possible form of contamination.

## Implementation references

The router organization follows [FastAPI's multiple-file application pattern](https://fastapi.tiangolo.com/tutorial/bigger-applications/). The MLX adapter follows [MLX-LM's LoRA/fusion documentation](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md) and the installed 0.32.2 source interfaces. Compatibility still needs runtime validation before use.

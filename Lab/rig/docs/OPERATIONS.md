# Operations — for later, not executed

## Current state

Only source files have been written. No package installs, environment changes, model downloads, Python imports, test runs, training, inference, database creation or service startup were performed. Python dependency compatibility and real MLX execution remain unverified.

Two existing Lab environments were found:

- `../arena/.venv` — Python 3.12.13, MLX 0.32.4, MLX-LM 0.32.2.
- `../triage/.venv` — Python 3.12.13; the Lab README describes the environments as equivalent.

Reuse an existing environment. The package declares API dependencies separately from the optional `mlx` and `dev` extras. Package declarations are not evidence that the environment already contains them. Do not reinstall MLX merely to start the API when the existing MLX environment is already suitable.

## Future startup

When you choose to execute, install the package into your selected existing environment if its dependencies are available/approved. These are reference commands only:

```sh
cd /Users/anixd/Documents/Sova/HeavyWork/Lab/rig
../arena/.venv/bin/python -m pip install -e '.[dev]'
```

If that environment does not have pip, use your normal environment package manager targeting this same environment; no new environment is required. The `mlx` extra is available for a fresh compatible execution environment, but was not installed here.

Configure the process through environment variables (or a process manager's env settings):

```sh
export RIG_HOME=/Users/anixd/Documents/Sova/HeavyWork/Lab/rig/.rig
export RIG_API_TOKEN='<your-generated-private-token>'
export RIG_EXECUTION_ENABLED=false
export RIG_ALLOW_DOWNLOADS=false
export RIG_STORE_CONTENT=false
../arena/.venv/bin/python -m rig api
```

The API defaults to `127.0.0.1:8787`. With execution off you can register metadata, import datasets and queue jobs. It cannot run inference. The worker refuses to start with execution off. Nothing auto-loads `.env`; `.env.example` is a configuration template only.

To execute intentionally later, both the worker and inference-serving API process need `RIG_EXECUTION_ENABLED=true` in their own environments. A running API does not observe shell environment changes; restart it to change settings. Start the worker separately:

```sh
RIG_EXECUTION_ENABLED=true ../arena/.venv/bin/python -m rig worker
```

Use `worker --once` to handle at most one queued job. Without cached model snapshots, downloads must separately be enabled with `RIG_ALLOW_DOWNLOADS=true`. Use the actual pinned revision chosen when registering the model. No credentials are stored in request payloads or candidate records; Hugging Face authentication follows its normal environment/cache mechanism.

`RIG_MLX_PYTHON` controls the Python subprocess used for MLX train/fuse/convert and defaults to Rig's own interpreter. In-process evaluation and serving always use Rig's interpreter; selecting a different subprocess interpreter does not add MLX to the API/worker environment. Keep their MLX versions aligned.

## Future verification

Tests use a fake provider exclusively under `tests/`; they should require neither model weights nor GPU execution. Reference command, not executed:

```sh
../arena/.venv/bin/python -m pytest
```

The authored suite covers split leakage across versions, duplicate detection, dataset integrity, path confinement, numeric scoring, missing-cost gates, baseline/train/optimize flow, optimization regression fallback, iteration holdout preservation, cancellation races, interrupted jobs, auth, body limits, disabled execution, content-retention behavior and explicit streaming rejection.

After offline tests, real integration verification still needs a small compatible model, a pinned revision, a tiny reviewed dataset and an explicitly authorized MLX job. Check the tokenizer chat template, LoRA target layers, memory fit, output checkpoints, and before/after evaluation. Training may truncate long sequences at the configured MLX `max_seq_length`; inspect your task lengths before choosing it. Inference rejects over-limit input rather than truncating it.

## Recovery and storage

- Graceful worker stop signals cancel work and terminate child processes. Completed artifacts remain for inspection.
- On restart, the exclusively locked worker marks interrupted running jobs failed/cancelled. It never automatically repeats costly training.
- A surviving MLX subprocess retains inherited locks if its parent is killed. Inspect the actual process before restarting/stopping it; don't delete lock files to bypass coordination.
- API inference and training share the device lock. Serving returns a busy error after the configured wait rather than running concurrently with training.
- Back up `rig.sqlite3` with SQLite's online backup mechanism, or stop writers and preserve its WAL files along with the database. Copying a live database file alone is not a consistent backup. Back up artifacts alongside metadata.
- There is no automated retention or garbage collection. Failed jobs can leave intermediate full-precision models, which may consume substantial disk space.
- Serving loads a model for each request and unloads it afterward to avoid retaining GPU memory across training jobs. Its evaluation latency numbers exclude this loading cost; serving traces include total service duration.

## Deployment boundary

This is local, single-owner infrastructure with a shared bearer token. It has no tenant isolation, billing, per-user roles, rate limiter, distributed scheduler, encrypted storage layer or horizontally scaled model workers. Keep the default loopback binding for the local lab. A public service should place a dedicated inference backend and appropriate operational controls in front of this workflow.

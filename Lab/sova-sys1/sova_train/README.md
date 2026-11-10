# SOVA legal decision LoRA experiment

This first experiment trains Qwen3-4B's attention query and value projections
using a rank-8 LoRA adapter. It uses the existing chat prompt and minimizes
cross-entropy over the same three next-token scores as the saved baseline. It
uses one pass over clean ContractNLI training examples that fit the configured
4,096-token context; over-limit examples are skipped and reported, never
truncated. Training uses batch size 1, accumulation 8, one epoch, AdamW and
the pinned pretrained checkpoint in `sova_model.scorer`.

The worker then scores the official development split with the adapter on the
same GPU family, base model precision, prompt and context limit as the existing
baseline. It verifies individual decision IDs, gold labels, context status and
token counts before reporting paired accuracy and class metrics. The official
test decisions and labels are not packaged or evaluated. Dev results are
research measurements, not a claim of customer readiness or calibrated
confidence. The experiment does not train an evidence retriever.

## Compute policy

The model training and development evaluation run together in one SageMaker
training job, not on the laptop. The job uses the existing AWS account and
S3 bucket, one `ml.g5.2xlarge`, a 50 GB worker volume and an eight-hour hard
runtime cap. At the previously observed $1.515/hour instance rate, the cap
is approximately $12.12 for instance compute; storage, transfer, taxes and
actual billing may differ. Runtime and memory are estimates until measured.
SageMaker terminates the worker after the job finishes or reaches its cap.
Adapter-only snapshots go to the job's S3 checkpoint prefix every 100
optimizer steps; they do not contain optimizer state and cannot resume the
same optimizer run. The job's model output contains the final adapter,
training manifest, development predictions and comparison.

The `ask-before-compute` skill calls for explicit per-run approval with the
command, machine, duration, estimated cost and output before tests or jobs.
Record any user authorization and do not silently start extra jobs.

From this project directory, the fixture tests use only the local CPU:

```sh
.venv/bin/python -B -m unittest discover -s tests -v
```

Submit the fixed job only when authorized:

```sh
.venv/bin/python -B -m sova_train.submit_sagemaker
```

The submitter records the input hashes and job name in `reports/`. After it
completes, the following read-only AWS collection command verifies the
predictions, paired comparison, and training provenance before saving the
adapter and reports locally:

```sh
.venv/bin/python -B -m sova_train.collect_sagemaker JOB_NAME
```

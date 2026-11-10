# Finance transfer evaluation

This is a zero-shot evaluation of the already-trained, distilled 370M legal
student on the **test** split of `anespo28/fincalc-nli`. It does not fine-tune
the model or change its original legal-contract input serialization. The
dataset is synthetic, so the result is a stress test rather than a measure of
performance on real financial reports or customer data.

The exact data revision and SHA-256, the student model's three file hashes,
and the existing student tokenizer are pinned in `dataset.py` and `config.py`.
FinCalc labels `0`, `1`, and `2` map to the legal model's `Contradiction`,
`Entailment`, and `NotMentioned`, respectively. The last mapping approximates
FinCalc's `neutral`; the datasets' annotation rules are not identical. The
4,000 examples have 1,853 / 1,512 / 635 rows in those respective classes, so
the majority-class baseline is 46.325%. The model never receives a gold label,
metric, or error category in its input. No ContractNLI test labels are loaded.

The worker reports coverage, accuracy including unscored inputs, per-class
precision/recall/F1, confusion matrix, majority baseline, accuracy by finance
metric and mistake type, warm in-process batch-one p50/p95 latency, GPU memory,
and per-row predictions and timings. It rejects overlong inputs instead of
truncating. Scores remain uncalibrated and the model produces no citations or
verified arithmetic. The test split must not be used to tune the model.

## Compute policy

The local `ask-before-compute` skill requires an explicit approval for each
test run and each cloud evaluation, with command, machine, duration, cost, and
output stated beforehand. The cloud evaluation is one SageMaker
`ml.g5.2xlarge` in `us-east-2`, with a 50 GB temporary volume and a 30-minute
maximum runtime. Using the previously observed $1.515/hour instance rate,
30 minutes is approximately $0.76 in instance compute; storage, network,
taxes, actual pricing, and SageMaker billing may differ. The training job is
used only to run inference and stops at completion or the runtime limit; no
endpoint remains running. The official AWS pricing API could not be queried by
the configured IAM identity, so this is not a live price quote.

From the project directory, after the applicable approvals:

```sh
.venv/bin/python -B -m unittest discover -s tests -p test_fincalc.py -v
.venv/bin/python -B -m sova_fincalc.submit_sagemaker --wait
.venv/bin/python -B -m sova_fincalc.collect_sagemaker JOB_NAME
```

`--prepare-only` on the submitter builds the exact bundle in a temporary
directory and prints the job request and hashes without contacting AWS.
The submitter uploads the small bundle and points the student channel at the
already-saved distilled model in S3. Model weights are not downloaded to the
Mac. `--wait` reports job state and runs the collector when it completes.
The collector checks every output row against the pinned dataset before writing
the report and predictions under `reports/JOB_NAME/`. If the local monitoring
process exits, the capped SageMaker job may continue; use its saved submission
receipt to find and collect it later.

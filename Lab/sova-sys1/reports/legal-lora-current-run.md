# SOVA Legal LoRA: current run

Job: `sova-legal-lora-20261109-061959-54ad8d` in AWS `us-east-2`.
SageMaker completed the job on 2026-11-09 at 16:25:37 Asia/Kolkata. The
adapter and evaluation artifacts were downloaded and independently checked.

| Measure | Result |
| --- | ---: |
| Baseline accuracy on scored dev examples | 543 / 901 = 60.3% |
| LoRA accuracy on the same scored dev examples | 775 / 901 = 86.0% |
| Accuracy improvement | 25.7 percentage points |
| LoRA accuracy counting unscored examples as wrong | 775 / 1,037 = 74.7% |
| Context coverage | 901 / 1,037 = 86.9% |
| Training examples used | 6,491 / 7,140 |

The 136 unscored dev decisions exceeded the configured context limit; no
contract was silently truncated. These results are from 61 development
contracts with 17 repeated statements. The official test decisions were not
used. Near-duplicate and pretraining exposure checks remain incomplete, and
the scores are not calibrated. This is a development benchmark, not a customer
production accuracy claim.

The job used one `ml.g5.2xlarge` and completed after 15,772 billable seconds.
Estimated instance compute is $6.64 at the previously observed $1.515/hour
rate; storage, transfer, taxes and actual billing may differ. The worker has
terminated. Adapter-only snapshots remain in the S3 checkpoint prefix recorded
in the submission receipt.

From the project directory, check its current status:

```sh
aws --profile passkarwado --region us-east-2 sagemaker describe-training-job --training-job-name sova-legal-lora-20261109-061959-54ad8d --query '{Status:TrainingJobStatus,Phase:SecondaryStatus,Failure:FailureReason,Start:TrainingStartTime,End:TrainingEndTime}' --output json
```

To collect and independently verify a completed job on another copy of the
project (the current copy has already been collected):

```sh
.venv/bin/python -B -m sova_train.collect_sagemaker sova-legal-lora-20261109-061959-54ad8d
```

The saved submission receipt records the input hashes, S3 artifact locations,
and exact compute configuration. Collected results and the adapter are in
`reports/sova-legal-lora-20261109-061959-54ad8d/`.

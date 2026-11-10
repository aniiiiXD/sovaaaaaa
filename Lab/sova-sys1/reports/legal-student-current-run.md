# SOVA attention-free student experiment

## Current attempt

Job: `sova-mamba-student-20261109-143156-2935f5` in AWS `us-east-2`.
Submitted with approval on 2026-11-09 at 20:02 IST and **completed** at
22:54 IST. Both students and their reports are saved in S3. The job used
10,290 billable seconds (2 hours 51 minutes 30 seconds), or approximately
$4.33 in instance compute at $1.515/hour; storage, transfer and taxes are
additional. The small result report was downloaded and its metrics independently
recomputed by the collector. The full model weights remain in S3.

| ContractNLI official development split | Labels only | Distilled |
| --- | ---: | ---: |
| Accuracy, 1,037 decisions across 61 contracts | 71.1% (737/1,037) | 71.3% (739/1,037) |
| Warm batch-one in-process latency, mean | 76.0 ms | 76.1 ms |
| Median latency | 64.2 ms | 64.5 ms |
| p95 latency | 122.1 ms | 122.0 ms |

On the 901 development decisions both models and the Qwen teacher scored,
both students achieved 70.4% accuracy and Qwen achieved 86.0%. Distillation
improved the student's overall development accuracy by 2 decisions, or 0.19
percentage points, over the labels-only control. The student scored all 1,037
development decisions; the teacher could not score 136 long-context decisions.

These are development results, not untouched test results. Latency is measured
on an A10G for warm single requests and excludes PDF parsing, HTTP, networking
and startup. The mean is below 100 ms; the overall p95 is above 100 ms. These
models output uncalibrated decision scores without evidence. The 12-hour cap
and original estimates are documented below. The job's full submission receipt
and collected comparison report are saved beside this report.

## Progress notifications

The per-user macOS LaunchAgent observed that the job completed and reported the
terminal status. Its last observed state is saved in
`sova-mamba-student-20261109-143156-2935f5-monitor.json` beside this report.

## Previous attempt

Job: `sova-mamba-student-20261109-140626-bc4386` in AWS `us-east-2`.
The job was submitted on 2026-11-09 and **failed** during its first teacher
checkpoint. Its code attempted to atomically rename a file from `/opt/ml` to
`/opt/ml/checkpoints`, which are separate mounts on this worker. No student
training started and no complete teacher chunk reached S3. The worker has
terminated. The checkpoint code was corrected to stage and rename the file in
the same directory. A 251-record CPU regression simulates the cross-device
error and confirms that the first chunk contains 250 records and the second
contains one; 74 selected CPU tests passed.

The preflight confirmed the 32-token SOVA forward matched the reference
Mamba-2 forward exactly, and a synthetic 8,192-token forward/backward plus
optimizer allocation completed. That synthetic step peaked at 6.44 GB of
PyTorch-allocated GPU memory. It is not a real-data accuracy or latency result.
The tokenizer saved by that job was also loaded locally: it encoded a sample,
rejected an over-limit input, and produced only filenames accepted by the
result collector. All of its token IDs fit the pinned model's embedding; the
pinned configuration has no attention layers. The new submission bundle was
checked for required sources and excludes the official test decision labels.

The updated worker will run, in order: a tiny S3 multipart-upload and read
check in both model prefixes; CUDA/reference parity and an 8,192-token memory
preflight; Qwen teacher scores on training records only; a labels-only
Mamba-2-370M student; a distilled student initialized identically; and
development accuracy, latency and memory comparisons. Each completed student
is uploaded to S3 as soon as its training epoch finishes. The official test
decision labels are excluded.

The new S3 check passed on the current AWS worker for both model prefixes. The
role has AmazonS3FullAccess attached and no permissions boundary, although this
IAM user is not allowed to simulate the role's effective permissions. The
check uses tiny temporary objects; a complete 1.5 GB student upload remains
untested.

The real-data student training, the two model uploads and the completed report
have not yet been exercised on AWS. Teacher chunks and completed student weights
can be retained in S3, but this script does not automatically resume a new run
from those chunks or restore an interrupted student's optimizer state. The
12-hour cap can end the job before both students finish.

The failed attempt used 596 billable seconds: estimated instance compute is
**$0.25**, based on the previously observed $1.515/hour. The original cap was
12 hours, or $18.18 estimated instance compute; the 80 GB temporary volume,
S3 storage, transfer, taxes and actual billing may differ. No endpoint is
deployed.

Check current status:

```sh
aws --profile passkarwado --region us-east-2 sagemaker describe-training-job --training-job-name sova-mamba-student-20261109-143156-2935f5 --query '{Status:TrainingJobStatus,Phase:SecondaryStatus,Failure:FailureReason,Start:TrainingStartTime,End:TrainingEndTime}' --output json
```

Only after a future job reports `Completed`, collect its own reports and
tokenizer with its actual job name. The failed job has no complete report:

```sh
.venv/bin/python -B -m sova_student.collect_sagemaker JOB_NAME
```

The submission receipt records input hashes, checkpoint and model locations.

# Attention-free legal decision students

This experiment implements SOVA's one-pass, three-choice legal decision model
over the pinned pretrained `state-spaces/mamba2-370m` backbone. The SOVA
forward path runs the pretrained Mamba-2 blocks and a new linear decision head;
there are no self-attention layers and no generated output tokens. The
checkpoint's native Mamba-2 implementation and fused CUDA kernels are used,
not a claim that SOVA independently invented those layers.

The worker first checks S3 multipart upload and read access with tiny temporary
objects under each model prefix, then attempts to delete them. It runs a CUDA
preflight that checks SOVA's forward path against the pinned reference backbone
and exercises an 8,192-token forward/backward plus Adam state allocation. The
initial AWS run passed the CUDA preflight but failed at the first teacher
checkpoint; that checkpoint path has since been corrected. The new S3 check is
covered by CPU fixtures and has not yet been exercised by an AWS worker.

The Qwen3-4B + LoRA teacher generates raw three-choice logits **only for the
clean ContractNLI training decisions**. It never receives gold labels. Inputs
over the teacher's 4,096-token limit are recorded as missing teacher targets,
not truncated. The teacher was itself trained on these same records, so its
in-sample logits may be overconfident or memorized. Immutable target chunks
are copied to the job's SageMaker checkpoint location, but a replacement job
does not automatically resume from chunks produced by an earlier job.

Two 370M students start from the same pinned weights, classifier-head seed,
input order and hyperparameters: one learns from gold labels; the other uses
gold-label cross-entropy plus temperature-scaled teacher KL divergence.
When a valid student example has no teacher score, the distilled student uses
the full gold-label loss. Both get one epoch, full-parameter AdamW, batch one,
gradient accumulation eight, 8,192 student-token limit, FP32 trainable
weights and FP16 CUDA autocast. Student examples beyond that limit are counted
and rejected. The different teacher and student tokenizers are never assumed
to produce the same token lengths.

Both students are evaluated on the official development decisions, with
accuracy/coverage, per-class metrics, p50/p95 latency, input-length buckets,
GPU memory and matched comparisons against each other and the saved Qwen
results. The 136 decisions that the Qwen benchmark could not score are
reported separately. Official test decision labels are never packaged or
loaded. Outputs are uncalibrated and do not include evidence retrieval.

The teacher targets and small reports are part of the output. Each trained
student is about 1.5 GB in FP32 and is uploaded to its own S3 prefix as soon
as its epoch finishes, with sizes and SHA-256 hashes. If the second stage
fails or times out, the first completed student remains in S3. These are model
weights, not resumable optimizer checkpoints. The output report includes the
tokenizer; weights are not automatically downloaded to the laptop.

## Compute policy

The `ask-before-compute` skill requires an explicit per-run approval with the
exact command, machine, duration, estimated cost and outputs. Synthetic CPU
fixtures may be run locally when authorized. The full experiment uses one
SageMaker `ml.g5.2xlarge` A10G and an 80 GB temporary volume in the existing
AWS account. The worker stops at completion or after a **12-hour** runtime
cap. At the previously observed $1.515/hour instance rate, capped compute is
approximately **$18.18**; volume, S3 storage, transfer, taxes and actual
billing can differ. This cap may still stop the job before both students
finish. Capacity wait time and GPU kernel compilation time are uncertain.

The earlier 2–6 hour estimate was for teacher scoring plus one student; this
job also trains a second control student and accepts longer inputs. A rough
working estimate is **4–10 hours after the GPU starts**, but the actual
Mamba-2 GPU time is not yet measured.

The optional HTTP service dependencies are listed in
`requirements-student-service.txt`; `requirements-student-test.txt` also
includes the HTTP test client. From the project directory, run the small CPU
fixtures when authorized:

```sh
PYTHONPATH=tests .venv/bin/python -B -m unittest test_student test_benchmark -v
```

Submit only after explicit approval:

```sh
.venv/bin/python -B -m sova_student.submit_sagemaker
```

After the job completes, download its small reports and tokenizer, and
independently verify the metrics:

```sh
.venv/bin/python -B -m sova_student.collect_sagemaker JOB_NAME
```

To download one model later (approximately 1.5 GB), choose a destination that
does not already exist:

```sh
.venv/bin/python -B -m sova_student.fetch_student reports/JOB_NAME distilled /path/to/new/student-directory
```

The offline runtime needs the collected tokenizer and a CUDA machine with the
pinned native Mamba dependencies. It does not contact Hugging Face:

```sh
.venv/bin/python -B -m sova_student.runtime /path/to/student-directory reports/JOB_NAME/tokenizer /path/to/contract.txt 'The statement to classify'
```

An optional HTTP demo can load the same saved student and tokenizer. It binds
to localhost by default and exposes `GET /health` and `POST /v1/decisions`;
the latter accepts `contract` and `statement` text and returns the three
uncalibrated scores. It returns HTTP 413 for over-limit inputs without
truncation, and does not invent evidence. Starting a model-serving process
requires the compute approval described above:

```sh
.venv/bin/python -B -m sova_student.service /path/to/student-directory reports/JOB_NAME/tokenizer
```

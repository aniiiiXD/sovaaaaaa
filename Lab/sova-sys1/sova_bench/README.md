# Legal decision performance benchmark

Measure the existing Qwen3-4B baseline and LoRA adapter on the same 1,037
ContractNLI development decisions, including the 136 inputs that exceed the
4,096-token limit. Those inputs are counted but not truncated or included in
latency percentiles. The official test decision labels are never packaged.

Each model is warmed up by input length, then run with batch size 1 on one
NVIDIA A10G. For every scored decision, record prompt construction and
tokenization time, CUDA-event GPU forward time, in-process wall time through
the returned scores, input length, and PyTorch peak allocated/reserved GPU
memory. Report p50/p95/mean by 512/1,024/2,048/4,096 token buckets and
overall, along with example and unique-document counts. The benchmark compares
predictions with the saved evaluation to expose unexpected deviations.

The measured wall time includes tokenization, device transfers, model inference,
score extraction and instrumentation. It does not include PDF parsing, HTTP,
network, service queuing, or model load. GPU allocator statistics do not count
the CUDA context or memory allocated outside PyTorch. The baseline runs before
the LoRA variant in one process; cached allocator reservations can carry over.
This is a warm microbenchmark, not an on-prem or customer SLA.

## Compute policy

The `ask-before-compute` skill requires explicit per-run approval, including
the exact command, machine, duration, estimated cost and outputs. Fixture tests
run on the laptop CPU; the full benchmark runs only in SageMaker on one
`ml.g5.2xlarge` with the existing S3 bucket and a **one-hour** hard runtime
cap. Based on the previous $1.515/hour instance rate, maximum
instance compute is about $1.52, with storage, network and taxes additional.
AWS stops the worker after completion or timeout; no serving endpoint remains.

From the project directory, validate the small synthetic fixtures on the CPU:

```sh
PYTHONPATH=tests .venv/bin/python -B -m unittest test_benchmark -v
```

When separately authorized, submit one job to compare both variants:

```sh
.venv/bin/python -B -m sova_bench.submit_sagemaker
```

After completion, collect the result and independently recompute its summaries:

```sh
.venv/bin/python -B -m sova_bench.collect_sagemaker JOB_NAME
```

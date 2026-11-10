# SOVA legal decision benchmark

Job: `sova-legal-bench-20261109-124257-582bda` in `us-east-2`. The job
completed on 2026-11-09. Its artifacts were collected and the summary was
independently recomputed from individual request records.

## Trained model results

Warm, batch-one, in-process timings on one NVIDIA A10G, from full extracted
contract text and prompt construction through CPU-visible decision scores:

| Input tokens | Decisions (contracts) | Median | p95 |
| --- | ---: | ---: | ---: |
| 513–1,024 | 68 (4) | 210 ms | 275 ms |
| 1,025–2,048 | 374 (22) | 445 ms | 562 ms |
| 2,049–4,096 | 459 (27) | 1,022 ms | 1,560 ms |
| All scored | 901 (53) | 739 ms | 1,501 ms |

No scored input was 512 tokens or fewer. Across the scored inputs, median
GPU forward was 720 ms and median prompt construction/tokenization was 18 ms.
The untuned baseline median and p95 were 704 ms and 1,449 ms, respectively,
on the same scored inputs. The baseline ran first; no randomized trial was
performed, so the difference is descriptive rather than a causal overhead
measurement. Predictions matched the saved reference run for both models.

The trained model's peak PyTorch allocated GPU memory was **11.58 GB**; its
peak allocator-reserved memory was **22.93 GB** on a GPU with 23.69 GB
reported capacity. Reserved memory reflects the caching allocator and can
carry over from the preceding baseline. Neither figure includes allocations
outside PyTorch, such as the CUDA context, and the two peaks need not occur at
the same time.

The 136 development decisions exceeding the 4,096-token input limit were
counted as rejected, not silently truncated or included in latency statistics.
These are model-function timings, not HTTP end-to-end measurements. PDF
parsing, networking, service queueing and model startup are excluded. The
examples reuse 61 contracts with repeated statements; the 901 scored
decisions come from 53 contracts. See the full JSON and individual rows in
`reports/sova-legal-bench-20261109-124257-582bda/`.

The job used one `ml.g5.2xlarge` A10G and ran for 1,528 billable seconds.
Estimated compute was **$0.64**, using the previously observed $1.515/hour;
actual billing, storage, transfer and taxes may differ. The worker has
terminated. See [benchmark details](../sova_bench/README.md) for metrics and
measurement boundaries.

Check status:

```sh
aws --profile passkarwado --region us-east-2 sagemaker describe-training-job --training-job-name sova-legal-bench-20261109-124257-582bda --query '{Status:TrainingJobStatus,Phase:SecondaryStatus,Failure:FailureReason,Start:TrainingStartTime,End:TrainingEndTime}' --output json
```

To collect and independently verify it on another copy of the project:

```sh
.venv/bin/python -B -m sova_bench.collect_sagemaker sova-legal-bench-20261109-124257-582bda
```

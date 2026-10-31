# Banking77 intent triage: base vs SOVA specialist

Base: `mlx-community/Qwen3-0.6B-bf16`  |  Tuned: `mlx-community/Qwen3-0.6B-bf16` + `adapters/triage`

| Metric | Base | Specialist |
| --- | --- | --- |
| Cases evaluated | 770 | 770 |
| Accuracy | 13.1% | 79.0% |
| P50 TTFT (ms) | 82.0 | 112.2 |
| P50 throughput (tok/s) | 87.5 | 81.5 |
| USD per 1k tasks | $0.75 | $0.14 |

Accuracy gain: **+65.8 pp**
# SOVA Labs / triage — first real specialist

Real dataset (Banking77, 77 banking intents), real model (Qwen3-0.6B), real LoRA
training on the M5, real evals: accuracy, P50 TTFT, P50 throughput, estimated cost.
This is what backs the numbers on the website.

## Tonight's runbook

```bash
cd /Users/anixd/Documents/Sova/HeavyWork/Lab/triage

# 1. Data (one-time, ~1 min)
uv run python prepare_data.py

# 2. Baseline eval of the raw base model (~15-25 min for 770 cases)
uv run python eval.py --model mlx-community/Qwen3-0.6B-bf16 \
  --limit 770 --out reports/base.json

# 3. Train the LoRA (~1-2 h overnight; checkpoints every 100 iters)
uv run python -m mlx_lm lora --train \
  --model mlx-community/Qwen3-0.6B-bf16 \
  --data data --mask-prompt \
  --iters 600 --batch-size 4 --learning-rate 1e-4 \
  --num-layers 16 --steps-per-eval 100 --save-every 100 \
  --adapter-path adapters/triage

# 4. Eval the specialist (~15-25 min)
uv run python eval.py --model mlx-community/Qwen3-0.6B-bf16 \
  --adapter adapters/triage --limit 770 --out reports/tuned.json

# 5. Report (markdown table: base vs specialist)
uv run python report.py reports/base.json reports/tuned.json
```

## Honesty rules

- The eval set (test.jsonl) is never trained on; train/valid/test are separate files.
- Per-case CSVs are kept for both runs; no aggregate-only claims.
- Cost is an *estimate* from measured GPU-seconds at $8/hr (one B200-hour) and is labeled as such everywhere.
- When these numbers replace the site's illustrative table, the footnote changes
  from "illustrative" to "measured on <date>, model card linked."

## Files

- `prepare_data.py` — Banking77 to prompt/completion JSONL
- `eval.py` — accuracy + P50 latency + tok/s + per-case CSV + summary JSON
- `report.py` — side-by-side markdown report
- `data/` train.jsonl / valid.jsonl / test.jsonl / labels.json
- `reports/` run summaries + per-case CSVs + REPORT.md
- `adapters/` LoRA checkpoints

"""Evaluate a model (optionally with a LoRA adapter) on the Banking77 test set.

Measures, per run: accuracy, P50 time-to-first-token, P50 throughput (tok/s),
and writes per-case results to CSV plus a summary JSON for the report step.

Usage:
  uv run python eval.py --model mlx-community/Qwen3-0.6B-bf16 \
      [--adapter adapters/triage] [--limit 770] \
      [--usd-per-gpu-hour 8] --out reports/base.json
"""
import argparse
import csv
import json
import random
import statistics
import time
from pathlib import Path

from mlx_lm import load
from mlx_lm.generate import stream_generate

ROOT = Path(__file__).parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", default=None)
    ap.add_argument("--limit", type=int, default=770, help="stratified cap, ~10 per intent")
    ap.add_argument("--usd-per-gpu-hour", type=float, default=8.0)
    ap.add_argument("--out", default="reports/run.json")
    args = ap.parse_args()

    labels = json.loads((ROOT / "data" / "labels.json").read_text())
    label_set = set(labels)
    cases = [json.loads(l) for l in (ROOT / "data" / "test.jsonl").read_text().splitlines()]

    # Stratified sample: keep the eval honest and the run time sane.
    random.seed(77)
    by_label: dict[str, list] = {}
    for c in cases:
        gold = c["completion"].strip()
        by_label.setdefault(gold, []).append(c)
    per = max(1, args.limit // len(by_label)) if args.limit else None
    sample: list[dict] = []
    for rows in by_label.values():
        random.shuffle(rows)
        sample.extend(rows[:per] if per else rows)
    random.shuffle(sample)

    model, tok = load(args.model, adapter_path=args.adapter)

    def chat_prompt(text: str) -> str:
        msgs = [{"role": "user", "content": text}]
        return tok.apply_chat_template(
            msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False
        )

    print(f"model={args.model} adapter={args.adapter or '-'} cases={len(sample)}")

    rows_out, correct, tps_all, ttft_all, gen_s_all = [], 0, [], [], []
    for i, c in enumerate(sample):
        gold = c["completion"].strip()
        t0 = time.perf_counter()
        first_t, n_tok = None, 0
        text = ""
        for chunk in stream_generate(model, tok, prompt=chat_prompt(c["prompt"]), max_tokens=32):
            if first_t is None:
                first_t = time.perf_counter()
            text += chunk.text
            n_tok += 1
            if n_tok >= 32:
                break
        t_end = time.perf_counter()

        # Lenient parse: the prediction is the first known label mentioned.
        pred = next((lab for lab in labels if lab in text), text.strip().split("\n")[0].strip())
        hit = pred == gold
        correct += hit

        gen_s = t_end - (first_t or t_end)
        tps = n_tok / gen_s if gen_s > 0 else 0.0
        ttft = (first_t or t_end) - t0
        tps_all.append(tps)
        ttft_all.append(ttft)
        gen_s_all.append(gen_s)

        rows_out.append({
            "gold": gold, "pred": pred, "hit": int(hit),
            "ttft_s": round(ttft, 4), "tok_per_s": round(tps, 2),
            "gen_s": round(gen_s, 4),
        })
        if (i + 1) % 50 == 0:
            print(f"[{i + 1}/{len(sample)}] acc so far {correct / (i + 1):.3f}")

    acc = correct / len(sample)
    p50 = lambda xs: statistics.median(xs)
    gpu_s_total = sum(gen_s_all)
    cost_per_1k = (gpu_s_total / len(sample) * 1000) / 3600 * args.usd_per_gpu_hour

    summary = {
        "model": args.model,
        "adapter": args.adapter,
        "n": len(sample),
        "accuracy": round(acc, 4),
        "p50_ttft_ms": round(p50(ttft_all) * 1000, 1),
        "p50_tok_per_s": round(p50(tps_all), 1),
        "usd_per_gpu_hour": args.usd_per_gpu_hour,
        "usd_per_1k_tasks": round(cost_per_1k, 4),
        "label": (args.adapter or "base").split("/")[-1],
    }
    out = Path(args.out)
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(summary, indent=1))
    csv_path = out.with_suffix(".csv")
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
        w.writeheader()
        w.writerows(rows_out)

    print(json.dumps(summary, indent=1))
    print(f"per-case CSV -> {csv_path}")


if __name__ == "__main__":
    main()

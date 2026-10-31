"""SOVA Arena runner: same questions, competing models, measured everything.

Columns:
  - base-qwen   : Qwen3-0.6B, no tuning (local MLX)
  - sova-qwen   : Qwen3-0.6B + SOVA LoRA adapter (local MLX)
  - frontier    : GPT-6.1-Sol / Claude Sonnet 5.5 (only if API keys are set)

Scores every answer against the computed ground truth (numeric, with tolerance).
Captures accuracy, hallucinated-figure rate, P50 TTFT, P50 latency, tokens, and
cost per 1k tasks. Writes summary JSON + per-case CSV.

Usage: uv run python run_arena.py [--limit 30] [--models base-qwen,sova-qwen,frontier]
"""
import argparse
import json
import os
import statistics
import time
import urllib.request
from pathlib import Path

from mlx_lm import load
from mlx_lm.generate import stream_generate

ROOT = Path(__file__).parent
BASE_MODEL = "mlx-community/Qwen3-0.6B-bf16"
ADAPTER = "adapters/fin"  # the financial specialist (trained in this folder)

SYSTEM = (
    "You are a careful financial analyst. Answer with the number and unit only, "
    "computed from the statement. One short sentence max."
)

FRONTIER_PRICES = {  # USD per 1M tokens, list
    "gpt-6.1-sol": {"in": 2.0, "out": 10.0},
    "claude-sonnet-5-5": {"in": 2.0, "out": 10.0},
}


def ask_local(model, tok, user_prompt: str, max_tokens: int = 128):
    msgs = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_prompt}]
    prompt = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    t0 = time.perf_counter()
    first_t, n_tok, text = None, 0, ""
    for chunk in stream_generate(model, tok, prompt=prompt, max_tokens=max_tokens):
        if first_t is None:
            first_t = time.perf_counter()
        text += chunk.text
        n_tok += 1
        if n_tok >= max_tokens:
            break
    end = time.perf_counter()
    ttft = (first_t or end) - t0
    tps = n_tok / (end - (first_t or end)) if end > (first_t or end) else 0.0
    return text.strip(), ttft, end - t0, n_tok, n_tok / (end - t0) if end > t0 else tps


def ask_frontier(model: str, user_prompt: str):
    msgs = f"{SYSTEM}\n\n{user_prompt}"
    key_header, url, body, key = None, None, None, None
    if "gpt" in model:
        key = os.environ.get("OPENAI_API_KEY")
        url = "https://api.openai.com/v1/chat/completions"
        body = {"model": model, "messages": [{"role": "user", "content": msgs}], "max_tokens": 256}
        key_header = ("Authorization", f"Bearer {key}")
    else:
        key = os.environ.get("ANTHROPIC_API_KEY")
        url = "https://api.anthropic.com/v1/messages"
        body = {"model": model, "max_tokens": 256, "system": SYSTEM,
                "messages": [{"role": "user", "content": user_prompt}]}
        key_header = ("x-api-key", key)
    payload = json.dumps(body).encode()
    req = urllib.request.Request(url, data=payload, method="POST",
                                 headers={"Content-Type": "application/json", key_header[0]: key_header[1],
                                          **({"anthropic-version": "2023-06-01"} if "claude" in model else {})})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    end = time.perf_counter()
    text = data["choices"][0]["message"]["content"] if "gpt" in model else data["content"][0]["text"]
    usage = data.get("usage", {})
    in_tok = usage.get("prompt_tokens", usage.get("input_tokens", 0))
    out_tok = usage.get("completion_tokens", usage.get("output_tokens", 0))
    p = FRONTIER_PRICES[model]
    cost = (in_tok * p["in"] + out_tok * p["out"]) / 1e6
    return text.strip(), end - t0, end - t0, in_tok, out_tok, cost


def extract_number(text: str) -> float | None:
    import re
    m = re.findall(r"-?\d[\d,]*\.?\d*", text.replace(",", ""))
    return float(m[-1]) if m else None


def ask_endpoint(base_url: str, key: str, model: str, user_prompt: str, max_tokens: int = 256):
    """OpenAI-compatible endpoint (Fireworks deployments, our own serving)."""
    body = {"model": model,
            "messages": [{"role": "system", "content": SYSTEM},
                         {"role": "user", "content": user_prompt}],
            "max_tokens": max_tokens}
    req = urllib.request.Request(base_url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {key}"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
    end = time.perf_counter()
    text = data["choices"][0]["message"]["content"]
    usage = data.get("usage", {})
    return text.strip(), end - t0, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)


def score(answer: str, truth, tol) -> tuple[bool, bool]:
    if isinstance(truth, str):                      # yes/no / text answers
        hit = truth in answer.lower()
        return hit, not hit
    num = extract_number(answer)
    if num is None:
        return False, False
    tol = tol if tol is not None else 0.05
    ok = abs(num - truth) <= tol + abs(truth) * 0.005
    return ok, not ok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--few-shot", type=int, default=0, help="prepend N worked examples to every prompt")
    ap.add_argument("--models", default="base-qwen,sova-qwen,frontier")
    ap.add_argument("--frontier-model", default="gpt-6.1-sol")
    ap.add_argument("--fw-model", default=None, help="Fireworks endpoint model id (enables 'endpoint' column)")
    ap.add_argument("--fw-base-url", default="https://api.fireworks.ai/inference/v1/chat/completions")
    ap.add_argument("--fw-price-in", type=float, default=0.0, help="USD per 1M input tokens")
    ap.add_argument("--fw-price-out", type=float, default=0.0, help="USD per 1M output tokens")
    ap.add_argument("--out", default="reports/arena.json")
    args = ap.parse_args()

    cases = [json.loads(l) for l in (ROOT / "data" / "questions.jsonl").read_text().splitlines()][: args.limit]
    wanted = args.models.split(",")

    locals_ready = {}
    if "base-qwen" in wanted:
        locals_ready["base-qwen"] = load(BASE_MODEL)
    if "sova-qwen" in wanted:
        locals_ready["sova-qwen"] = load(BASE_MODEL, adapter_path=str((ROOT / ADAPTER).resolve()))

    results: dict[str, list] = {m: [] for m in locals_ready}
    endpoint_ready = "endpoint" in wanted and args.fw_model and os.environ.get("FIREWORKS_API_KEY")
    if endpoint_ready:
        results["endpoint"] = []
    if "frontier" in wanted and (os.environ.get("OPENAI_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")):
        results["frontier"] = []

    fw_key = os.environ.get("FIREWORKS_API_KEY", "")

    FEWSHOT = (
        "Example 1:\n"
        "Context: Revenue: 4,000 | Operating income: 620\n"
        "Question: what is the operating margin (in %)?\n"
        "Answer: 15.5\n\n"
        "Example 2:\n"
        "Context: Revenue 2023: 5,000 | Revenue 2022: 4,000\n"
        "Question: what is the YoY revenue growth rate (in %)?\n"
        "Answer: 25.0\n\n"
        "Now answer the real task. Reply with the final value only.\n\n"
    ) if args.few_shot else ""

    for c in cases:
        user = f"{c['context']}\n\n{c['question']}"
        if prefix_len := len(FEWSHOT):
            user = FEWSHOT + user
        for name, (model, tok) in locals_ready.items():
            ans, ttft, total, n_tok, tps = ask_local(model, tok, user)
            ok, halluc = score(ans, c["answer"], c["tolerance"])
            results[name].append({"id": c["id"], "answer": ans, "truth": c["answer"],
                                  "correct": ok, "hallucinated": halluc, "ttft_s": ttft,
                                  "latency_s": total, "tokens": n_tok, "tok_s": tps, "cost_usd": 0.0})
            print(f"[{name}] {c['id']}: {'OK ' if ok else 'MISS'} ({ans[:60]!r})")
        if endpoint_ready:
            ans, total, in_tok, out_tok = ask_endpoint(args.fw_base_url, fw_key, args.fw_model, user)
            ok, halluc = score(ans, c["answer"], c["tolerance"])
            cost = (in_tok * args.fw_price_in + out_tok * args.fw_price_out) / 1e6
            results["endpoint"].append({"id": c["id"], "answer": ans, "truth": c["answer"],
                                        "correct": ok, "hallucinated": halluc, "ttft_s": None,
                                        "latency_s": total, "tokens": in_tok + out_tok, "tok_s": None,
                                        "cost_usd": cost})
            print(f"[endpoint] {c['id']}: {'OK ' if ok else 'MISS'} ({ans[:60]!r})")

    summary = {}
    for name, rows in results.items():
        if not rows:
            continue
        costs = [r["cost_usd"] for r in rows]
        gpu_cost_est = (sum(r["latency_s"] for r in rows) / len(rows) * 1000) / 3600 * 8.0
        ttfts = [r["ttft_s"] for r in rows if r["ttft_s"] is not None]
        tpss = [r["tok_s"] for r in rows if r["tok_s"]]
        summary[name] = {
            "n": len(rows),
            "accuracy": round(sum(r["correct"] for r in rows) / len(rows), 4),
            "hallucination_rate": round(sum(r["hallucinated"] for r in rows) / len(rows), 4),
            "p50_ttft_ms": round(statistics.median(ttfts) * 1000, 1) if ttfts else None,
            "p50_latency_s": round(statistics.median(r["latency_s"] for r in rows), 2),
            "p50_tok_s": round(statistics.median(tpss), 1) if tpss else None,
            "cost_per_1k_tasks": round((sum(costs) / len(rows) * 1000) or gpu_cost_est, 3),
        }

    out = Path(args.out)
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps({"summary": summary, "cases": results}, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    main()

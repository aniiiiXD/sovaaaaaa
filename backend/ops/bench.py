#!/usr/bin/env python3
"""Real-speed benchmark for the vLLM endpoint.

Measures, per concurrency level: aggregate output tok/s, TTFT (p50/p95),
request latency (p50/p95), and completion tokens. Streaming SSE with
usage accounting, so numbers come from the server's own token counts.

Usage:
  python3 bench.py --url http://<alb> --model qwen3-4b
  python3 bench.py --url http://localhost:8000 --levels 1,4,16 --requests 8
"""
import argparse
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROMPT = ("Explain how continuous batching improves GPU utilization for LLM "
          "serving. Be concrete and mention memory bandwidth.")


def one_request(url: str, model: str, max_tokens: int) -> dict:
    """Stream one chat completion; return ttft_ms, latency_ms, completion_tokens."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": PROMPT}],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "stream": True,
        "stream_options": {"include_usage": True},
    }).encode()
    request = urllib.request.Request(
        url.rstrip("/") + "/v1/chat/completions", data=payload,
        headers={"Content-Type": "application/json"})
    started = time.perf_counter()
    ttft = None
    completion_tokens = 0
    with urllib.request.urlopen(request, timeout=300) as response:
        for raw in response:
            line = raw.decode().strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            chunk = json.loads(line[len("data: "):])
            if chunk.get("usage"):
                completion_tokens = chunk["usage"].get("completion_tokens",
                                                      completion_tokens)
            choices = chunk.get("choices") or []
            if choices and choices[0].get("delta", {}).get("content"):
                if ttft is None:
                    ttft = (time.perf_counter() - started) * 1000
                if not completion_tokens:
                    completion_tokens += 1
    latency = (time.perf_counter() - started) * 1000
    return {"ttft_ms": ttft, "latency_ms": latency,
            "completion_tokens": completion_tokens}


def percentile(values: list, pct: float) -> float:
    ordered = sorted(v for v in values if v is not None)
    if not ordered:
        return float("nan")
    index = min(len(ordered) - 1, int(len(ordered) * pct / 100))
    return ordered[index]


def run_level(url: str, model: str, concurrency: int, requests: int,
              max_tokens: int) -> dict:
    per_worker = max(1, requests // concurrency)
    total = per_worker * concurrency
    results = []
    wall_started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(one_request, url, model, max_tokens)
                   for _ in range(total)]
        for future in futures:
            results.append(future.result())
    wall = time.perf_counter() - wall_started

    tokens = sum(r["completion_tokens"] for r in results)
    ttfts = [r["ttft_ms"] for r in results if r["ttft_ms"] is not None]
    latencies = [r["latency_ms"] for r in results]
    return {
        "concurrency": concurrency,
        "requests": total,
        "out_tok_s": tokens / wall if wall else 0,
        "tokens": tokens,
        "ttft_p50": percentile(ttfts, 50),
        "ttft_p95": percentile(ttfts, 95),
        "lat_p50": percentile(latencies, 50),
        "lat_p95": percentile(latencies, 95),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="e.g. http://<alb-dns>")
    parser.add_argument("--model", default="qwen3-4b")
    parser.add_argument("--levels", default="1,8,32,64")
    parser.add_argument("--requests", type=int, default=16,
                        help="total requests per level")
    parser.add_argument("--max-tokens", type=int, default=128)
    args = parser.parse_args()

    # Warm-up: one streamed request so weights/KV are hot before measuring.
    try:
        one_request(args.url, args.model, 16)
    except Exception as exc:
        sys.exit(f"Endpoint not reachable or unhealthy: {exc}")

    print(f"{'conc':>5}{'reqs':>6}{'out tok/s':>11}{'tok':>8}"
          f"{'ttft p50':>10}{'ttft p95':>10}{'lat p50':>10}{'lat p95':>10}")
    for level in (int(x) for x in args.levels.split(",")):
        row = run_level(args.url, args.model, level, args.requests,
                        args.max_tokens)
        print(f"{row['concurrency']:>5}{row['requests']:>6}"
              f"{row['out_tok_s']:>11.0f}{row['tokens']:>8}"
              f"{row['ttft_p50']:>10.0f}{row['ttft_p95']:>10.0f}"
              f"{row['lat_p50']:>10.0f}{row['lat_p95']:>10.0f}")


if __name__ == "__main__":
    main()

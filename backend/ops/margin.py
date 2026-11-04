#!/usr/bin/env python3
"""Margin report: revenue vs GPU cost for the serving stack.

Input: usage JSONL lines emitted by the website gateway (one JSON object per
request), exported from Vercel log drains:
  {"ts": "...", "key_id": "a1b2c3d4", "model": "qwen3-8b",
   "prompt_tokens": 120, "completion_tokens": 400, "latency_ms": 831, ...}

Usage:
  python3 margin.py usage.jsonl --instance-cost 350
  python3 margin.py usage.jsonl --price qwen3-8b=0.12/0.35
Prices are USD per 1M tokens as input/output.
"""
import argparse
import json
import sys
from collections import defaultdict

# USD per 1M tokens: (input, output) — 8-9B open-model market rates
PRICES = {
    "qwen3-8b": (0.10, 0.30),
    "qwen3-4b": (0.05, 0.15),
    "qwen3-0.6b": (0.02, 0.06),
    "glm4-9b": (0.10, 0.30),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("usage_file", help="JSONL from the gateway log drain")
    parser.add_argument("--price", action="append", default=[],
                        metavar="MODEL=IN/OUT", help="override a price, USD per 1M")
    parser.add_argument("--instance-cost", type=float, default=350.0,
                        help="total infra cost for the period (USD)")
    parser.add_argument("--hours", type=float, default=720.0,
                        help="hours in the period (720 = a month)")
    args = parser.parse_args()

    prices = dict(PRICES)
    for spec in args.price:
        name, pair = spec.split("=", 1)
        in_price, out_price = (float(x) for x in pair.split("/"))
        prices[name] = (in_price, out_price)

    per_key = defaultdict(lambda: {"in": 0, "out": 0, "requests": 0, "revenue": 0.0})
    total_in = total_out = total_revenue = 0
    unpriced = set()
    for line in open(args.usage_file):
        line = line.strip()
        if not line:
            continue
        row = json.loads(line)
        model = row.get("model", "")
        if model not in prices:
            unpriced.add(model)
            in_cost = out_cost = 0.0
        else:
            in_price, out_price = prices[model]
            in_cost = row.get("prompt_tokens", 0) / 1e6 * in_price
            out_cost = row.get("completion_tokens", 0) / 1e6 * out_price
        entry = per_key[row.get("key_id", "unknown")]
        entry["in"] += row.get("prompt_tokens", 0)
        entry["out"] += row.get("completion_tokens", 0)
        entry["requests"] += 1
        entry["revenue"] += in_cost + out_cost
        total_in += row.get("prompt_tokens", 0)
        total_out += row.get("completion_tokens", 0)
        total_revenue += in_cost + out_cost

    if not per_key:
        sys.exit(f"No usage rows found in {args.usage_file}")
    if unpriced:
        print(f"WARNING: no price for {sorted(unpriced)}; their revenue counted as 0. "
              f"Add with --price model=IN/OUT\n")

    print(f"{'key':<12}{'requests':>9}{'in tok':>13}{'out tok':>13}{'revenue':>11}")
    for key_id, entry in sorted(per_key.items(), key=lambda kv: -kv[1]["revenue"]):
        print(f"{key_id:<12}{entry['requests']:>9}{entry['in']:>13}"
              f"{entry['out']:>13}{entry['revenue']:>11.2f}")

    print(f"\nTokens served:   {total_in / 1e6:.2f}M in / {total_out / 1e6:.2f}M out")
    print(f"Revenue:          ${total_revenue:,.2f}")
    print(f"Infra cost ({args.hours:.0f}h):  -${args.instance_cost:,.2f} "
          f"(${args.instance_cost / args.hours:.2f}/h)")
    margin = total_revenue - args.instance_cost
    print(f"Margin:           {'+' if margin >= 0 else ''}${margin:,.2f}")


if __name__ == "__main__":
    main()

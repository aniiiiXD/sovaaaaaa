"""Compare two eval runs (base vs fine-tuned) into one report.

Usage: uv run python report.py reports/base.json reports/tuned.json
"""
import json
import sys
from pathlib import Path


def main() -> None:
    base = json.loads(Path(sys.argv[1]).read_text())
    tuned = json.loads(Path(sys.argv[2]).read_text())
    rows = [
        ("Cases evaluated", f"{base['n']}", f"{tuned['n']}"),
        ("Accuracy", f"{base['accuracy'] * 100:.1f}%", f"{tuned['accuracy'] * 100:.1f}%"),
        ("P50 TTFT (ms)", f"{base['p50_ttft_ms']}", f"{tuned['p50_ttft_ms']}"),
        ("P50 throughput (tok/s)", f"{base['p50_tok_per_s']}", f"{tuned['p50_tok_per_s']}"),
        ("USD per 1k tasks", f"${base['usd_per_1k_tasks']:.2f}", f"${tuned['usd_per_1k_tasks']:.2f}"),
    ]
    lines = [
        "# Banking77 intent triage: base vs SOVA specialist",
        "",
        f"Base: `{base['model']}`  |  Tuned: `{tuned['model']}` + `{tuned['adapter']}`",
        "",
        "| Metric | Base | Specialist |",
        "| --- | --- | --- |",
    ]
    lines += [f"| {k} | {b} | {t} |" for k, b, t in rows]
    acc_gain = (tuned["accuracy"] - base["accuracy"]) * 100
    lines += ["", f"Accuracy gain: **{acc_gain:+.1f} pp**"]
    report = Path("reports/REPORT.md")
    report.write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\n-> {report}")


if __name__ == "__main__":
    main()

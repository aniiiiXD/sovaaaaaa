"""Generate the /arena scoreboard JSON for the website.

Reads arena reports (if present) + the published FinQA landscape, writes
website/src/app/arena/scoreboard.json. Re-run after every Arena pass.

Usage: uv run python build_scoreboard.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
SITE = ROOT.parent.parent / "website" / "src" / "app" / "arena"

PUBLISHED = [
    {"model": "Fino1-14B", "finqa": 74.18, "note": "Qwen2.5-14B base · Apache-2.0 weights"},
    {"model": "Qwen2.5-72B-Instruct", "finqa": 73.38, "note": "72B open weights"},
    {"model": "DeepSeek-V3", "finqa": 73.20, "note": "frontier API"},
    {"model": "Fino1-8B", "finqa": 73.03, "note": "Llama-3.1-8B base · public prior art"},
    {"model": "GPT-4o", "finqa": 72.49, "note": "frontier API"},
    {"model": "GPT-4.5", "finqa": 68.94, "note": "frontier API"},
    {"model": "Qwen3-32B", "finqa": 64.15, "note": "our 32B candidate's base"},
    {"model": "Qwen3-8B", "finqa": 62.11, "note": "our 8B candidate's base"},
    {"model": "Llama-3.1-8B-Instruct", "finqa": 54.13, "note": "Fino1-8B's backbone"},
    {"model": "GPT-o1-preview", "finqa": 49.07, "note": "frontier API"},
]
SOURCE = "Published: arXiv 2502.08127 v3, Table 3 (FinQA, 1,100-question evaluation)"


def load(path: str) -> dict | None:
    p = ROOT / "reports" / path
    if not p.exists():
        return None
    return json.loads(p.read_text()).get("summary")


def main() -> None:
    base = load("arena_baseline.json")
    arena = load("arena.json")

    def col(cid, name, role, status, s=None):
        return {"id": cid, "name": name, "role": role, "status": status,
                "metrics": None if s is None else {
                    "accuracy": s.get("accuracy"), "hallucination_rate": s.get("hallucination_rate"),
                    "p50_ttft_ms": s.get("p50_ttft_ms"), "p50_latency_s": s.get("p50_latency_s"),
                    "p50_tok_s": s.get("p50_tok_s"), "cost_per_1k_tasks": s.get("cost_per_1k_tasks"),
                    "n": s.get("n")}}

    columns = [
        col("base-qwen", "Base Qwen3-0.6B", "baseline",
            "measuring" if base is None else "live", base),
        col("sova-specialist", "SOVA Fin Specialist", "ours",
            "live" if arena and "sova-qwen" in arena else "training",
            arena.get("sova-qwen") if arena else None),
        col("fino1-8b", "Fino1-8B (public prior art)", "prior-art",
            "live" if arena and "fino1-8b" in arena else "queued", None),
        col("frontier", "Frontier API (GPT-6.1 Sol)", "frontier",
            "live" if arena and "frontier" in arena else "key pending",
            arena.get("frontier") if arena else None),
    ]
    phase = "live" if arena else ("baselines" if base else "queued")

    board = {
        "updated": "2026-10-24",
        "phase": phase,
        "eval": {
            "dataset": "FinQA test split (ChanceFocus/flare-finqa), 200 held-out questions",
            "license": "MIT (dataset) · scores vs arXiv 2502.08127 Table 3",
            "scoring": "numeric within 1% tolerance; yes/no exact match",
        },
        "columns": columns,
        "published": PUBLISHED,
        "source": SOURCE,
    }
    SITE.mkdir(exist_ok=True)
    (SITE / "scoreboard.json").write_text(json.dumps(board, indent=1))
    print(f"scoreboard phase={phase} -> {SITE / 'scoreboard.json'}")


if __name__ == "__main__":
    main()

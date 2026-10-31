"""Convert FinQA JSONL (prompt/completion) to Fireworks SFT messages format.

Reads:  data/finqa_train.jsonl, data/finqa_valid.jsonl
Writes: data/fw_train.jsonl, data/fw_eval.jsonl  (Fireworks messages JSONL)

Usage: uv run python convert_finqa_fw.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent / "data"
SYSTEM = (
    "You are a careful financial analyst. Using only the provided filing "
    "excerpt, compute the answer and reply with the final value only."
)


def to_messages(row: dict) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": row["prompt"].strip()},
            {"role": "assistant", "content": row["completion"].strip()},
        ]
    }


def main() -> None:
    for src, dst in [("finqa_train.jsonl", "fw_train.jsonl"), ("finqa_valid.jsonl", "fw_eval.jsonl")]:
        rows = [json.loads(l) for l in (ROOT / src).read_text().splitlines()]
        with (ROOT / dst).open("w") as fh:
            for r in rows:
                fh.write(json.dumps(to_messages(r)) + "\n")
        print(f"{dst}: {len(rows)} messages-rows")


if __name__ == "__main__":
    main()

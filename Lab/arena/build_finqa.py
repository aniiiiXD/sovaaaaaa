"""Build SOVA Arena training + eval sets from the REAL FinQA benchmark
(ChanceFocus/flare-finqa on Hugging Face: real 10-K excerpts, gold answers).

Outputs (arena/data/):
  finqa_train.jsonl  - train split (6,251) in prompt/completion format
  finqa_valid.jsonl  - 400 held back from train for loss curves
  questions.jsonl    - 200-case eval sampled from the TEST split (never trained on)

Eval case format stays compatible with run_arena.py:
  {id, context, question, answer, tolerance} where answer may be numeric or yes/no.
"""
import json
import random
import re
from pathlib import Path

import pandas as pd
from huggingface_hub import snapshot_download

SNAP = snapshot_download("ChanceFocus/flare-finqa", repo_type="dataset",
                         allow_patterns=["data/*"])
Q_SPLIT = re.compile(r"^(.*\nQuestion: )(.*)$", re.S)


def parse_query(query: str) -> tuple[str, str]:
    """Split a flare query into (context, question)."""
    m = Q_SPLIT.match(query)
    if m:
        return m.group(1).replace("Please answer the given financial question based on the context.\nContext: ", "").strip(), m.group(2).strip()
    return query.strip(), ""


def main() -> None:
    random.seed(20261024)
    out = Path(__file__).parent / "data"
    out.mkdir(exist_ok=True)

    def load(split: str) -> pd.DataFrame:
        path = next(Path(SNAP, "data").glob(f"{split}-*.parquet"))
        return pd.read_parquet(path)

    # ---- training set (train split; 400 rows held back for validation) ----
    train = load("train").sample(frac=1, random_state=7).reset_index(drop=True)
    valid, train = train.iloc[:400], train.iloc[400:]
    for name, df in [("finqa_train", train), ("finqa_valid", valid)]:
        with (out / f"{name}.jsonl").open("w") as fh:
            for _, r in df.iterrows():
                row = {"prompt": r["query"].strip(), "completion": " " + str(r["answer"]).strip()}
                fh.write(json.dumps(row) + "\n")
        print(f"{name}: {len(df)}")

    # ---- eval set: 200 from the untouched TEST split ----
    test = load("test").sample(n=200, random_state=20261024).reset_index(drop=True)
    cases = []
    for _, r in test.iterrows():
        context, question = parse_query(r["query"])
        ans = str(r["answer"]).strip()
        numeric = bool(re.fullmatch(r"-?\d+(\.\d+)?", ans))
        cases.append({
            "id": str(r["id"]),
            "context": context,
            "question": question,
            "answer": float(ans) if numeric else ans.lower(),
            "unit": "number" if numeric else "text",
            "tolerance": None if not numeric else max(0.05, abs(float(ans)) * 0.01),
        })
    with (out / "questions.jsonl").open("w") as fh:
        for c in cases:
            fh.write(json.dumps(c) + "\n")
    n_num = sum(1 for c in cases if c["unit"] == "number")
    print(f"eval questions: {len(cases)} ({n_num} numeric, {len(cases) - n_num} yes/no)")


if __name__ == "__main__":
    main()

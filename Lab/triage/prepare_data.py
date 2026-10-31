"""Download Banking77 and build train/valid/test JSONL for intent triage.

Real public dataset: 77 banking customer-service intents, ~10k train / ~3k test.
Output format (mlx_lm lora / chat): {"prompt": ..., "completion": ...}
"""
import json
import random
from pathlib import Path

from datasets import load_dataset

ROOT = Path(__file__).parent / "data"
LABELS: list[str] | None = None


def text_of(row) -> str:
    return row["text"]


def label_of(row) -> str:
    i = row["label"]
    return LABELS[i]


def main() -> None:
    random.seed(77)
    ROOT.mkdir(exist_ok=True)

    ds = load_dataset("PolyAI/banking77", trust_remote_code=True)
    global LABELS
    LABELS = ds["train"].features["label"].names

    def make(row) -> dict:
        msg = " ".join(text_of(row).split())
        return {
            "prompt": (
                "Classify the customer message into exactly one banking intent "
                "from the list below.\n\n"
                "Intents: " + ", ".join(LABELS) + "\n\n"
                f"Message: {msg}\n"
                "Intent:"
            ),
            "completion": " " + label_of(row),
        }

    train = [make(r) for r in ds["train"]]
    test = [make(r) for r in ds["test"]]
    random.shuffle(train)
    valid, train_split = train[:500], train[500:]

    for name, rows in [("train", train_split), ("valid", valid), ("test", test)]:
        path = ROOT / f"{name}.jsonl"
        with path.open("w") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
        print(f"{name}: {len(rows)} -> {path}")

    (ROOT / "labels.json").write_text(json.dumps(LABELS, indent=1))
    print(f"intents: {len(LABELS)}")


if __name__ == "__main__":
    main()

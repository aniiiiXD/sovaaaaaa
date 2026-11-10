"""Pinned FinCalc-NLI test examples, kept separate from model inputs."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path

from sova_data import DecisionExample, GoldTarget, ModelInput
from sova_data.loader import LABELS

REVISION = "498b53ab487ece83d38a2ab95ac601b959d319a0"
TEST_SHA256 = "f53eaacc749f6014cb3ee157a461f0ce110ee7df1843e148767fc10e514fa258"
TEST_COUNT = 4000
DATA_PATH = f"datasets/raw/fincalc-nli/{REVISION}/test.jsonl"
SOURCE_URL = f"https://huggingface.co/datasets/anespo28/fincalc-nli/blob/{REVISION}/test.jsonl"

# FinCalc's neutral class is treated as approximately equivalent to the
# legal model's NotMentioned class. Their annotation definitions can differ.
LABEL_MAP = {0: "Contradiction", 1: "Entailment", 2: "NotMentioned"}


@dataclass(frozen=True)
class FinanceRecord:
    example: DecisionExample
    metric: str
    kind: str


def parse_records(data: bytes) -> list[FinanceRecord]:
    """Build examples without passing labels or dataset tags to the model."""
    records: list[FinanceRecord] = []
    for index, line in enumerate(data.splitlines(), 1):
        if not line.strip():
            raise ValueError(f"Unexpected empty line at {index}")
        try:
            row = json.loads(line)
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValueError(f"Invalid JSON at line {index}") from exc
        if not isinstance(row, dict):
            raise ValueError(f"Expected an object at line {index}")
        for key in ("premise", "hypothesis", "metric", "kind"):
            if not isinstance(row.get(key), str) or not row[key].strip():
                raise ValueError(f"Missing or invalid {key} at line {index}")
        label = row.get("label")
        if not isinstance(label, int) or isinstance(label, bool) or label not in LABEL_MAP:
            raise ValueError(f"Unknown label at line {index}")
        document_id = hashlib.sha256(row["premise"].encode("utf-8")).hexdigest()
        example = DecisionExample(
            decision_id=f"fincalc:test:{index:05d}",
            document_id=document_id,
            source_file="fincalc-nli/test.jsonl",
            model_input=ModelInput(row["premise"], row["hypothesis"], LABELS),
            target=GoldTarget(LABEL_MAP[label], ()),
        )
        records.append(FinanceRecord(example, row["metric"], row["kind"]))
    if not records:
        raise ValueError("Finance dataset is empty")
    return records


def load_test(path: Path) -> list[FinanceRecord]:
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != TEST_SHA256:
        raise ValueError("FinCalc-NLI test data do not match the pinned SHA-256")
    records = parse_records(data)
    if len(records) != TEST_COUNT:
        raise ValueError("Unexpected FinCalc-NLI test split size")
    return records


def dataset_summary(records: list[FinanceRecord]) -> dict:
    counts = Counter(item.example.target.label for item in records)
    majority = max(counts.values()) if counts else 0
    return {
        "dataset": "anespo28/fincalc-nli",
        "revision": REVISION,
        "split": "test",
        "sha256": TEST_SHA256,
        "source": SOURCE_URL,
        "synthetic": True,
        "examples": len(records),
        "labels": {label: counts[label] for label in LABELS},
        "majority_baseline_accuracy": majority / len(records) if records else None,
        "mapping": {str(k): v for k, v in LABEL_MAP.items()},
        "mapping_note": "FinCalc neutral is approximated by the legal model's NotMentioned label.",
    }

"""Run the pinned pretrained Qwen baseline on ContractNLI dev only."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import time

from sova_data import ContractNLILoader
from sova_model import QwenDecisionModel
from sova_model.scorer import DEFAULT_MODEL, DEFAULT_REVISION

from .baseline import evaluate


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate untrained Qwen on the legal validation split")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--device", choices=("auto", "cuda", "cpu", "mps"), default="cuda")
    parser.add_argument("--max-input-tokens", type=int, default=4096)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = args.output_dir / "baseline-summary.json"
    predictions_path = args.output_dir / "baseline-predictions.jsonl"
    if summary_path.exists() or predictions_path.exists():
        raise FileExistsError("Refusing to overwrite baseline results")

    started = time.monotonic()
    loader = ContractNLILoader()
    model = QwenDecisionModel.load_local(device=args.device, max_input_tokens=args.max_input_tokens)

    def progress(total: int, scored: int) -> None:
        if total % 25 == 0:
            print(f"progress: {total} processed, {scored} scored, {time.monotonic() - started:.1f}s elapsed", flush=True)

    summary, rows = evaluate(loader.iter_split("dev"), model, progress)
    summary.update({
        "dataset": "ContractNLI", "split": "official dev", "model": DEFAULT_MODEL,
        "model_revision": DEFAULT_REVISION, "backend": "transformers",
        "weight_dtype": "float32" if model.device == "cpu" else "float16",
        "device": model.device, "max_input_tokens": args.max_input_tokens,
        "elapsed_seconds": time.monotonic() - started, "training_performed": False,
        "test_labels_loaded": False, "test_examples_scored": False,
        "notes": [
            "The model is an untuned pretrained baseline; option scores are uncalibrated.",
            "The official dev split contains repeated statements over 61 documents.",
            "Too-long examples count as incorrect for accuracy_all_examples and as false negatives for their true class.",
            "Only dev decision labels were loaded; document texts from other splits were read for exact-duplicate checking.",
            "Potential pretraining contamination and near duplicates are not ruled out.",
        ],
    })
    with predictions_path.open("x", encoding="utf-8") as out:
        for row in rows:
            out.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    with summary_path.open("x", encoding="utf-8") as out:
        json.dump(summary, out, indent=2, sort_keys=True)
        out.write("\n")
    print(json.dumps(summary, indent=2, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()

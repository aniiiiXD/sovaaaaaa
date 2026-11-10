"""Offline, single-request inference for a saved SOVA student checkpoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from sova_data import ModelInput
from sova_data.loader import LABELS
from .artifacts import load_saved_student
from .inference import StudentScorer


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a saved SOVA Mamba decision student offline")
    parser.add_argument("model_dir", type=Path)
    parser.add_argument("tokenizer_dir", type=Path)
    parser.add_argument("contract_file", type=Path)
    parser.add_argument("statement")
    parser.add_argument("--device", choices=("cuda",), default="cuda")
    args = parser.parse_args()
    from transformers import AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(args.tokenizer_dir, local_files_only=True, trust_remote_code=False)
    model, metadata = load_saved_student(args.model_dir, device=args.device)
    scorer = StudentScorer(model, tokenizer, device=args.device,
                           max_input_tokens=metadata["student_max_input_tokens"])
    result = scorer.score(ModelInput(args.contract_file.read_text(encoding="utf-8"), args.statement, LABELS))
    print(json.dumps({"decision": result.predicted_label, "scores": result.probabilities,
                      "calibrated": False, "input_tokens": result.input_tokens}, indent=2))


if __name__ == "__main__":
    main()

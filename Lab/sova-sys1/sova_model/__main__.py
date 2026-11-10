"""Run one local connection smoke test on one training example."""

from __future__ import annotations

import argparse
from itertools import islice
import json
import platform
import sys

from sova_data import ContractNLILoader

from .scorer import DEFAULT_MODEL, DEFAULT_REVISION, QwenDecisionModel
from .mlx_scorer import MLX_MODEL, MLX_REVISION, MLXQwenDecisionModel


def resolve_backend(requested: str) -> str:
    if requested == "auto":
        return "mlx" if sys.platform == "darwin" and platform.machine().lower() == "arm64" else "torch"
    return requested


def main() -> None:
    parser = argparse.ArgumentParser(description="Score one training example using locally cached Qwen weights")
    parser.add_argument("--index", type=int, default=0, help="Zero-based training example index")
    parser.add_argument("--backend", choices=("auto", "torch", "mlx"), default="auto")
    parser.add_argument("--device", choices=("auto", "mps", "cuda", "cpu"), default="auto")
    parser.add_argument("--max-input-tokens", type=int, default=4096)
    args = parser.parse_args()
    if args.index < 0:
        parser.error("--index must be non-negative")
    example = next(islice(ContractNLILoader().iter_split("train"), args.index, None), None)
    if example is None:
        parser.error("--index is outside the training split")
    backend = resolve_backend(args.backend)
    if backend == "mlx":
        if args.device not in ("auto", "mps"):
            parser.error("MLX runs on Apple hardware; use --device auto")
        model = MLXQwenDecisionModel.load_local(max_input_tokens=args.max_input_tokens)
        model_name, revision = MLX_MODEL, MLX_REVISION
    else:
        model = QwenDecisionModel.load_local(device=args.device, max_input_tokens=args.max_input_tokens)
        model_name, revision = DEFAULT_MODEL, DEFAULT_REVISION
    result = model.score(example.model_input)
    # Deliberately do not print the contract, gold label, or evidence target.
    print(json.dumps({
        "model": model_name, "revision": revision, "backend": backend,
        "example_id": example.decision_id, "device": result.device,
        "input_tokens": result.input_tokens, "scores": result.probabilities,
        "selected_label": result.predicted_label, "calibrated": result.calibrated,
        "note": "Pretrained baseline, not a trained SOVA model or an accuracy evaluation.",
    }, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Connection failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

"""SageMaker worker: fetch pinned public weights, then evaluate dev only."""

from __future__ import annotations

import os
import runpy
import sys


def main() -> None:
    os.environ["HF_HOME"] = "/opt/ml/huggingface"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    from huggingface_hub import snapshot_download
    import torch

    from sova_model.scorer import DEFAULT_MODEL, DEFAULT_REVISION

    if not torch.cuda.is_available():
        raise RuntimeError("The SageMaker worker does not have a CUDA device")
    print(f"GPU: {torch.cuda.get_device_name(0)}; torch {torch.__version__}", flush=True)
    print("Downloading the pinned public Qwen3-4B checkpoint to the temporary worker volume", flush=True)
    snapshot_download(
        DEFAULT_MODEL, revision=DEFAULT_REVISION,
        allow_patterns=["*.json", "*.safetensors", "merges.txt", "vocab.json"],
    )
    sys.argv = ["sova_eval", "--device", "cuda", "--max-input-tokens", "4096", "--output-dir", "/opt/ml/model"]
    runpy.run_module("sova_eval", run_name="__main__")


if __name__ == "__main__":
    main()

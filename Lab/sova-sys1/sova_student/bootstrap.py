"""Install pinned GPU dependencies compatible with the existing AWS image."""

from __future__ import annotations

import subprocess
import sys


def pip(*requirements: str) -> None:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", *requirements], check=True)


def kernel_wheel_urls(abi: str) -> tuple[str, str]:
    if abi not in ("TRUE", "FALSE"):
        raise ValueError("Unexpected PyTorch C++ ABI")
    causal = ("https://github.com/Dao-AILab/causal-conv1d/releases/download/v1.4.0/"
              f"causal_conv1d-1.4.0%2Bcu122torch2.1cxx11abi{abi}-cp310-cp310-linux_x86_64.whl")
    mamba = ("https://github.com/state-spaces/mamba/releases/download/v2.2.4/"
             f"mamba_ssm-2.2.4%2Bcu12torch2.1cxx11abi{abi}-cp310-cp310-linux_x86_64.whl")
    return causal, mamba


def main() -> None:
    import torch

    if sys.version_info[:2] != (3, 10) or not torch.__version__.startswith("2.1."):
        raise RuntimeError("Pinned CUDA wheels require the PyTorch 2.1 / Python 3.10 SageMaker image")
    if not torch.cuda.is_available() or not str(torch.version.cuda).startswith("12."):
        raise RuntimeError("Pinned CUDA wheels require a CUDA 12 GPU worker")
    abi = str(torch._C._GLIBCXX_USE_CXX11_ABI).upper()
    if abi not in ("TRUE", "FALSE"):
        raise RuntimeError("Unexpected PyTorch C++ ABI")
    pip("transformers==4.52.4", "peft==0.15.2", "accelerate==1.15.0",
        "huggingface-hub[hf_xet]==0.36.2", "safetensors==0.8.0",
        "einops==0.8.1", "ninja==1.11.1.3", "boto3==1.34.157")
    # Official release wheels: causal-conv1d selects the CUDA 12.2 wheel for
    # CUDA 12.x, while mamba-ssm labels its CUDA 12 wheel simply cu12.
    causal, mamba = kernel_wheel_urls(abi)
    pip("--no-deps", causal, mamba)
    import causal_conv1d_cuda  # noqa: F401
    import mamba_ssm  # noqa: F401
    print(f"Pinned Mamba dependencies loaded; CUDA {torch.version.cuda}, C++ ABI {abi}", flush=True)


if __name__ == "__main__":
    main()

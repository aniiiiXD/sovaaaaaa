"""Load pinned native Mamba checkpoints and save standalone SOVA students."""

from __future__ import annotations

import json
import os
from pathlib import Path

from .config import STUDENT_MODEL, STUDENT_REVISION, STUDENT_MAX_TOKENS, TOKENIZER_MODEL, TOKENIZER_REVISION
from .model import MambaDecisionModel


def validate_backbone_config(data: dict) -> None:
    if (data.get("d_model") != 1024 or data.get("n_layer") != 48 or
        data.get("ssm_cfg", {}).get("layer") != "Mamba2" or data.get("attn_layer_idx") != []):
        raise ValueError("Checkpoint is not the expected attention-free 370M Mamba-2 backbone")


def instantiate_backbone(config_data: dict):
    from mamba_ssm.models.config_mamba import MambaConfig
    from mamba_ssm.models.mixer_seq_simple import MambaLMHeadModel

    validate_backbone_config(config_data)
    return MambaLMHeadModel(MambaConfig(**config_data), device="cpu")


def load_pretrained_student(snapshot: Path, *, checkpoint_layers: bool = True):
    import torch

    config_data = json.loads((snapshot / "config.json").read_text(encoding="utf-8"))
    native = instantiate_backbone(config_data)
    # Only tensor-only loading of the pinned public checkpoint is permitted.
    state = torch.load(snapshot / "pytorch_model.bin", map_location="cpu", weights_only=True)
    native.load_state_dict(state, strict=True)
    del state
    student = MambaDecisionModel(native.backbone, config_data["d_model"], checkpoint_layers=checkpoint_layers)
    return native, student, config_data


def save_student(student, directory: Path, config_data: dict, metadata: dict) -> None:
    from safetensors.torch import save_file

    directory.mkdir(parents=True, exist_ok=False)
    weights = {key: value.detach().to("cpu").contiguous() for key, value in student.state_dict().items()}
    temporary = directory / "student.safetensors.partial"
    save_file(weights, str(temporary), metadata={"format": "sova-mamba2-decision-v1"})
    os.replace(temporary, directory / "student.safetensors")
    (directory / "backbone-config.json").write_text(json.dumps(config_data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (directory / "metadata.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def load_saved_student(directory: Path, *, device: str = "cuda"):
    from safetensors.torch import load_file

    if device != "cuda":
        raise ValueError("The pinned native Mamba-2 runtime requires CUDA")
    config_data = json.loads((directory / "backbone-config.json").read_text(encoding="utf-8"))
    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
    if metadata.get("model_format") != "sova-mamba2-decision-v1":
        raise ValueError("Unexpected SOVA student format")
    native = instantiate_backbone(config_data)
    student = MambaDecisionModel(native.backbone, config_data["d_model"], checkpoint_layers=False)
    student.load_state_dict(load_file(str(directory / "student.safetensors"), device="cpu"), strict=True)
    del native
    return student.to(device).eval(), metadata


def snapshot_metadata(config_data: dict, *, variant: str, training: dict) -> dict:
    validate_backbone_config(config_data)
    return {
        "model_format": "sova-mamba2-decision-v1", "variant": variant,
        "base_model": STUDENT_MODEL, "base_revision": STUDENT_REVISION,
        "tokenizer_model": TOKENIZER_MODEL, "tokenizer_revision": TOKENIZER_REVISION,
        "student_max_input_tokens": STUDENT_MAX_TOKENS,
        "labels": ["Entailment", "Contradiction", "NotMentioned"],
        "weights_dtype": "float32", "runtime_autocast": "float16 on CUDA",
        "attention_layers": 0, "training": training,
    }

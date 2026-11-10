"""Score training inputs using the existing Qwen adapter; never load labels."""

from __future__ import annotations

import math
import json
import os
from pathlib import Path

from sova_model import ContextTooLongError, encode_model_input


def teacher_record(scorer, example) -> dict:
    import torch

    if not example.decision_id.startswith("contractnli:train:"):
        raise ValueError("Teacher targets may only be generated for training decisions")
    common = {"decision_id": example.decision_id, "document_id": example.document_id}
    try:
        encoded = encode_model_input(scorer.tokenizer, example.model_input, scorer.max_input_tokens)
    except ContextTooLongError:
        return {**common, "status": "context_too_long", "logits": None}
    input_ids = torch.tensor([encoded.input_ids], dtype=torch.long, device=scorer.device)
    with torch.inference_mode():
        output = scorer.model(input_ids=input_ids, attention_mask=torch.ones_like(input_ids),
                              logits_to_keep=1, use_cache=False, return_dict=True)
        if output.logits.ndim != 3 or output.logits.shape[:2] != (1, 1):
            raise RuntimeError("Unexpected teacher logits shape")
        if min(encoded.choice_token_ids) < 0 or max(encoded.choice_token_ids) >= output.logits.shape[-1]:
            raise RuntimeError("Teacher option token lies outside the vocabulary")
        logits = output.logits[0, 0, list(encoded.choice_token_ids)].float().cpu().tolist()
    if any(not math.isfinite(value) for value in logits):
        raise RuntimeError("Teacher returned non-finite scores")
    return {**common, "status": "scored", "input_tokens": len(encoded.input_ids), "logits": logits}


def generate_teacher_records(scorer, examples, checkpoint_root: Path, *, on_progress=None) -> dict[str, dict]:
    """Generate only train targets, saving immutable chunks to SageMaker checkpoints."""
    checkpoint_root.mkdir(parents=True, exist_ok=True)
    records: dict[str, dict] = {}
    chunk = []
    chunk_number = 0

    def flush() -> None:
        nonlocal chunk_number
        if not chunk:
            return
        chunk_number += 1
        target = checkpoint_root / f"chunk-{chunk_number:04d}.jsonl"
        # Stage on the same mounted filesystem as the checkpoint: /opt/ml and
        # /opt/ml/checkpoints can be different mounts on SageMaker. A partial
        # file may briefly sync to S3; consumers only accept chunk-*.jsonl.
        temporary = checkpoint_root / f".chunk-{chunk_number:04d}.partial"
        if target.exists() or temporary.exists():
            raise FileExistsError("Refusing to overwrite teacher target chunks")
        with temporary.open("x", encoding="utf-8") as file:
            for record in chunk:
                file.write(json.dumps(record, sort_keys=True) + "\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, target)
        chunk.clear()

    for example in examples:
        if example.decision_id in records:
            raise ValueError("Duplicate teacher decision ID")
        record = teacher_record(scorer, example)
        records[record["decision_id"]] = record
        chunk.append(record)
        if len(chunk) == 250:
            flush()
        if on_progress and len(records) % 100 == 0:
            on_progress(len(records), sum(item["status"] == "scored" for item in records.values()))
    flush()
    if not records:
        raise ValueError("No training teacher targets were generated")
    return records

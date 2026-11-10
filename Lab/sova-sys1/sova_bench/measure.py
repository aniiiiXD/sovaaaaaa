"""One synchronized, instrumented decision request on a CUDA device."""

from __future__ import annotations

import math
import time

from sova_data.loader import LABELS
from sova_model import ContextTooLongError, encode_model_input


def measure_request(scorer, example, reference_prediction: str | None) -> dict:
    """Measure tokenization, GPU forward and wall time, including allocator peaks.

    End-to-end here means this in-process function's tokenization through CPU
    scores. It intentionally excludes PDF parsing, HTTP, model load and queueing.
    """
    import torch

    device = scorer.device
    if device != "cuda":
        raise ValueError("This benchmark requires the CUDA device")
    torch.cuda.synchronize()
    torch.cuda.reset_peak_memory_stats()
    started = time.perf_counter_ns()
    try:
        encoded = encode_model_input(scorer.tokenizer, example.model_input, scorer.max_input_tokens)
    except ContextTooLongError:
        return {"decision_id": example.decision_id, "document_id": example.document_id,
                "status": "context_too_long"}
    tokenized = time.perf_counter_ns()
    input_ids = torch.tensor([encoded.input_ids], dtype=torch.long, device=device)
    attention_mask = torch.ones_like(input_ids)
    start_gpu = torch.cuda.Event(enable_timing=True)
    end_gpu = torch.cuda.Event(enable_timing=True)
    with torch.inference_mode():
        start_gpu.record()
        output = scorer.model(input_ids=input_ids, attention_mask=attention_mask,
                              logits_to_keep=1, use_cache=False, return_dict=True)
        end_gpu.record()
        logits = output.logits
        if logits.ndim != 3 or logits.shape[:2] != (1, 1):
            raise RuntimeError("Unexpected logits shape")
        if min(encoded.choice_token_ids) < 0 or max(encoded.choice_token_ids) >= logits.shape[-1]:
            raise RuntimeError("Choice token ID is outside the vocabulary")
        selected = logits[0, 0, list(encoded.choice_token_ids)].float()
        if not bool(torch.isfinite(selected).all().item()):
            raise RuntimeError("Model returned non-finite scores")
        values = torch.softmax(selected, dim=-1).cpu().tolist()
    torch.cuda.synchronize()
    ended = time.perf_counter_ns()
    if any(not math.isfinite(value) for value in values):
        raise RuntimeError("Model returned non-finite probabilities")
    prediction = LABELS[max(range(len(values)), key=values.__getitem__)]
    return {
        "decision_id": example.decision_id, "document_id": example.document_id, "status": "scored",
        "input_tokens": len(encoded.input_ids), "prediction": prediction,
        "reference_prediction": reference_prediction,
        "tokenization_ms": (tokenized - started) / 1_000_000,
        "end_to_end_ms": (ended - started) / 1_000_000,
        "gpu_forward_ms": start_gpu.elapsed_time(end_gpu),
        "gpu_peak_allocated_bytes": torch.cuda.max_memory_allocated(),
        "gpu_peak_reserved_bytes": torch.cuda.max_memory_reserved(),
    }

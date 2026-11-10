"""Summaries of per-request timing observations, without a model dependency."""

from __future__ import annotations

import math
from typing import Iterable

BUCKETS = ((1, 512), (513, 1024), (1025, 2048), (2049, 4096))
TIMING_FIELDS = ("end_to_end_ms", "tokenization_ms", "gpu_forward_ms")


def percentile(values: Iterable[float], quantile: float) -> float | None:
    """Linearly interpolate between adjacent ranks; do not invent empty results."""
    if not 0 <= quantile <= 1:
        raise ValueError("Quantile must be between zero and one")
    ordered = sorted(float(value) for value in values)
    if any(not math.isfinite(value) or value < 0 for value in ordered):
        raise ValueError("Measurements must be finite and nonnegative")
    if not ordered:
        return None
    position = (len(ordered) - 1) * quantile
    low = math.floor(position)
    high = math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def _distribution(rows: list[dict]) -> dict:
    result: dict = {"examples": len(rows), "documents": len({row["document_id"] for row in rows})}
    for field in TIMING_FIELDS:
        values = [row[field] for row in rows]
        result[field] = {
            "p50": percentile(values, 0.50), "p95": percentile(values, 0.95),
            "mean": sum(values) / len(values) if values else None,
        }
    return result


def summarize(rows: list[dict]) -> dict:
    """Compute scoped timing distributions, coverage, and CUDA allocator peaks."""
    if not rows or len({row["decision_id"] for row in rows}) != len(rows):
        raise ValueError("Benchmark rows must be nonempty and have unique decision IDs")
    for row in rows:
        if row["status"] not in ("scored", "context_too_long"):
            raise ValueError("Unexpected benchmark status")
        if row["status"] == "scored":
            if not 1 <= row["input_tokens"] <= 4096:
                raise ValueError("Scored request is outside the configured token range")
            for field in TIMING_FIELDS:
                if not isinstance(row[field], (int, float)) or not math.isfinite(row[field]) or row[field] < 0:
                    raise ValueError(f"Invalid {field}")
            if row["gpu_peak_allocated_bytes"] < 0 or row["gpu_peak_reserved_bytes"] < 0:
                raise ValueError("GPU memory cannot be negative")
    scored = [row for row in rows if row["status"] == "scored"]
    if not scored:
        raise ValueError("No scored requests")
    buckets = {}
    for low, high in BUCKETS:
        matching = [row for row in scored if low <= row["input_tokens"] <= high]
        buckets[f"{low}-{high}"] = _distribution(matching)
    return {
        "requests": len(rows), "documents": len({row["document_id"] for row in rows}),
        "scored_requests": len(scored), "context_too_long": len(rows) - len(scored),
        "coverage": len(scored) / len(rows), "overall": _distribution(scored), "token_buckets": buckets,
        "peak_gpu_allocated_bytes": max(row["gpu_peak_allocated_bytes"] for row in scored),
        "peak_gpu_reserved_bytes": max(row["gpu_peak_reserved_bytes"] for row in scored),
        "prediction_disagreements_with_saved_run": sum(
            row["prediction"] != row["reference_prediction"] for row in scored
        ),
    }

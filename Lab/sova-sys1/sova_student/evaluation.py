"""Accuracy, matched teacher comparison, latency and memory for a student."""

from __future__ import annotations

import math
import time

from sova_bench.metrics import percentile
from sova_data.loader import LABELS
from sova_eval.baseline import evaluate
from sova_model import ContextTooLongError, DecisionScores
from .data import encode_student_input

BUCKETS = ((1, 512), (513, 1024), (1025, 2048), (2049, 4096), (4097, 8192))


class MeasuredStudentScorer:
    """Single unpadded request; keep timing separate from classifier accuracy."""

    def __init__(self, model, tokenizer, *, device: str, max_input_tokens: int) -> None:
        self.model, self.tokenizer = model, tokenizer
        self.device, self.max_input_tokens = device, max_input_tokens
        self.measurements: list[dict] = []
        self.model.eval()

    def score(self, model_input) -> DecisionScores:
        import torch

        if self.device == "cuda":
            torch.cuda.synchronize()
            torch.cuda.reset_peak_memory_stats()
        started = time.perf_counter_ns()
        try:
            ids = encode_student_input(self.tokenizer, model_input, self.max_input_tokens)
        except ContextTooLongError:
            self.measurements.append({"status": "context_too_long"})
            raise
        tokenized = time.perf_counter_ns()
        input_ids = torch.tensor([ids], dtype=torch.long, device=self.device)
        gpu_start = gpu_end = None
        if self.device == "cuda":
            gpu_start, gpu_end = torch.cuda.Event(enable_timing=True), torch.cuda.Event(enable_timing=True)
        with torch.inference_mode(), torch.autocast(
            device_type="cuda" if self.device == "cuda" else "cpu",
            dtype=torch.float16, enabled=self.device == "cuda",
        ):
            if gpu_start is not None:
                gpu_start.record()
            logits = self.model(input_ids)
            if gpu_end is not None:
                gpu_end.record()
            if logits.ndim != 2 or tuple(logits.shape) != (1, 3):
                raise RuntimeError("Unexpected student score shape")
            if not bool(torch.isfinite(logits).all().item()):
                raise RuntimeError("Non-finite student scores")
            values = torch.softmax(logits.float(), dim=-1)[0].cpu().tolist()
        if self.device == "cuda":
            torch.cuda.synchronize()
        ended = time.perf_counter_ns()
        if any(not math.isfinite(value) for value in values):
            raise RuntimeError("Non-finite student probabilities")
        self.measurements.append({
            "status": "scored", "input_tokens": len(ids),
            "end_to_end_ms": (ended - started) / 1_000_000,
            "tokenization_ms": (tokenized - started) / 1_000_000,
            "gpu_forward_ms": gpu_start.elapsed_time(gpu_end) if gpu_start is not None else None,
            "gpu_peak_allocated_bytes": torch.cuda.max_memory_allocated() if self.device == "cuda" else None,
            "gpu_peak_reserved_bytes": torch.cuda.max_memory_reserved() if self.device == "cuda" else None,
        })
        probabilities = dict(zip(LABELS, (float(value) for value in values)))
        return DecisionScores(probabilities, max(LABELS, key=probabilities.__getitem__), len(ids), self.device)


def latency_summary(rows: list[dict], measurements: list[dict]) -> dict:
    if len(rows) != len(measurements):
        raise ValueError("Measurement and prediction counts differ")
    scored = []
    for row, measurement in zip(rows, measurements):
        if row["status"] != measurement["status"]:
            raise ValueError("Measurement coverage does not match predictions")
        if row["status"] == "scored":
            if row["input_tokens"] != measurement["input_tokens"]:
                raise ValueError("Measurement token count does not match predictions")
            scored.append({**measurement, "document_id": row["document_id"]})
    if not scored:
        raise ValueError("No scored student decisions")

    def distribution(group: list[dict]) -> dict:
        result = {"examples": len(group), "documents": len({item["document_id"] for item in group})}
        for key in ("end_to_end_ms", "tokenization_ms", "gpu_forward_ms"):
            values = [item[key] for item in group if item[key] is not None]
            result[key] = {"p50": percentile(values, 0.5), "p95": percentile(values, 0.95),
                           "mean": sum(values) / len(values) if values else None}
        return result

    allocated = [item["gpu_peak_allocated_bytes"] for item in scored if item["gpu_peak_allocated_bytes"] is not None]
    reserved = [item["gpu_peak_reserved_bytes"] for item in scored if item["gpu_peak_reserved_bytes"] is not None]
    return {
        "overall": distribution(scored),
        "token_buckets": {f"{low}-{high}": distribution([item for item in scored if low <= item["input_tokens"] <= high])
                          for low, high in BUCKETS},
        "peak_gpu_allocated_bytes": max(allocated) if allocated else None,
        "peak_gpu_reserved_bytes": max(reserved) if reserved else None,
        "context_too_long": len(rows) - len(scored),
    }


def matched_teacher_comparison(student_rows: list[dict], teacher_rows: list[dict]) -> dict:
    teacher = {row["decision_id"]: row for row in teacher_rows}
    student = {row["decision_id"]: row for row in student_rows}
    if len(teacher) != len(teacher_rows) or len(student) != len(student_rows) or set(teacher) != set(student):
        raise ValueError("Student and teacher must cover identical development decision IDs")
    common = []
    for decision_id, row in student.items():
        other = teacher[decision_id]
        if row["gold"] != other["gold"] or row["document_id"] != other["document_id"]:
            raise ValueError("Student and teacher evaluation records differ")
        if row["status"] == "scored" and other["status"] == "scored":
            common.append((row, other))
    if not common:
        raise ValueError("No jointly scored student and teacher decisions")
    pairs = [(row, teacher[row["decision_id"]]) for row in student_rows]
    return {
        "matched_examples": len(common), "matched_documents": len({a["document_id"] for a, _ in common}),
        "student_correct": sum(a["prediction"] == a["gold"] for a, _ in common),
        "teacher_correct": sum(b["prediction"] == b["gold"] for _, b in common),
        "student_accuracy": sum(a["prediction"] == a["gold"] for a, _ in common) / len(common),
        "teacher_accuracy": sum(b["prediction"] == b["gold"] for _, b in common) / len(common),
        "teacher_scored_student_unscored": sum(a["status"] != "scored" and b["status"] == "scored" for a, b in pairs),
        "student_scored_teacher_unscored": sum(a["status"] == "scored" and b["status"] != "scored" for a, b in pairs),
    }


def matched_latency_comparison(student_rows: list[dict], measurements: list[dict], qwen_rows: list[dict]) -> dict:
    selected = [row for row in qwen_rows if row.get("model") == "lora"]
    qwen = {row["decision_id"]: row for row in selected}
    if (not qwen or len(qwen) != len(selected) or len(student_rows) != len(measurements) or
        len({row["decision_id"] for row in student_rows}) != len(student_rows) or
        set(qwen) != {row["decision_id"] for row in student_rows}):
        raise ValueError("Missing comparable latency measurements")
    student_ms, qwen_ms = [], []
    for row, measurement in zip(student_rows, measurements):
        other = qwen.get(row["decision_id"])
        if other is None:
            raise ValueError("Student decision is missing from the Qwen latency benchmark")
        if row["document_id"] != other["document_id"] or row["status"] != measurement["status"]:
            raise ValueError("Mismatched document or student measurement status")
        if row["status"] == "scored" and other["status"] == "scored":
            student_ms.append(measurement["end_to_end_ms"])
            qwen_ms.append(other["end_to_end_ms"])
    if not student_ms:
        raise ValueError("No jointly measured student and Qwen decisions")
    return {
        "matched_examples": len(student_ms),
        "student_p50_ms": percentile(student_ms, 0.5), "student_p95_ms": percentile(student_ms, 0.95),
        "qwen_p50_ms": percentile(qwen_ms, 0.5), "qwen_p95_ms": percentile(qwen_ms, 0.95),
        "note": "Same source decisions and GPU type, but separate jobs and different tokenizers/prompts.",
    }

"""Measure the untuned and LoRA Qwen decision models on the same dev inputs."""

from __future__ import annotations

import json
import os
from pathlib import Path
import time

from sova_bench.measure import measure_request
from sova_bench.metrics import BUCKETS, summarize
from sova_data import ContractNLILoader
from sova_model import QwenDecisionModel
from sova_model.scorer import DEFAULT_MODEL, DEFAULT_REVISION

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "reports/sova-legal-base-20261108-200636-8045d4/baseline-predictions.jsonl"
TUNED = ROOT / "reports/sova-legal-lora-20261109-061959-54ad8d/tuned-predictions.jsonl"
ADAPTER = ROOT / "reports/sova-legal-lora-20261109-061959-54ad8d/adapter"
OUT = Path("/opt/ml/model")


def read_references(path: Path) -> dict[str, dict]:
    with path.open(encoding="utf-8") as file:
        rows = [json.loads(line) for line in file if line.strip()]
    by_id = {row["decision_id"]: row for row in rows}
    if len(by_id) != len(rows) or len(rows) != 1037:
        raise ValueError("Saved dev references are incomplete or contain duplicate IDs")
    return by_id


def run_variant(name: str, scorer, examples: list, references: dict[str, dict]) -> tuple[dict, list[dict]]:
    import torch

    if set(references) != {example.decision_id for example in examples}:
        raise ValueError("Saved and current development decision IDs differ")
    warmups = []
    for low, high in BUCKETS:
        sample = next((example for example in examples
                       if references[example.decision_id].get("status") == "scored"
                       and low <= references[example.decision_id]["input_tokens"] <= high), None)
        if sample is not None:
            warmups.append(sample)
    for sample in warmups:
        measure_request(scorer, sample, references[sample.decision_id]["prediction"])
    torch.cuda.synchronize()
    resident_allocated = torch.cuda.memory_allocated()
    resident_reserved = torch.cuda.memory_reserved()
    rows = []
    for example in examples:
        original = references[example.decision_id]
        row = measure_request(scorer, example, original.get("prediction"))
        if row["status"] != original["status"] or row["document_id"] != original["document_id"]:
            raise ValueError("Benchmark coverage or document IDs differ from saved evaluation")
        if row["status"] == "scored" and row["input_tokens"] != original["input_tokens"]:
            raise ValueError("Token count differs from saved evaluation")
        rows.append(row)
        if len(rows) % 100 == 0:
            print(f"{name}: {len(rows)}/{len(examples)} processed", flush=True)
    summary = summarize(rows)
    if summary["scored_requests"] != 901 or summary["context_too_long"] != 136:
        raise ValueError("Unexpected development coverage")
    summary.update({"name": name, "warmup_requests": len(warmups),
                    "resident_gpu_allocated_bytes": resident_allocated,
                    "resident_gpu_reserved_bytes": resident_reserved})
    return summary, rows


def main() -> None:
    os.environ["HF_HOME"] = "/opt/ml/huggingface"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    import torch
    from huggingface_hub import snapshot_download
    from peft import PeftModel

    if not torch.cuda.is_available():
        raise RuntimeError("The benchmark worker does not have a CUDA GPU")
    OUT.mkdir(parents=True, exist_ok=True)
    print(f"GPU: {torch.cuda.get_device_name(0)}; torch {torch.__version__}", flush=True)
    snapshot_download(DEFAULT_MODEL, revision=DEFAULT_REVISION,
                      allow_patterns=["*.json", "*.safetensors", "merges.txt", "vocab.json"])
    started = time.perf_counter()
    scorer = QwenDecisionModel.load_local(device="cuda", max_input_tokens=4096)
    torch.cuda.synchronize()
    base_load_ms = (time.perf_counter() - started) * 1000
    loader = ContractNLILoader()
    examples = list(loader.iter_split("dev"))
    if len(examples) != 1037 or len({example.document_id for example in examples}) != 61:
        raise ValueError("Unexpected development dataset")
    baseline, baseline_rows = run_variant("base", scorer, examples, read_references(BASELINE))
    started = time.perf_counter()
    tuned_model = PeftModel.from_pretrained(scorer.model, ADAPTER, is_trainable=False)
    tuned_model.eval()
    torch.cuda.synchronize()
    adapter_load_ms = (time.perf_counter() - started) * 1000
    tuned_scorer = QwenDecisionModel(scorer.tokenizer, tuned_model, device="cuda", max_input_tokens=4096)
    tuned, tuned_rows = run_variant("lora", tuned_scorer, examples, read_references(TUNED))
    if {row["decision_id"]: row["status"] for row in baseline_rows} != {
        row["decision_id"]: row["status"] for row in tuned_rows
    }:
        raise ValueError("Baseline and LoRA coverage differ")
    summary = {
        "dataset": "ContractNLI", "split": "official dev", "test_labels_loaded": False,
        "model": DEFAULT_MODEL, "model_revision": DEFAULT_REVISION,
        "base_dtype": "float16", "adapter_dtype": "float32", "max_input_tokens": 4096,
        "batch_size": 1, "gpu_name": torch.cuda.get_device_name(0),
        "gpu_total_bytes": torch.cuda.get_device_properties(0).total_memory,
        "torch_version": torch.__version__, "cuda_version": torch.version.cuda,
        "base_model_load_ms": base_load_ms, "adapter_load_ms": adapter_load_ms,
        "base": baseline, "lora": tuned,
        "limitations": [
            "In-process warm timings include prompt construction, tokenization, device transfers, inference and reading scores.",
            "PDF extraction, HTTP, network, model load and queuing are not included in per-request timing.",
            "GPU forward uses synchronized CUDA events; PyTorch allocator memory excludes CUDA context and other processes.",
            "The baseline ran before the LoRA adapter in the same process; allocator reserved memory may carry over.",
            "136 long development decisions were rejected, not truncated or included in latency percentiles.",
            "Token buckets contain repeated questions on 61 contracts; results are not a customer performance guarantee.",
        ],
    }
    (OUT / "benchmark-summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    with (OUT / "benchmark-rows.jsonl").open("w", encoding="utf-8") as file:
        for name, rows in (("base", baseline_rows), ("lora", tuned_rows)):
            for row in rows:
                file.write(json.dumps({"model": name, **row}, sort_keys=True) + "\n")
    print("Benchmark summary:", json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()

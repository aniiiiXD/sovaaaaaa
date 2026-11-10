"""One capped SageMaker job: train a LoRA adapter, then score dev once."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
import random
import time

from sova_data import ContractNLILoader
from sova_model import QwenDecisionModel
from sova_model.scorer import DEFAULT_MODEL, DEFAULT_REVISION
from sova_eval.baseline import evaluate
from sova_eval.collect_sagemaker import verify_results
from sova_train.decision import compare_paired, decision_loss, prepare_training_examples

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "reports/sova-legal-base-20261108-200636-8045d4"
OUT = Path("/opt/ml/model")
CHECKPOINTS = Path("/opt/ml/checkpoints")
SEED = 20261109
MAX_TOKENS = 4096
ACCUMULATION = 8
LEARNING_RATE = 1e-4


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as file:
        return [json.loads(line) for line in file if line.strip()]


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def save_adapter(model, target: Path, *, step: int, trained_examples: int) -> None:
    target.mkdir(parents=True, exist_ok=False)
    model.save_pretrained(target, safe_serialization=True)
    # Written last: an interrupted snapshot without this file is incomplete.
    write_json(target / "sova-checkpoint.json", {
        "optimizer_steps": step, "trained_examples": trained_examples,
        "base_model": DEFAULT_MODEL, "base_revision": DEFAULT_REVISION,
        "resumable_optimizer_state": False,
    })


def main() -> None:
    os.environ["HF_HOME"] = "/opt/ml/huggingface"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    import torch
    from huggingface_hub import snapshot_download
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import get_linear_schedule_with_warmup

    if not torch.cuda.is_available():
        raise RuntimeError("SageMaker did not provide a CUDA GPU")
    OUT.mkdir(parents=True, exist_ok=True)
    CHECKPOINTS.mkdir(parents=True, exist_ok=True)
    random.seed(SEED)
    torch.manual_seed(SEED)
    torch.cuda.manual_seed_all(SEED)
    start = time.monotonic()
    print(f"GPU: {torch.cuda.get_device_name(0)}; torch {torch.__version__}", flush=True)
    snapshot_download(DEFAULT_MODEL, revision=DEFAULT_REVISION,
                      allow_patterns=["*.json", "*.safetensors", "merges.txt", "vocab.json"])
    scorer = QwenDecisionModel.load_local(device="cuda", max_input_tokens=MAX_TOKENS)
    loader = ContractNLILoader()
    items, data_report = prepare_training_examples(loader.iter_split("train"), scorer.tokenizer, MAX_TOKENS)
    if data_report["total_examples"] != 7140 or data_report["total_documents"] != 420:
        raise RuntimeError("Unexpected clean training dataset size; refusing to train")
    print("Training data:", json.dumps({k: v for k, v in data_report.items() if k != "skipped_decision_ids"}), flush=True)

    config = LoraConfig(
        task_type=TaskType.CAUSAL_LM, r=8, lora_alpha=16, lora_dropout=0.05,
        target_modules=["q_proj", "v_proj"], bias="none",
    )
    model = get_peft_model(scorer.model, config)
    model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.config.use_cache = False
    model.train()
    trainable = [parameter for parameter in model.parameters() if parameter.requires_grad]
    if not trainable or any(parameter.dtype != torch.float32 for parameter in trainable):
        raise RuntimeError("LoRA trainable parameters must exist and remain float32")
    trainable_count = sum(parameter.numel() for parameter in trainable)
    print(f"Trainable LoRA parameters: {trainable_count:,}", flush=True)
    optimizer = torch.optim.AdamW(trainable, lr=LEARNING_RATE, weight_decay=0.01)
    total_steps = math.ceil(len(items) / ACCUMULATION)
    warmup_steps = max(1, int(total_steps * 0.05))
    scheduler = get_linear_schedule_with_warmup(optimizer, warmup_steps, total_steps)
    # A conservative initial scale avoids a large first-step FP16 overflow.
    scaler = torch.cuda.amp.GradScaler(init_scale=256.0)
    order = list(range(len(items)))
    random.Random(SEED).shuffle(order)
    total_loss = 0.0
    trained_examples = 0
    for offset in range(0, len(order), ACCUMULATION):
        group = order[offset:offset + ACCUMULATION]
        optimizer.zero_grad(set_to_none=True)
        for index in group:
            with torch.autocast(device_type="cuda", dtype=torch.float16):
                loss = decision_loss(model, items[index], "cuda")
            loss_value = float(loss.detach().item())
            if not math.isfinite(loss_value):
                raise RuntimeError("Non-finite training loss; stopping")
            scaler.scale(loss / len(group)).backward()
            total_loss += loss_value
            trained_examples += 1
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(trainable, max_norm=1.0, error_if_nonfinite=True)
        scaler.step(optimizer)
        scaler.update()
        scheduler.step()
        step = offset // ACCUMULATION + 1
        if step % 25 == 0 or step == total_steps:
            print(f"step {step}/{total_steps}; examples {trained_examples}/{len(items)}; "
                  f"mean_loss {total_loss / trained_examples:.4f}; elapsed {time.monotonic() - start:.0f}s", flush=True)
        if step % 100 == 0:
            save_adapter(model, CHECKPOINTS / f"step-{step:05d}", step=step, trained_examples=trained_examples)

    save_adapter(model, OUT / "adapter", step=total_steps, trained_examples=trained_examples)
    scorer = QwenDecisionModel(scorer.tokenizer, model, device="cuda", max_input_tokens=MAX_TOKENS)

    def progress(total: int, scored: int) -> None:
        if total % 25 == 0:
            print(f"dev progress: {total} processed, {scored} scored", flush=True)

    summary, rows = evaluate(loader.iter_split("dev"), scorer, progress)
    summary.update({
        "dataset": "ContractNLI", "split": "official dev", "model": DEFAULT_MODEL,
        "model_revision": DEFAULT_REVISION, "backend": "transformers+peft",
        "weight_dtype": "float16 base / float32 LoRA", "device": "cuda",
        "max_input_tokens": MAX_TOKENS, "training_performed": True,
        "test_labels_loaded": False, "test_examples_scored": False,
        "elapsed_seconds": time.monotonic() - start,
        "notes": [
            "Same prompt, model revision, precision, context limit and development examples as the pretrained baseline.",
            "Decision scores are not calibrated; dev has repeated statements per document.",
            "Long examples are unscored; no input truncation was used.",
            "Exact document split isolation was checked; near duplicates and pretraining exposure remain unverified.",
        ],
    })
    verify_results(summary, rows, expected_examples=1037)
    base_summary = json.loads((BASELINE / "baseline-summary.json").read_text(encoding="utf-8"))
    base_rows = read_jsonl(BASELINE / "baseline-predictions.jsonl")
    verify_results(base_summary, base_rows, expected_examples=1037)
    if (base_summary["model_revision"] != DEFAULT_REVISION or
        base_summary["max_input_tokens"] != MAX_TOKENS or base_summary["weight_dtype"] != "float16"):
        raise RuntimeError("Baseline setup does not match the training experiment")
    comparison = compare_paired(base_rows, rows)
    comparison["baseline_macro_f1_all_examples"] = base_summary["macro_f1_all_examples"]
    comparison["tuned_macro_f1_all_examples"] = summary["macro_f1_all_examples"]
    comparison["baseline_per_class"] = base_summary["per_class"]
    comparison["tuned_per_class"] = summary["per_class"]
    manifest = {
        "base_model": DEFAULT_MODEL, "base_revision": DEFAULT_REVISION, "seed": SEED,
        "dataset": "ContractNLI train_clean", "epochs": 1, "data": data_report,
        "trainable_parameters": trainable_count, "trained_examples": trained_examples,
        "optimizer_steps": total_steps, "batch_size": 1, "gradient_accumulation": ACCUMULATION,
        "optimizer": "AdamW", "learning_rate": LEARNING_RATE, "weight_decay": 0.01,
        "scheduler": "linear warmup then linear decay", "warmup_steps": warmup_steps,
        "lora_rank": 8, "lora_alpha": 16, "lora_dropout": 0.05,
        "lora_target_modules": ["q_proj", "v_proj"], "base_dtype": "float16",
        "adapter_dtype": "float32", "gradient_checkpointing": True,
        "mean_training_loss": total_loss / trained_examples,
        "gpu": torch.cuda.get_device_name(0), "torch_version": torch.__version__,
        "test_labels_loaded": False,
    }
    write_json(OUT / "training-manifest.json", manifest)
    write_json(OUT / "tuned-summary.json", summary)
    write_json(OUT / "comparison.json", comparison)
    with (OUT / "tuned-predictions.jsonl").open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
    print("Final comparison:", json.dumps(comparison, indent=2), flush=True)


if __name__ == "__main__":
    main()

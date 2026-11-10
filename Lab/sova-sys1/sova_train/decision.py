"""Prepare legal decisions and compute the exact three-choice training loss."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from sova_data import DecisionExample
from sova_data.loader import LABELS
from sova_model import ContextTooLongError, encode_model_input


@dataclass(frozen=True)
class TrainingItem:
    decision_id: str
    document_id: str
    input_ids: tuple[int, ...]
    choice_token_ids: tuple[int, ...]
    label_index: int


def prepare_training_examples(
    examples: Iterable[DecisionExample], tokenizer: object, max_input_tokens: int,
) -> tuple[list[TrainingItem], dict]:
    """Encode only training records; skip, count and report over-limit documents."""
    items: list[TrainingItem] = []
    seen: set[str] = set()
    all_docs: set[str] = set()
    skipped_docs: set[str] = set()
    skipped_by_label: Counter[str] = Counter()
    usable_by_label: Counter[str] = Counter()
    skipped_ids: list[str] = []
    for example in examples:
        if not example.decision_id.startswith("contractnli:train:"):
            raise ValueError("Only ContractNLI training decisions may be used to train")
        if example.decision_id in seen:
            raise ValueError(f"Duplicate training decision: {example.decision_id}")
        seen.add(example.decision_id)
        all_docs.add(example.document_id)
        label = example.target.label
        if label not in LABELS:
            raise ValueError(f"Unexpected label: {label!r}")
        try:
            encoded = encode_model_input(tokenizer, example.model_input, max_input_tokens)
        except ContextTooLongError:
            skipped_docs.add(example.document_id)
            skipped_by_label[label] += 1
            skipped_ids.append(example.decision_id)
            continue
        if encoded.labels != LABELS:
            raise ValueError("Encoded label order does not match the dataset")
        items.append(TrainingItem(
            example.decision_id, example.document_id, encoded.input_ids,
            encoded.choice_token_ids, LABELS.index(label),
        ))
        usable_by_label[label] += 1
    if not items:
        raise ValueError("No training examples fit the configured context window")
    return items, {
        "total_examples": len(seen), "total_documents": len(all_docs),
        "usable_examples": len(items), "usable_documents": len({item.document_id for item in items}),
        "skipped_context_examples": len(skipped_ids), "skipped_context_documents": len(skipped_docs),
        "usable_by_label": {label: usable_by_label[label] for label in LABELS},
        "skipped_by_label": {label: skipped_by_label[label] for label in LABELS},
        "skipped_decision_ids": skipped_ids, "max_input_tokens": max_input_tokens,
    }


def decision_loss(model: object, item: TrainingItem, device: str):
    """Cross-entropy over the same next-token choices used by the baseline."""
    import torch
    import torch.nn.functional as functional

    input_ids = torch.tensor([item.input_ids], dtype=torch.long, device=device)
    result = model(input_ids=input_ids, attention_mask=torch.ones_like(input_ids),
                   logits_to_keep=1, use_cache=False, return_dict=True)
    logits = result.logits
    if logits.ndim != 3 or logits.shape[0] != 1 or logits.shape[1] != 1:
        raise RuntimeError("Unexpected training logits shape")
    if min(item.choice_token_ids) < 0 or max(item.choice_token_ids) >= logits.shape[-1]:
        raise RuntimeError("Decision token ID is outside the model vocabulary")
    selected = logits[0, 0, list(item.choice_token_ids)].float().unsqueeze(0)
    label = torch.tensor([item.label_index], dtype=torch.long, device=device)
    return functional.cross_entropy(selected, label)


def compare_paired(baseline_rows: list[dict], tuned_rows: list[dict]) -> dict:
    """Compare only identical examples with identical context coverage."""
    def indexed(rows: list[dict]) -> dict[str, dict]:
        result = {row["decision_id"]: row for row in rows}
        if len(result) != len(rows):
            raise ValueError("Duplicate development prediction IDs")
        return result

    before = indexed(baseline_rows)
    after = indexed(tuned_rows)
    if not before or set(before) != set(after):
        raise ValueError("Baseline and tuned development examples differ")
    baseline_correct = tuned_correct = improved = regressed = 0
    scored = 0
    for decision_id, original in before.items():
        updated = after[decision_id]
        for field in ("document_id", "gold", "status"):
            if original.get(field) != updated.get(field):
                raise ValueError(f"Baseline and tuned {field} differ for {decision_id}")
        if original["status"] == "context_too_long":
            continue
        if original["status"] != "scored" or original.get("input_tokens") != updated.get("input_tokens"):
            raise ValueError(f"Unexpected status or token count for {decision_id}")
        scored += 1
        old_correct = original["prediction"] == original["gold"]
        new_correct = updated["prediction"] == updated["gold"]
        baseline_correct += old_correct
        tuned_correct += new_correct
        improved += int(not old_correct and new_correct)
        regressed += int(old_correct and not new_correct)
    if not scored:
        raise ValueError("No shared scored examples")
    return {
        "all_examples": len(before), "matched_scored_examples": scored,
        "baseline_correct": baseline_correct, "tuned_correct": tuned_correct,
        "baseline_accuracy": baseline_correct / scored, "tuned_accuracy": tuned_correct / scored,
        "accuracy_delta_percentage_points": 100 * (tuned_correct - baseline_correct) / scored,
        "improved_examples": improved, "regressed_examples": regressed,
    }

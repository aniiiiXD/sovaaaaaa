"""Evaluate decision scores without passing the gold answer to the model."""

from __future__ import annotations

from collections.abc import Callable, Iterable
import math
from typing import Protocol

from sova_data import DecisionExample, ModelInput
from sova_data.loader import LABELS
from sova_model import ContextTooLongError, DecisionScores

UNSCORED = "Unscored"


class Scorer(Protocol):
    def score(self, model_input: ModelInput) -> DecisionScores: ...


def evaluate(
    examples: Iterable[DecisionExample],
    scorer: Scorer,
    on_progress: Callable[[int, int], None] | None = None,
) -> tuple[dict, list[dict]]:
    """Evaluate all provided examples; too-long examples remain in denominators."""
    confusion = {gold: {prediction: 0 for prediction in (*LABELS, UNSCORED)} for gold in LABELS}
    rows = []
    brier_sum = 0.0
    scored = 0
    correct = 0
    seen: set[str] = set()
    for example in examples:
        if example.decision_id in seen:
            raise ValueError(f"Duplicate evaluation example: {example.decision_id}")
        seen.add(example.decision_id)
        gold = example.target.label
        if gold not in LABELS:
            raise ValueError("Gold label is not a supported choice")
        try:
            # Only the explicitly separated input object goes to the scorer.
            result = scorer.score(example.model_input)
        except ContextTooLongError:
            confusion[gold][UNSCORED] += 1
            rows.append({
                "decision_id": example.decision_id, "document_id": example.document_id,
                "gold": gold, "prediction": None, "scores": None, "status": "context_too_long",
            })
        else:
            probs = result.probabilities
            if (set(probs) != set(LABELS) or
                any(not math.isfinite(probs[label]) or probs[label] < 0 or probs[label] > 1 for label in LABELS) or
                abs(sum(probs.values()) - 1.0) > 1e-5):
                raise ValueError("Model returned invalid scores")
            prediction = result.predicted_label
            if prediction not in LABELS or prediction != max(LABELS, key=probs.__getitem__):
                raise ValueError("Predicted label does not match scores")
            scored += 1
            correct += int(prediction == gold)
            confusion[gold][prediction] += 1
            brier_sum += sum((probs[label] - float(label == gold)) ** 2 for label in LABELS)
            rows.append({
                "decision_id": example.decision_id, "document_id": example.document_id,
                "gold": gold, "prediction": prediction, "scores": dict(probs),
                "input_tokens": result.input_tokens, "status": "scored",
            })
        if on_progress:
            on_progress(len(rows), scored)
    if not rows:
        raise ValueError("Evaluation dataset is empty")

    per_class = {}
    for label in LABELS:
        tp = confusion[label][label]
        support = sum(confusion[label].values())
        predicted = sum(confusion[other][label] for other in LABELS)
        precision = tp / predicted if predicted else 0.0
        recall = tp / support if support else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {"support": support, "predicted": predicted, "correct": tp,
                            "precision": precision, "recall": recall, "f1": f1}
    total = len(rows)
    return {
        "examples": total, "documents": len({row["document_id"] for row in rows}),
        "scored": scored, "unscored_context_too_long": total - scored,
        "correct": correct, "coverage": scored / total,
        "accuracy_all_examples": correct / total,
        "accuracy_scored_examples": correct / scored if scored else None,
        "macro_f1_all_examples": sum(item["f1"] for item in per_class.values()) / len(LABELS),
        "brier_scored_examples": brier_sum / scored if scored else None,
        "per_class": per_class, "confusion": confusion,
        "score_calibrated": False,
    }, rows

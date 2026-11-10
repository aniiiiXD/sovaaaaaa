from __future__ import annotations

import unittest
from pathlib import Path
import tarfile
import tempfile

from sova_data import DecisionExample, GoldTarget, ModelInput
from sova_data.loader import LABELS
from sova_eval.baseline import evaluate
from sova_eval.collect_sagemaker import verify_results
from sova_eval.submit_sagemaker import ENTRYPOINT, ROOT, package
from sova_model import ContextTooLongError, DecisionScores


def example(name: str, label: str) -> DecisionExample:
    return DecisionExample(
        decision_id=name, document_id="doc-" + name, source_file=None,
        model_input=ModelInput(contract=name, statement="statement", choices=LABELS),
        target=GoldTarget(label=label, evidence=()),
    )


class FakeScorer:
    def score(self, model_input: ModelInput) -> DecisionScores:
        if not isinstance(model_input, ModelInput) or hasattr(model_input, "target"):
            raise AssertionError("A gold target was passed to the model")
        if model_input.contract == "long":
            raise ContextTooLongError("too long")
        scores = {
            "correct-e": (0.8, 0.1, 0.1),
            "wrong-c": (0.7, 0.2, 0.1),
            "correct-n": (0.1, 0.2, 0.7),
        }[model_input.contract]
        probabilities = dict(zip(LABELS, scores))
        return DecisionScores(probabilities, max(LABELS, key=probabilities.__getitem__), 10, "cpu")


class BaselineTests(unittest.TestCase):
    def test_accuracy_per_class_coverage_and_unscored_denominators(self) -> None:
        examples = [example("correct-e", "Entailment"), example("wrong-c", "Contradiction"),
                    example("correct-n", "NotMentioned"), example("long", "Entailment")]
        seen_progress = []
        summary, rows = evaluate(examples, FakeScorer(), lambda total, scored: seen_progress.append((total, scored)))
        self.assertEqual((summary["examples"], summary["scored"], summary["correct"]), (4, 3, 2))
        self.assertEqual(summary["accuracy_all_examples"], 0.5)
        self.assertAlmostEqual(summary["accuracy_scored_examples"], 2 / 3)
        self.assertEqual(summary["coverage"], 0.75)
        self.assertAlmostEqual(summary["macro_f1_all_examples"], 0.5)
        self.assertAlmostEqual(summary["brier_scored_examples"], 1.34 / 3)
        self.assertEqual(summary["confusion"]["Entailment"]["Unscored"], 1)
        self.assertEqual(summary["confusion"]["Contradiction"]["Entailment"], 1)
        self.assertEqual(rows[-1]["status"], "context_too_long")
        self.assertEqual(seen_progress[-1], (4, 3))

    def test_invalid_scores_do_not_turn_into_accuracy(self) -> None:
        class InvalidScorer:
            def score(self, model_input):
                return DecisionScores(dict(zip(LABELS, (float("nan"), 0.1, 0.1))), "Entailment", 3, "cpu")
        with self.assertRaisesRegex(ValueError, "invalid scores"):
            evaluate([example("a", "Entailment")], InvalidScorer())

    def test_scorer_errors_are_not_silently_skipped(self) -> None:
        class BrokenScorer:
            def score(self, model_input):
                raise RuntimeError("model failure")
        with self.assertRaisesRegex(RuntimeError, "model failure"):
            evaluate([example("a", "Entailment")], BrokenScorer())

    def test_collected_results_are_independently_checked(self) -> None:
        summary, rows = evaluate([
            example("correct-e", "Entailment"), example("wrong-c", "Contradiction"),
            example("correct-n", "NotMentioned"), example("long", "Entailment"),
        ], FakeScorer())
        summary.update({"split": "official dev", "test_examples_scored": False})
        for row in rows:
            row["decision_id"] = "contractnli:dev:" + row["decision_id"]
        verify_results(summary, rows)
        summary["correct"] = 3
        with self.assertRaisesRegex(ValueError, "counts"):
            verify_results(summary, rows)

    def test_duplicate_decisions_and_empty_evaluation_are_rejected(self) -> None:
        item = example("correct-e", "Entailment")
        with self.assertRaisesRegex(ValueError, "Duplicate evaluation"):
            evaluate([item, item], FakeScorer())
        with self.assertRaisesRegex(ValueError, "empty"):
            evaluate([], FakeScorer())

    @unittest.skipUnless((ROOT / "datasets/processed/contractnli/decisions/dev.jsonl").exists(), "Prepared data unavailable")
    def test_cloud_bundle_contains_validation_labels_only(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bundle.tar.gz"
            names = package(path)
            with tarfile.open(path) as archive:
                self.assertEqual(set(archive.getnames()), set(names))
            labels = [name for name in names if "/decisions/" in name]
            self.assertEqual(labels, ["datasets/processed/contractnli/decisions/dev.jsonl"])
            self.assertFalse(any(".venv/" in name for name in names))
            self.assertIn("sova_eval/bootstrap.sh", names)
            self.assertLessEqual(len(ENTRYPOINT), 256)


if __name__ == "__main__":
    unittest.main()

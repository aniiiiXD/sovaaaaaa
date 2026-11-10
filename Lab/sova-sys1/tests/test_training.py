"""CPU fixtures for the legal decision training and paired evaluation."""

from __future__ import annotations

import copy
import tempfile
from pathlib import Path
import tarfile
import unittest
from unittest import mock

from sova_data import DecisionExample, GoldTarget, ModelInput
from sova_data.loader import LABELS
from sova_train.decision import compare_paired, decision_loss, prepare_training_examples
from sova_train import submit_sagemaker

try:
    import torch
except ImportError:
    torch = None

try:
    from peft import LoraConfig, PeftModel, TaskType, get_peft_model
    from transformers import Qwen3Config, Qwen3ForCausalLM
except ImportError:
    get_peft_model = None


class FakeTokenizer:
    def apply_chat_template(self, messages, **kwargs):
        return "long" if "LONG_DOCUMENT" in messages[1]["content"] else "short"

    def encode(self, value, add_special_tokens=False):
        prefix = list(range(1, 21 if value.startswith("long") else 4))
        if value.endswith("Decision:"):
            return prefix
        for index, letter in enumerate("ABC"):
            if value.endswith("Decision: " + letter):
                return prefix + [25 + index]
        return prefix + [90, 91]


def example(number: int, label: str, *, long: bool = False, split: str = "train") -> DecisionExample:
    return DecisionExample(
        decision_id=f"contractnli:{split}:{number}:nda-1", document_id=str(number), source_file=None,
        model_input=ModelInput("LONG_DOCUMENT" if long else "A contract", "A statement", LABELS),
        target=GoldTarget(label, ()),
    )


def row(number, gold, prediction, *, status="scored", tokens=3):
    return {"decision_id": str(number), "document_id": str(number), "gold": gold,
            "prediction": prediction, "status": status, "input_tokens": tokens}


class DataPreparationTests(unittest.TestCase):
    def test_preserves_targets_and_counts_long_documents_without_truncation(self):
        examples = [example(1, "Contradiction"), example(2, "NotMentioned", long=True)]
        items, report = prepare_training_examples(examples, FakeTokenizer(), max_input_tokens=5)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].label_index, 1)
        self.assertEqual(items[0].choice_token_ids, (25, 26, 27))
        self.assertEqual(report["total_examples"], 2)
        self.assertEqual(report["usable_by_label"]["Contradiction"], 1)
        self.assertEqual(report["skipped_by_label"]["NotMentioned"], 1)
        self.assertEqual(report["skipped_context_documents"], 1)

    def test_refuses_dev_or_duplicate_decisions(self):
        with self.assertRaisesRegex(ValueError, "training decisions"):
            prepare_training_examples([example(1, "Entailment", split="dev")], FakeTokenizer(), 5)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            prepare_training_examples([example(1, "Entailment"), example(1, "Entailment")], FakeTokenizer(), 5)

    def test_refuses_empty_usable_set(self):
        with self.assertRaisesRegex(ValueError, "No training examples"):
            prepare_training_examples([example(1, "Entailment", long=True)], FakeTokenizer(), 5)


@unittest.skipIf(torch is None, "PyTorch is not installed")
class DecisionLossTests(unittest.TestCase):
    def test_gradient_reinforces_gold_choice_without_using_other_vocab_logits(self):
        items, _ = prepare_training_examples([example(1, "Contradiction")], FakeTokenizer(), 5)

        class TinyModel(torch.nn.Module):
            def __init__(self):
                super().__init__()
                self.logits = torch.nn.Parameter(torch.zeros(32))

            def forward(self, **kwargs):
                self.assert_no_labels = "labels" not in kwargs
                return type("Output", (), {"logits": self.logits.reshape(1, 1, -1)})()

        model = TinyModel()
        loss = decision_loss(model, items[0], "cpu")
        loss.backward()
        self.assertTrue(model.assert_no_labels)
        self.assertLess(model.logits.grad[26].item(), 0)
        self.assertGreater(model.logits.grad[25].item(), 0)
        self.assertGreater(model.logits.grad[27].item(), 0)
        self.assertEqual(model.logits.grad[0].item(), 0)


@unittest.skipIf(torch is None or get_peft_model is None, "PyTorch and PEFT are required")
class RealLoraSmokeTests(unittest.TestCase):
    def test_tiny_qwen_trains_saves_and_reloads_the_same_decision_scores(self):
        torch.manual_seed(12)
        config = Qwen3Config(vocab_size=32, hidden_size=16, intermediate_size=32,
                             num_hidden_layers=2, num_attention_heads=2,
                             num_key_value_heads=1, head_dim=8, max_position_embeddings=64)
        base = Qwen3ForCausalLM(config)
        fresh_base = copy.deepcopy(base)
        model = get_peft_model(base, LoraConfig(task_type=TaskType.CAUSAL_LM, r=2, lora_alpha=4,
                                                target_modules=["q_proj", "v_proj"], lora_dropout=0.05))
        model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
        model.config.use_cache = False
        model.train()
        trainable = [parameter for parameter in model.parameters() if parameter.requires_grad]
        before = [parameter.detach().clone() for parameter in trainable]
        items, _ = prepare_training_examples([example(1, "Contradiction")], FakeTokenizer(), 5)
        loss = decision_loss(model, items[0], "cpu")
        loss.backward()
        optimizer = torch.optim.AdamW(trainable, lr=0.01)
        optimizer.step()
        self.assertTrue(torch.isfinite(loss).item())
        self.assertTrue(any(not torch.equal(old, new) for old, new in zip(before, trainable)))
        model.eval()
        input_ids = torch.tensor([items[0].input_ids], dtype=torch.long)
        with torch.inference_mode():
            expected = model(input_ids=input_ids, logits_to_keep=1, use_cache=False).logits
        with tempfile.TemporaryDirectory() as temporary:
            model.save_pretrained(temporary, safe_serialization=True)
            restored = PeftModel.from_pretrained(fresh_base, temporary)
            restored.eval()
            with torch.inference_mode():
                actual = restored(input_ids=input_ids, logits_to_keep=1, use_cache=False).logits
        self.assertTrue(torch.allclose(expected, actual, atol=1e-6, rtol=1e-6))


class PairComparisonTests(unittest.TestCase):
    def test_counts_improvements_and_regressions_on_same_examples(self):
        before = [row(1, "Entailment", "Contradiction"), row(2, "NotMentioned", "NotMentioned"),
                  row(3, "Contradiction", None, status="context_too_long")]
        after = [row(1, "Entailment", "Entailment"), row(2, "NotMentioned", "Entailment"),
                 row(3, "Contradiction", None, status="context_too_long")]
        result = compare_paired(before, after)
        self.assertEqual(result["matched_scored_examples"], 2)
        self.assertEqual(result["improved_examples"], 1)
        self.assertEqual(result["regressed_examples"], 1)
        self.assertEqual(result["accuracy_delta_percentage_points"], 0)

    def test_rejects_changed_coverage_gold_and_prompt_length(self):
        before = [row(1, "Entailment", "Entailment")]
        for after in ([row(1, "Entailment", None, status="context_too_long")],
                      [row(1, "Contradiction", "Entailment")],
                      [row(1, "Entailment", "Entailment", tokens=4)],
                      [row(2, "Entailment", "Entailment")]):
            with self.subTest(after=after), self.assertRaises(ValueError):
                compare_paired(before, after)


class PackagingTests(unittest.TestCase):
    def test_package_contains_train_and_dev_but_not_test_labels(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            paths = ["datasets/processed/contractnli/decisions/train_clean.jsonl",
                     "datasets/processed/contractnli/decisions/dev.jsonl"]
            for name in paths:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("{}\n", encoding="utf-8")
            for name in ("sova_data", "sova_model", "sova_eval", "sova_train"):
                (root / name).mkdir()
                (root / name / "__init__.py").write_text("", encoding="utf-8")
            bundle = root / "bundle.tar.gz"
            with mock.patch.object(submit_sagemaker, "ROOT", root), mock.patch.object(submit_sagemaker, "FILES", paths):
                hashes = submit_sagemaker.package(bundle)
            with tarfile.open(bundle) as archive:
                names = archive.getnames()
            self.assertIn(paths[0], names)
            self.assertIn(paths[1], names)
            self.assertNotIn("datasets/processed/contractnli/decisions/test.jsonl", names)
            self.assertEqual(set(hashes), set(names))


if __name__ == "__main__":
    unittest.main()

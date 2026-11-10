from __future__ import annotations

from pathlib import Path
import unittest
from unittest import mock

from sova_data import ContractNLILoader, ModelInput
from sova_data.loader import LABELS
from sova_model import (
    ContextTooLongError, MLXQwenDecisionModel, PromptEncodingError,
    QwenDecisionModel, encode_model_input,
)
from sova_model.__main__ import resolve_backend

try:
    import torch
except ImportError:
    torch = None

try:
    import mlx.core as mx
except ImportError:
    mx = None


class FakeTokenizer:
    def __init__(self, *, mode: str = "normal", prefix_size: int = 3) -> None:
        self.mode = mode
        self.prefix_size = prefix_size
        self.messages = None

    def apply_chat_template(self, messages, **kwargs):
        self.messages = messages
        if kwargs != {"tokenize": False, "add_generation_prompt": True, "enable_thinking": False}:
            raise AssertionError("Unexpected chat-template settings")
        return "PROMPT"

    def encode(self, text, add_special_tokens=False):
        if add_special_tokens:
            raise AssertionError("Unexpected special token handling")
        prefix = list(range(1, self.prefix_size + 1))
        if text == "PROMPTDecision:":
            return prefix
        for offset, letter in enumerate("ABC"):
            if text == "PROMPTDecision: " + letter:
                if self.mode == "multiple":
                    return prefix + [10 + offset, 19]
                if self.mode == "collision":
                    return prefix + [10]
                if self.mode == "boundary":
                    return prefix[:-1] + [10 + offset]
                return prefix + [10 + offset]
        return prefix + [1, 2]


class PromptTests(unittest.TestCase):
    def setUp(self) -> None:
        self.example = ModelInput("Full contract text.\nSecond paragraph.", "The statement.", LABELS)

    def test_prompt_preserves_contract_and_correct_label_order(self) -> None:
        tokenizer = FakeTokenizer()
        encoded = encode_model_input(tokenizer, self.example, 10)
        self.assertEqual(encoded.input_ids, (1, 2, 3))
        self.assertEqual(encoded.choice_token_ids, (10, 11, 12))
        self.assertEqual(encoded.labels, LABELS)
        self.assertIn("Full contract text.\\nSecond paragraph.", tokenizer.messages[1]["content"])
        self.assertNotIn("gold_label", tokenizer.messages[1]["content"])
        self.assertNotIn("evidence_span_indices", tokenizer.messages[1]["content"])

    def test_full_example_cannot_be_passed_as_model_input(self) -> None:
        with self.assertRaisesRegex(TypeError, "example.model_input"):
            encode_model_input(FakeTokenizer(), object(), 10)

    def test_too_long_is_rejected_without_truncation(self) -> None:
        with self.assertRaisesRegex(ContextTooLongError, "needs 3 tokens"):
            encode_model_input(FakeTokenizer(), self.example, 2)

    def test_changed_choice_order_is_rejected(self) -> None:
        example = ModelInput("contract", "statement", tuple(reversed(LABELS)))
        with self.assertRaisesRegex(PromptEncodingError, "original order"):
            encode_model_input(FakeTokenizer(), example, 10)

    def test_multitoken_colliding_or_changed_prefix_labels_are_rejected(self) -> None:
        for mode in ("multiple", "collision", "boundary"):
            with self.subTest(mode=mode), self.assertRaisesRegex(PromptEncodingError, "single-token"):
                encode_model_input(FakeTokenizer(mode=mode), self.example, 10)

    def test_auto_backend_prefers_lower_memory_mlx_on_apple_silicon(self) -> None:
        with mock.patch("sova_model.__main__.sys.platform", "darwin"):
            with mock.patch("sova_model.__main__.platform.machine", return_value="arm64"):
                self.assertEqual(resolve_backend("auto"), "mlx")
        with mock.patch("sova_model.__main__.sys.platform", "linux"):
            self.assertEqual(resolve_backend("auto"), "torch")
        self.assertEqual(resolve_backend("torch"), "torch")


@unittest.skipIf(torch is None, "PyTorch is not installed")
class ModelScoringTests(unittest.TestCase):
    class FakeModel:
        class Config:
            max_position_embeddings = 100

        config = Config()

        def __init__(self, *, shape="normal", nan=False):
            self.calls = 0
            self.in_eval = False
            self.shape = shape
            self.nan = nan

        def eval(self):
            self.in_eval = True
            return self

        def __call__(self, **kwargs):
            self.calls += 1
            if not torch.is_inference_mode_enabled():
                raise AssertionError("Inference mode was not enabled")
            if kwargs["logits_to_keep"] != 1 or kwargs["use_cache"] is not False:
                raise AssertionError("Unexpected forward arguments")
            if not torch.equal(kwargs["attention_mask"], torch.ones_like(kwargs["input_ids"])):
                raise AssertionError("Unexpected attention mask")
            length = 2 if self.shape == "bad" else 1
            logits = torch.zeros((1, length, 32))
            logits[0, -1, 10] = float("nan") if self.nan else 0.1
            logits[0, -1, 11] = 2.0
            logits[0, -1, 12] = -0.5
            return type("Output", (), {"logits": logits})()

    def setUp(self) -> None:
        self.example = ModelInput("contract", "statement", LABELS)

    def test_one_forward_pass_scores_the_correct_labels(self) -> None:
        backbone = self.FakeModel()
        model = QwenDecisionModel(FakeTokenizer(), backbone, device="cpu", max_input_tokens=10)
        result = model.score(self.example)
        self.assertTrue(backbone.in_eval)
        self.assertEqual(backbone.calls, 1)
        self.assertEqual(result.predicted_label, "Contradiction")
        self.assertEqual(tuple(result.probabilities), LABELS)
        self.assertAlmostEqual(sum(result.probabilities.values()), 1.0)
        self.assertFalse(result.calibrated)
        self.assertEqual(result.input_tokens, 3)

    def test_long_prompt_never_calls_backbone(self) -> None:
        backbone = self.FakeModel()
        model = QwenDecisionModel(FakeTokenizer(), backbone, device="cpu", max_input_tokens=2)
        with self.assertRaises(ContextTooLongError):
            model.score(self.example)
        self.assertEqual(backbone.calls, 0)

    def test_invalid_shape_and_nan_are_rejected(self) -> None:
        for backbone in (self.FakeModel(shape="bad"), self.FakeModel(nan=True)):
            with self.subTest(shape=backbone.shape, nan=backbone.nan):
                with self.assertRaises(RuntimeError):
                    QwenDecisionModel(FakeTokenizer(), backbone, device="cpu", max_input_tokens=10).score(self.example)

    def test_load_local_never_requests_remote_weights(self) -> None:
        from transformers import AutoModelForCausalLM, AutoTokenizer

        backbone = self.FakeModel()
        with mock.patch.object(AutoTokenizer, "from_pretrained", return_value=FakeTokenizer()) as tokenizer_loader:
            with mock.patch.object(AutoModelForCausalLM, "from_pretrained", return_value=backbone) as model_loader:
                model = QwenDecisionModel.load_local("local-only", revision="pinned", device="cpu", max_input_tokens=10)
        self.assertEqual(model.device, "cpu")
        self.assertTrue(tokenizer_loader.call_args.kwargs["local_files_only"])
        self.assertTrue(model_loader.call_args.kwargs["local_files_only"])
        self.assertFalse(model_loader.call_args.kwargs["trust_remote_code"])
        self.assertEqual(model_loader.call_args.kwargs["revision"], "pinned")


@unittest.skipIf(mx is None, "MLX is not installed")
class MLXScoringTests(unittest.TestCase):
    class FakeEmbedding:
        def __init__(self):
            self.projected_shape = None

        def as_linear(self, hidden):
            self.projected_shape = tuple(hidden.shape)
            values = [0.0] * 32
            values[10], values[11], values[12] = 0.1, 2.0, -0.5
            return mx.array([[values]])

    class FakeInner:
        def __init__(self):
            self.calls = 0
            self.embed_tokens = MLXScoringTests.FakeEmbedding()

        def __call__(self, tokens):
            self.calls += 1
            return mx.ones((1, tokens.shape[1], 4))

    class FakeModel:
        model_type = "qwen3"
        args = type("Args", (), {"tie_word_embeddings": True, "max_position_embeddings": 100})()

        def __init__(self):
            self.model = MLXScoringTests.FakeInner()
            self.in_eval = False

        def eval(self):
            self.in_eval = True
            return self

    def test_one_transformer_pass_and_only_last_token_projected(self) -> None:
        backbone = self.FakeModel()
        model = MLXQwenDecisionModel(FakeTokenizer(), backbone, max_input_tokens=10)
        result = model.score(ModelInput("contract", "statement", LABELS))
        self.assertTrue(backbone.in_eval)
        self.assertEqual(backbone.model.calls, 1)
        self.assertEqual(backbone.model.embed_tokens.projected_shape, (1, 1, 4))
        self.assertEqual(result.predicted_label, "Contradiction")
        self.assertAlmostEqual(sum(result.probabilities.values()), 1.0)
        self.assertEqual(result.device, "mlx-4bit")
        self.assertFalse(result.calibrated)

    def test_long_prompt_never_calls_mlx_backbone(self) -> None:
        backbone = self.FakeModel()
        model = MLXQwenDecisionModel(FakeTokenizer(), backbone, max_input_tokens=2)
        with self.assertRaises(ContextTooLongError):
            model.score(ModelInput("contract", "statement", LABELS))
        self.assertEqual(backbone.model.calls, 0)

    def test_cached_snapshot_is_resolved_offline(self) -> None:
        import huggingface_hub
        import mlx_lm

        with mock.patch.object(huggingface_hub, "snapshot_download", return_value="/local/snapshot") as resolver:
            with mock.patch.object(mlx_lm, "load", return_value=(self.FakeModel(), FakeTokenizer())) as loader:
                MLXQwenDecisionModel.load_local(max_input_tokens=10)
        self.assertTrue(resolver.call_args.kwargs["local_files_only"])
        self.assertEqual(loader.call_args.args[0], "/local/snapshot")
        self.assertFalse(loader.call_args.kwargs["tokenizer_config"]["trust_remote_code"])

    def test_last_token_projection_matches_real_tiny_qwen3(self) -> None:
        import mlx.nn as nn
        from mlx_lm.models.qwen3 import Model, ModelArgs

        for tied in (True, False):
            with self.subTest(tied=tied):
                args = ModelArgs(
                    model_type="qwen3", hidden_size=64, num_hidden_layers=2,
                    intermediate_size=128, num_attention_heads=4, num_key_value_heads=2,
                    rms_norm_eps=1e-6, vocab_size=64, max_position_embeddings=100,
                    rope_theta=10000.0, head_dim=16, tie_word_embeddings=tied,
                )
                backbone = Model(args)
                nn.quantize(backbone, group_size=32, bits=4)
                reference = backbone(mx.array([[1, 2, 3]], dtype=mx.int32))
                selected = reference[0, -1, mx.array([10, 11, 12], dtype=mx.int32)].astype(mx.float32)
                expected = mx.softmax(selected, axis=-1)
                mx.eval(expected)
                result = MLXQwenDecisionModel(FakeTokenizer(), backbone, max_input_tokens=10).score(
                    ModelInput("contract", "statement", LABELS)
                )
                for label, value in zip(LABELS, expected.tolist()):
                    self.assertAlmostEqual(result.probabilities[label], value, places=5)


SNAPSHOT = (Path.home() / ".cache/huggingface/hub/models--Qwen--Qwen3-4B/snapshots" /
            "1cfa9a7208912126459214e8b04321603b3df60c")


@unittest.skipUnless(torch is not None and (SNAPSHOT / "tokenizer.json").exists(), "Cached tokenizer is unavailable")
class LocalTokenizerTests(unittest.TestCase):
    def test_actual_qwen_tokenizer_and_loader_example(self) -> None:
        from transformers import AutoTokenizer

        tokenizer = AutoTokenizer.from_pretrained(SNAPSHOT, local_files_only=True)
        example = next(ContractNLILoader().iter_split("train"))
        encoded = encode_model_input(tokenizer, example.model_input, 4096)
        self.assertGreater(len(encoded.input_ids), 0)
        self.assertEqual(len(set(encoded.choice_token_ids)), 3)
        self.assertEqual(encoded.labels, LABELS)


if __name__ == "__main__":
    unittest.main()

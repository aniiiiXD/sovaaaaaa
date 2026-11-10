"""Memory-conscious, local-only MLX scoring of Qwen3-4B's 4-bit weights."""

from __future__ import annotations

import math
from typing import Any

from sova_data import ModelInput

from .prompting import encode_model_input
from .scorer import DecisionScores

MLX_MODEL = "Qwen/Qwen3-4B-MLX-4bit"
MLX_REVISION = "52a5ab34fa604bc8af6d3ce0cac0cab10b7eb495"


class MLXQwenDecisionModel:
    """Same three-label decision interface, using quantized Apple weights."""

    def __init__(self, tokenizer: Any, model: Any, *, max_input_tokens: int = 4096) -> None:
        if (not isinstance(max_input_tokens, int) or isinstance(max_input_tokens, bool) or
            max_input_tokens < 1):
            raise ValueError("max_input_tokens must be a positive integer")
        if getattr(model, "model_type", None) != "qwen3":
            raise ValueError("The MLX backend currently supports Qwen3 only")
        limit = getattr(getattr(model, "args", None), "max_position_embeddings", None)
        if isinstance(limit, int) and max_input_tokens > limit:
            raise ValueError(f"Configured token limit exceeds model context size {limit}")
        self.tokenizer = tokenizer
        self.model = model
        self.max_input_tokens = max_input_tokens
        self.model.eval()

    @classmethod
    def load_local(cls, *, max_input_tokens: int = 4096) -> "MLXQwenDecisionModel":
        """Resolve a pinned cached snapshot without any network access."""
        try:
            from huggingface_hub import snapshot_download
            from mlx_lm import load
        except ImportError as exc:
            raise RuntimeError("Install Apple inference dependencies from requirements-mlx.txt") from exc
        path = snapshot_download(MLX_MODEL, revision=MLX_REVISION, local_files_only=True)
        model, tokenizer = load(path, tokenizer_config={"trust_remote_code": False})
        return cls(tokenizer, model, max_input_tokens=max_input_tokens)

    def score(self, model_input: ModelInput) -> DecisionScores:
        import mlx.core as mx

        encoded = encode_model_input(self.tokenizer, model_input, self.max_input_tokens)
        tokens = mx.array([encoded.input_ids], dtype=mx.int32)
        # Qwen3's published MLX implementation runs model.model(...) followed by
        # either the tied embedding projection or lm_head. Slicing first avoids
        # allocating a vocabulary-sized output for every input token.
        hidden = self.model.model(tokens)
        last_hidden = hidden[:, -1:, :]
        if self.model.args.tie_word_embeddings:
            logits = self.model.model.embed_tokens.as_linear(last_hidden)
        else:
            logits = self.model.lm_head(last_hidden)
        if len(logits.shape) != 3 or tuple(logits.shape[:2]) != (1, 1):
            raise RuntimeError("Model returned an unexpected logits shape")
        if max(encoded.choice_token_ids) >= logits.shape[-1] or min(encoded.choice_token_ids) < 0:
            raise RuntimeError("Decision token ID is outside the model vocabulary")
        selected = logits[0, 0, mx.array(encoded.choice_token_ids, dtype=mx.int32)].astype(mx.float32)
        probabilities_array = mx.softmax(selected, axis=-1)
        mx.eval(probabilities_array)
        values = probabilities_array.tolist()
        if any(not math.isfinite(value) for value in values):
            raise RuntimeError("Model returned non-finite decision scores")
        probabilities = dict(zip(encoded.labels, (float(value) for value in values)))
        predicted = max(encoded.labels, key=probabilities.__getitem__)
        return DecisionScores(probabilities, predicted, len(encoded.input_ids), "mlx-4bit")

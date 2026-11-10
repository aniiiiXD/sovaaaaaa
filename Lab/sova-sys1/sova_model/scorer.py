"""One forward pass through Qwen's existing causal-language-model head."""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Any

from sova_data import ModelInput

from .prompting import encode_model_input

DEFAULT_MODEL = "Qwen/Qwen3-4B"
DEFAULT_REVISION = "1cfa9a7208912126459214e8b04321603b3df60c"


@dataclass(frozen=True)
class DecisionScores:
    probabilities: dict[str, float]
    predicted_label: str
    input_tokens: int
    device: str
    calibrated: bool = False


def _device(torch: Any, requested: str) -> str:
    if requested == "auto":
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    if requested not in ("cpu", "mps", "cuda"):
        raise ValueError("device must be auto, cpu, mps or cuda")
    if requested == "mps" and not (hasattr(torch.backends, "mps") and torch.backends.mps.is_available()):
        raise ValueError("MPS is not available on this machine")
    if requested == "cuda" and not torch.cuda.is_available():
        raise ValueError("CUDA is not available on this machine")
    return requested


class QwenDecisionModel:
    """Score three labels without generating text or exposing a gold answer."""

    def __init__(self, tokenizer: Any, model: Any, *, device: str, max_input_tokens: int = 4096) -> None:
        if (not isinstance(max_input_tokens, int) or isinstance(max_input_tokens, bool) or
            max_input_tokens < 1):
            raise ValueError("max_input_tokens must be a positive integer")
        context_limit = getattr(getattr(model, "config", None), "max_position_embeddings", None)
        if isinstance(context_limit, int) and max_input_tokens > context_limit:
            raise ValueError(f"Configured token limit exceeds model context size {context_limit}")
        self.tokenizer = tokenizer
        self.model = model
        self.device = device
        self.max_input_tokens = max_input_tokens
        self.model.eval()

    @classmethod
    def load_local(
        cls, model_name: str = DEFAULT_MODEL, *, revision: str = DEFAULT_REVISION,
        device: str = "auto", max_input_tokens: int = 4096,
    ) -> "QwenDecisionModel":
        """Load only cached/local weights; this method never downloads a model."""
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError as exc:
            raise RuntimeError("Install the local inference dependencies from requirements-model.txt") from exc
        chosen = _device(torch, device)
        dtype = torch.float32 if chosen == "cpu" else torch.float16
        tokenizer = AutoTokenizer.from_pretrained(
            model_name, revision=revision, local_files_only=True, trust_remote_code=False,
        )
        model = AutoModelForCausalLM.from_pretrained(
            model_name, revision=revision, local_files_only=True, trust_remote_code=False,
            torch_dtype=dtype, low_cpu_mem_usage=True, device_map={"": chosen},
        )
        return cls(tokenizer, model, device=chosen, max_input_tokens=max_input_tokens)

    def score(self, model_input: ModelInput) -> DecisionScores:
        """Return the distribution restricted to the three allowed labels.

        These scores are not calibrated probabilities of real-world correctness.
        """
        import torch

        encoded = encode_model_input(self.tokenizer, model_input, self.max_input_tokens)
        input_ids = torch.tensor([encoded.input_ids], dtype=torch.long, device=self.device)
        attention_mask = torch.ones_like(input_ids)
        with torch.inference_mode():
            output = self.model(
                input_ids=input_ids, attention_mask=attention_mask,
                logits_to_keep=1, use_cache=False, return_dict=True,
            )
            logits = output.logits
            if logits.ndim != 3 or logits.shape[0] != 1 or logits.shape[1] != 1:
                raise RuntimeError("Model returned an unexpected logits shape")
            if max(encoded.choice_token_ids) >= logits.shape[-1] or min(encoded.choice_token_ids) < 0:
                raise RuntimeError("Decision token ID is outside the model vocabulary")
            selected = logits[0, 0, list(encoded.choice_token_ids)].float()
            if not bool(torch.isfinite(selected).all().item()):
                raise RuntimeError("Model returned non-finite decision logits")
            values = torch.softmax(selected, dim=-1).cpu().tolist()
        if any(not math.isfinite(value) for value in values):
            raise RuntimeError("Model returned non-finite decision scores")
        probabilities = dict(zip(encoded.labels, (float(value) for value in values)))
        predicted = max(encoded.labels, key=probabilities.__getitem__)
        return DecisionScores(probabilities, predicted, len(encoded.input_ids), str(self.device))

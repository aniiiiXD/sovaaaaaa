"""One-pass student decision inference without profiling side effects."""

from __future__ import annotations

import math
import threading

from sova_data import ModelInput
from sova_data.loader import LABELS
from sova_model import DecisionScores
from .data import encode_student_input


class StudentScorer:
    """Serialize model access and return only the three uncalibrated scores."""

    def __init__(self, model, tokenizer, *, device: str, max_input_tokens: int) -> None:
        if device not in ("cpu", "cuda"):
            raise ValueError("device must be cpu or cuda")
        self.model, self.tokenizer = model, tokenizer
        self.device, self.max_input_tokens = device, max_input_tokens
        self._lock = threading.Lock()
        self.model.eval()

    def score(self, model_input: ModelInput) -> DecisionScores:
        import torch

        with self._lock:
            ids = encode_student_input(self.tokenizer, model_input, self.max_input_tokens)
            input_ids = torch.tensor([ids], dtype=torch.long, device=self.device)
            with torch.inference_mode(), torch.autocast(
                device_type="cuda" if self.device == "cuda" else "cpu",
                dtype=torch.float16, enabled=self.device == "cuda",
            ):
                logits = self.model(input_ids)
                if logits.ndim != 2 or tuple(logits.shape) != (1, 3):
                    raise RuntimeError("Unexpected student score shape")
                if not bool(torch.isfinite(logits).all().item()):
                    raise RuntimeError("Student returned non-finite scores")
                values = torch.softmax(logits.float(), dim=-1)[0].cpu().tolist()
            if any(not math.isfinite(value) for value in values):
                raise RuntimeError("Student returned non-finite probabilities")
            scores = dict(zip(LABELS, (float(value) for value in values)))
            return DecisionScores(scores, max(LABELS, key=scores.__getitem__), len(ids), self.device)

from collections.abc import Callable
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Protocol

from rig.domain.models import Candidate, GenerationConfig, GenerationResult, ModelSpec, TrainRequest

Check = Callable[[], None]


class InferenceSession(Protocol):
    def generate(self, messages: list[dict[str, str]], config: GenerationConfig,
                 check: Check) -> GenerationResult: ...


class TrainingBackend(Protocol):
    def train(self, candidate: Candidate, request: TrainRequest, data: Path,
              output: Path, check: Check) -> ModelSpec: ...


class OptimizationBackend(Protocol):
    def optimize(self, candidate: Candidate, strategy: str, bits: int, group_size: int,
                 output: Path, check: Check) -> ModelSpec: ...


class InferenceBackend(Protocol):
    def session(self, candidate: Candidate) -> AbstractContextManager[InferenceSession]: ...


class ModelBackend(TrainingBackend, OptimizationBackend, InferenceBackend, Protocol):
    """A provider can implement all ports or compose separate implementations."""

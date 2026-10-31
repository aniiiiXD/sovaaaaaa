from contextlib import contextmanager

import pytest

from rig.config import Settings
from rig.container import Container
from rig.domain.models import BaseModelCreate, DatasetCreate, GenerationResult, ModelSpec, Record


class FakeSession:
    def __init__(self, backend, candidate):
        self.backend, self.candidate = backend, candidate

    def generate(self, messages, config, check):
        check()
        answer = self.backend.answers.get(messages[-1]["content"], "unknown")
        if self.candidate.kind == "quantized" and self.backend.regress_quantized:
            answer = "wrong"
        return GenerationResult(text=answer, prompt_tokens=5, completion_tokens=2,
                                latency_ms=10, ttft_ms=3, finish_reason="stop")


class FakeBackend:
    """Test-only. No fake/mock backend is registered in the application."""
    answers = {"train one": "A", "train two": "B", "valid one": "C",
               "valid two": "D", "test one": "E"}
    regress_quantized = False
    seen_training_files = []

    def train(self, candidate, request, data, output, check):
        check()
        self.seen_training_files = [path.name for path in data.iterdir()]
        output.mkdir(parents=True, exist_ok=True)
        (output / "adapter.safetensors").write_bytes(b"test fixture, not model weights")
        return candidate.spec.model_copy(update={"adapter_path": "fake-adapter"})

    def optimize(self, candidate, strategy, bits, group_size, output, check):
        check()
        output.mkdir(parents=True, exist_ok=True)
        (output / "config.json").write_text("{}")
        return ModelSpec(model_path="fake-model")

    @contextmanager
    def session(self, candidate):
        yield FakeSession(self, candidate)


@pytest.fixture
def services(tmp_path):
    settings = Settings(home=tmp_path, api_token="test-token-only", execution_enabled=True,
                        store_content=False, _env_file=None)
    container = Container(settings, backend=FakeBackend())
    container.initialize()
    return container


@pytest.fixture
def base(services):
    return services.candidates.register(BaseModelCreate(name="fixture", repo_id="fixtures/model",
                                                        revision="a" * 40))


@pytest.fixture
def dataset(services):
    return services.datasets.create(DatasetCreate(name="fixture", records=[
        Record(prompt=prompt, completion=answer, split=prompt.split()[0])
        for prompt, answer in FakeBackend.answers.items()
    ]))

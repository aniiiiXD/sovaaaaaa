from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator


def new_id() -> str:
    return uuid4().hex


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


Id = Annotated[str, Field(pattern=r"^[a-f0-9]{32}$")]
Name = Annotated[str, Field(min_length=1, max_length=120)]
Split = Literal["train", "valid", "test"]
JobKind = Literal["train", "evaluate", "optimize", "pipeline"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Record(Contract):
    id: str = Field(default_factory=new_id, min_length=1, max_length=120)
    prompt: str = Field(min_length=1, max_length=100_000)
    completion: str = Field(min_length=1, max_length=100_000)
    system: str | None = Field(default=None, max_length=20_000)
    split: Split


class DatasetCreate(Contract):
    name: Name
    records: list[Record] = Field(min_length=1, max_length=100_000)
    parent_id: Id | None = None
    description: str = Field(default="", max_length=2000)


class Dataset(Contract):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    name: str
    parent_id: Id | None = None
    description: str
    sha256: str
    counts: dict[str, int]
    artifact: str


class BaseModelCreate(Contract):
    name: Name
    repo_id: str = Field(pattern=r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
    revision: str = Field(pattern=r"^[a-f0-9]{40}$", description="Immutable HF commit SHA")


class ModelSpec(Contract):
    repo_id: str | None = None
    revision: str | None = None
    model_path: str | None = None
    adapter_path: str | None = None


class Candidate(Contract):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    name: str
    backend: str = "mlx"
    kind: Literal["base", "adapter", "fused", "quantized"] = "base"
    parent_id: Id | None = None
    dataset_ids: list[str] = Field(default_factory=list)
    spec: ModelSpec
    manifest: str | None = None


class GenerationConfig(Contract):
    max_tokens: int = Field(default=128, ge=1, le=4096)
    max_input_tokens: int = Field(default=4096, ge=1, le=32768)
    temperature: float = Field(default=0, ge=0, le=2)
    top_p: float = Field(default=1, gt=0, le=1)
    seed: int = Field(default=42, ge=0, le=2**32 - 1)


class TrainRequest(Contract):
    base_candidate_id: Id
    dataset_id: Id
    name: Name = "specialist"
    iterations: int = Field(default=600, ge=1, le=1_000_000)
    batch_size: int = Field(default=4, ge=1, le=256)
    learning_rate: float = Field(default=0.0001, gt=0, le=1)
    lora_rank: int = Field(default=8, ge=1, le=256)
    lora_scale: float = Field(default=20, gt=0)
    lora_dropout: float = Field(default=0, ge=0, lt=1)
    num_layers: int = Field(default=16, ge=1, le=256)
    max_seq_length: int = Field(default=2048, ge=128, le=32768)
    eval_every: int = Field(default=100, ge=1)
    seed: int = Field(default=42, ge=0, le=2**32 - 1)


class QualityGate(Contract):
    min_score: float = Field(default=0.8, ge=0, le=1)
    max_p95_latency_ms: float | None = Field(default=None, gt=0)
    max_estimated_usd_per_1k: float | None = Field(default=None, ge=0)


class EvalConfig(Contract):
    dataset_id: Id
    split: Literal["valid", "test"] = "valid"
    metric: Literal["exact", "normalized_exact", "numeric"] = "normalized_exact"
    numeric_absolute_tolerance: float = Field(default=0.000001, ge=0)
    numeric_relative_tolerance: float = Field(default=0.000001, ge=0)
    generation: GenerationConfig = Field(default_factory=GenerationConfig)
    gate: QualityGate = Field(default_factory=QualityGate)
    estimated_hourly_usd: float | None = Field(default=None, ge=0)


class EvalRequest(EvalConfig):
    candidate_id: Id


class OptimizeRequest(Contract):
    baseline_report_id: Id
    name: Name = "optimized-specialist"
    strategy: Literal["fuse", "quantize"] = "quantize"
    bits: Literal[4, 8] = 4
    group_size: Literal[32, 64, 128] = 64
    max_score_drop: float = Field(default=0.01, ge=0, le=1)
    max_latency_ratio: float | None = Field(default=None, gt=0)


class OptimizeConfig(Contract):
    strategy: Literal["fuse", "quantize"] = "quantize"
    bits: Literal[4, 8] = 4
    group_size: Literal[32, 64, 128] = 64
    max_score_drop: float = Field(default=0.01, ge=0, le=1)
    max_latency_ratio: float | None = Field(default=None, gt=0)


class PipelineRequest(Contract):
    training: TrainRequest
    evaluation: EvalConfig
    optimization: OptimizeConfig | None = Field(default_factory=OptimizeConfig)

    @model_validator(mode="after")
    def validation_only(self):
        if self.evaluation.split != "valid":
            raise ValueError("Iteration uses validation data; reserve test for a final audit")
        return self


class IterationRequest(Contract):
    name: Name
    pipeline: PipelineRequest
    new_training_records: list[Record] = Field(min_length=1, max_length=100_000)

    @model_validator(mode="after")
    def training_only(self):
        if any(record.split != "train" for record in self.new_training_records):
            raise ValueError("Iteration additions must be new training examples")
        return self


class GenerationResult(Contract):
    text: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: float
    ttft_ms: float | None
    finish_reason: Literal["stop", "length"]


class CaseResult(Contract):
    record_id: str
    score: float
    generation: GenerationResult


class Evaluation(Contract):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    candidate_id: Id
    config: EvalConfig
    dataset_sha256: str
    count: int
    score: float
    p50_latency_ms: float
    p95_latency_ms: float
    p50_ttft_ms: float | None
    output_tokens_per_second: float
    estimated_usd_per_1k: float | None
    passed: bool
    gate_failures: list[str]
    cases_artifact: str
    environment: dict[str, str]
    baseline_report_id: Id | None = None


class DeploymentCreate(Contract):
    name: str = Field(pattern=r"^[a-z][a-z0-9-]{0,62}$")
    report_id: Id


class Deployment(Contract):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    name: str
    candidate_id: Id
    report_id: Id


class Message(Contract):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(Contract):
    model: str = Field(min_length=1, max_length=63)
    messages: list[Message] = Field(min_length=1, max_length=128)
    max_tokens: int = Field(default=128, ge=1, le=4096)
    temperature: float = Field(default=0, ge=0, le=2)
    top_p: float = Field(default=1, gt=0, le=1)
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    stream: Literal[False] = False

    @model_validator(mode="after")
    def user_last(self):
        if self.messages[-1].role != "user":
            raise ValueError("The final message must have role user")
        return self


class FeedbackCreate(Contract):
    request_id: Id
    rating: Literal["good", "bad"]
    correction: str | None = Field(default=None, min_length=1, max_length=100_000)


class FeedbackDatasetCreate(Contract):
    name: Name
    feedback_ids: list[Id] = Field(min_length=1, max_length=10_000)


class Job(Contract):
    id: Id = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now)
    updated_at: str = Field(default_factory=now)
    kind: JobKind
    state: Literal["queued", "running", "succeeded", "failed", "cancelled"] = "queued"
    cancel_requested: bool = False
    payload: dict
    result: dict | None = None
    error: str | None = None

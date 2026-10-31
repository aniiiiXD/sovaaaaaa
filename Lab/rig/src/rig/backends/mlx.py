from contextlib import contextmanager
import gc
import json
from pathlib import Path
import time

from rig.backends.process import run_command
from rig.config import Settings
from rig.domain.models import Candidate, GenerationConfig, GenerationResult, ModelSpec, TrainRequest
from rig.domain.ports import Check
from rig.errors import RigError, Unavailable
from rig.storage.artifacts import Artifacts


class MLXBackend:
    def __init__(self, settings: Settings, artifacts: Artifacts):
        self.settings = settings
        self.artifacts = artifacts

    def resolve(self, spec: ModelSpec) -> Path:
        if spec.model_path:
            path = self.artifacts.path(spec.model_path)
            if not (path / "config.json").is_file():
                raise Unavailable("Model artifact is missing config.json")
            return path
        if not spec.repo_id or not spec.revision:
            raise RigError("Model reference is incomplete")
        try:
            from huggingface_hub import snapshot_download
            return Path(snapshot_download(repo_id=spec.repo_id, revision=spec.revision,
                                          local_files_only=not self.settings.allow_downloads))
        except ImportError as exc:
            raise Unavailable("The execution environment needs Rig's mlx dependencies") from exc
        except Exception as exc:
            raise Unavailable("Pinned model snapshot is unavailable; downloads are controlled "
                              "by RIG_ALLOW_DOWNLOADS") from exc

    def train(self, candidate: Candidate, request: TrainRequest, data: Path,
              output: Path, check: Check) -> ModelSpec:
        if candidate.spec.adapter_path:
            raise RigError("Fuse an adapter candidate before training another adapter on it")
        model = self.resolve(candidate.spec)
        adapter = output / "adapter"
        output.mkdir(parents=True, exist_ok=True)
        training_config = output / "lora-config.json"
        # JSON is also valid YAML; MLX's config reader accepts this representation.
        training_config.write_text(json.dumps({"lora_parameters": {
            "rank": request.lora_rank, "scale": request.lora_scale,
            "dropout": request.lora_dropout}}))
        command = [str(self.settings.mlx_python), "-m", "mlx_lm", "lora", "--train",
                   "--config", str(training_config),
                   "--model", str(model), "--data", str(data), "--mask-prompt",
                   "--fine-tune-type", "lora", "--adapter-path", str(adapter),
                   "--iters", str(request.iterations), "--batch-size", str(request.batch_size),
                   "--learning-rate", str(request.learning_rate),
                   "--num-layers", str(request.num_layers),
                   "--max-seq-length", str(request.max_seq_length),
                   "--steps-per-eval", str(request.eval_every),
                   "--save-every", str(request.eval_every), "--seed", str(request.seed),
                   "--val-batches", "-1", "--grad-checkpoint"]
        run_command(command, output / "train.log", check)
        if not (adapter / "adapters.safetensors").is_file():
            raise Unavailable("Training finished without adapters.safetensors")
        return candidate.spec.model_copy(update={
            "adapter_path": str(adapter.relative_to(self.artifacts.root))})

    def optimize(self, candidate: Candidate, strategy: str, bits: int, group_size: int,
                 output: Path, check: Check) -> ModelSpec:
        model = self.resolve(candidate.spec)
        python = str(self.settings.mlx_python)
        if candidate.spec.adapter_path:
            fused = output / "fused"
            run_command([python, "-m", "mlx_lm", "fuse", "--model", str(model),
                         "--adapter-path", str(self.artifacts.path(candidate.spec.adapter_path)),
                         "--save-path", str(fused), "--dequantize"], output / "fuse.log", check)
            model = fused
        elif strategy == "fuse":
            raise RigError("Fusion requires a trained adapter")
        if strategy == "quantize":
            # Start quantization from full-precision weights, including quantized base models.
            config = json.loads((model / "config.json").read_text())
            if config.get("quantization") or config.get("quantization_config"):
                dequantized = output / "dequantized"
                run_command([python, "-m", "mlx_lm", "convert", "--hf-path", str(model),
                             "--mlx-path", str(dequantized), "--dequantize"],
                            output / "dequantize.log", check)
                model = dequantized
            quantized = output / "quantized"
            run_command([python, "-m", "mlx_lm", "convert", "--hf-path", str(model),
                         "--mlx-path", str(quantized), "--quantize", "--q-bits", str(bits),
                         "--q-group-size", str(group_size)], output / "quantize.log", check)
            model = quantized
        if not (model / "config.json").is_file() or not list(model.glob("*.safetensors")):
            raise Unavailable("Optimization finished without a complete model artifact")
        return ModelSpec(model_path=str(model.relative_to(self.artifacts.root)))

    @contextmanager
    def session(self, candidate: Candidate):
        try:
            import mlx.core as mx
            from mlx_lm import load
        except ImportError as exc:
            raise Unavailable("MLX inference requires an Apple Silicon MLX environment") from exc
        path = self.resolve(candidate.spec)
        adapter = (str(self.artifacts.path(candidate.spec.adapter_path))
                   if candidate.spec.adapter_path else None)
        model = tokenizer = session = None
        try:
            model, tokenizer = load(str(path), adapter_path=adapter, trust_remote_code=False,
                                    tokenizer_config={"trust_remote_code": False})
            session = MLXSession(model, tokenizer)
            yield session
        finally:
            if session is not None:
                session.model = None
                session.tokenizer = None
            del model, tokenizer
            gc.collect()
            mx.clear_cache()


class MLXSession:
    def __init__(self, model, tokenizer):
        self.model = model
        self.tokenizer = tokenizer

    def generate(self, messages: list[dict[str, str]], config: GenerationConfig,
                 check: Check) -> GenerationResult:
        import mlx.core as mx
        from mlx_lm.generate import stream_generate
        from mlx_lm.sample_utils import make_sampler

        check()
        mx.random.seed(config.seed)
        prompt = self.tokenizer.apply_chat_template(messages, tokenize=False,
                                                   add_generation_prompt=True,
                                                   enable_thinking=False)
        # Encode once and supply tokens directly; do not accidentally add BOS twice.
        tokens = self.tokenizer.encode(prompt, add_special_tokens=False)
        if len(tokens) > config.max_input_tokens:
            raise RigError("Input exceeds max_input_tokens; Rig does not silently truncate it")
        started = time.perf_counter()
        first = None
        text = []
        last = None
        generator = stream_generate(self.model, self.tokenizer, prompt=tokens,
                                    max_tokens=config.max_tokens,
                                    sampler=make_sampler(temp=config.temperature, top_p=config.top_p))
        try:
            for chunk in generator:
                check()
                if first is None:
                    first = time.perf_counter()
                text.append(chunk.text)
                last = chunk
        finally:
            generator.close()
        elapsed = time.perf_counter() - started
        count = int(last.generation_tokens) if last is not None else 0
        return GenerationResult(text="".join(text), prompt_tokens=len(tokens),
                                completion_tokens=count, latency_ms=elapsed * 1000,
                                ttft_ms=(first - started) * 1000 if first is not None else None,
                                finish_reason=(last.finish_reason if last is not None
                                               and last.finish_reason in ("stop", "length") else "stop"))

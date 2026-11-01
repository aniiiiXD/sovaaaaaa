import json
from pathlib import Path

from pydantic import Field

from rig.domain.models import Candidate, Contract, ModelSpec, Name
from rig.errors import RigError


class LocalModelImport(Contract):
    name: Name
    directory: str = Field(min_length=1, max_length=1024,
                           description="Relative to the operator-configured model import root")


class ModelImportService:
    """Copy an operator-staged model into Rig storage, without contacting a model hub."""

    def __init__(self, settings, artifacts, candidates):
        self.settings, self.artifacts, self.candidates = settings, artifacts, candidates

    def validate(self, request: LocalModelImport) -> tuple[Path, list[Path]]:
        if self.settings.model_import_root is None:
            raise RigError("Set RIG_MODEL_IMPORT_ROOT to enable local model imports")
        root = self.settings.model_import_root.resolve()
        relative = Path(request.directory)
        if relative.is_absolute() or ".." in relative.parts:
            raise RigError("Model directory must stay inside the configured import root")
        segment = root
        for part in relative.parts:
            segment = segment / part
            if segment.is_symlink():
                raise RigError("Model staging paths must not contain symbolic links")
        source = (root / relative).resolve()
        if not source.is_relative_to(root) or not source.is_dir():
            raise RigError("Model import directory is unavailable or outside the import root")
        if self.artifacts.root.is_relative_to(source) or source.is_relative_to(self.artifacts.root):
            raise RigError("Model staging and artifact storage must not overlap")
        config_path = source / "config.json"
        if not config_path.is_file() or config_path.is_symlink():
            raise RigError("A staged model requires a regular config.json")
        try:
            config = json.loads(config_path.read_text())
        except (ValueError, OSError) as exc:
            raise RigError("Staged model config.json is unreadable or invalid") from exc
        if not isinstance(config, dict):
            raise RigError("Model configuration must be a JSON object")
        files, total = [], 0
        for path in sorted(source.rglob("*")):
            if path.is_symlink():
                raise RigError("Staged models must contain regular files, not symbolic links")
            if path.is_dir():
                continue
            if not path.is_file():
                raise RigError("Staged models cannot contain device files or pipes")
            if path.suffix not in {".json", ".safetensors", ".model", ".txt", ".tiktoken", ".md"}:
                raise RigError("Only model weights, tokenizer files, JSON and text documentation are imported")
            total += path.stat().st_size
            if total > self.settings.max_model_import_bytes:
                raise RigError("Staged model exceeds RIG_MAX_MODEL_IMPORT_BYTES")
            files.append(path)
        if not any(path.suffix == ".safetensors" for path in files):
            raise RigError("A staged model requires safetensors weights")
        if not any(path.name in {"tokenizer.json", "tokenizer.model"} for path in files):
            raise RigError("A staged model requires tokenizer.json or tokenizer.model")
        return source, files

    def run(self, request: LocalModelImport, context) -> Candidate:
        source, files = self.validate(request)
        context.event("model_import_started", {"files": len(files)})
        candidate = Candidate(name=request.name, spec=ModelSpec())
        relative = f"candidates/{candidate.id}/model"
        output = self.artifacts.path(relative)
        total = 0
        for source_file in files:
            context.check()
            if source_file.is_symlink() or not source_file.resolve().is_relative_to(source):
                raise RigError("Staged model changed during import")
            target = output / source_file.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            with source_file.open("rb") as src, target.open("xb") as dst:
                while chunk := src.read(1024 * 1024):
                    context.check()
                    total += len(chunk)
                    if total > self.settings.max_model_import_bytes:
                        raise RigError("Model grew beyond its import byte limit")
                    dst.write(chunk)
        candidate.spec = ModelSpec(model_path=relative)
        self.candidates.save(candidate, {"job_id": context.id, "source": "operator_staged_local_model",
                                         "import": request.model_dump(), "bytes": total},
                             output, context.check)
        context.event("model_import_completed", {"candidate_id": candidate.id})
        return candidate

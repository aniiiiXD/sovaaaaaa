from hashlib import sha256
from pathlib import Path

from rig.data.service import DatasetService
from rig.domain.models import BaseModelCreate, Candidate, ModelSpec, TrainRequest
from rig.domain.ports import ModelBackend
from rig.errors import RigError
from rig.storage.artifacts import Artifacts
from rig.storage.repository import Repository


class CandidateService:
    def __init__(self, repository: Repository, artifacts: Artifacts):
        self.repository = repository
        self.artifacts = artifacts

    def get(self, identifier: str) -> Candidate:
        return Candidate.model_validate(self.repository.get("candidate", identifier))

    def register(self, request: BaseModelCreate) -> Candidate:
        candidate = Candidate(name=request.name, spec=ModelSpec(repo_id=request.repo_id,
                                                               revision=request.revision))
        self.repository.put("candidate", candidate.model_dump(mode="json"))
        return candidate

    def save(self, candidate: Candidate, provenance: dict, output: Path, check) -> Candidate:
        checksums = {}
        for path in sorted(output.rglob("*")):
            check()
            if path.is_file() and path.suffix in (".safetensors", ".json"):
                digest = sha256()
                with path.open("rb") as handle:
                    while chunk := handle.read(1024 * 1024):
                        check()
                        digest.update(chunk)
                checksums[str(path.relative_to(self.artifacts.root))] = digest.hexdigest()
        candidate.manifest = f"candidates/{candidate.id}/manifest.json"
        self.artifacts.write_json(candidate.manifest, {
            "candidate": candidate.model_dump(mode="json"),
            "provenance": provenance, "checksums": checksums,
        })
        check()
        self.repository.put("candidate", candidate.model_dump(mode="json"))
        return candidate


class TrainingService:
    def __init__(self, datasets: DatasetService, candidates: CandidateService,
                 backend: ModelBackend, artifacts: Artifacts):
        self.datasets, self.candidates = datasets, candidates
        self.backend, self.artifacts = backend, artifacts

    def validate(self, request: TrainRequest) -> None:
        base = self.candidates.get(request.base_candidate_id)
        if base.spec.adapter_path:
            raise RigError("Training expects a base or fused model, not an unfused adapter")
        dataset = self.datasets.get(request.dataset_id)
        if any(dataset.counts.get(split, 0) < request.batch_size for split in ("train", "valid")):
            raise RigError("Train and valid splits must each contain at least batch_size records")

    def run(self, request: TrainRequest, context) -> Candidate:
        self.validate(request)
        context.event("training_started")
        base = self.candidates.get(request.base_candidate_id)
        candidate = Candidate(name=request.name, kind="adapter", parent_id=base.id,
                              dataset_ids=list(dict.fromkeys([*base.dataset_ids, request.dataset_id])),
                              spec=base.spec)
        relative = f"jobs/{context.id}/{candidate.id}"
        data = self.datasets.export_training(request.dataset_id, f"{relative}/data")
        output = self.artifacts.path(f"{relative}/output")
        spec = self.backend.train(base, request, data, output, context.check)
        candidate.spec = spec
        self.candidates.save(candidate, {"job_id": context.id, "training": request.model_dump(),
                                        "dataset_sha256": self.datasets.get(request.dataset_id).sha256},
                             output, context.check)
        context.event("training_completed", {"candidate_id": candidate.id})
        return candidate

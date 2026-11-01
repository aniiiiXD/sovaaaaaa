import pytest

from rig.domain.models import Job
from rig.errors import RigError
from rig.jobs.worker import run_worker
from rig.training.imports import LocalModelImport


def staged(services, tmp_path):
    root = tmp_path / "staging"
    model = root / "specialist"
    model.mkdir(parents=True)
    (model / "config.json").write_text('{"model_type": "fixture"}')
    (model / "tokenizer.json").write_text("{}")
    (model / "model.safetensors").write_bytes(b"not real weights: import-only fixture")
    services.settings.model_import_root = root
    return model


def test_local_import_snapshots_files_and_records_manifest(services, tmp_path):
    source = staged(services, tmp_path)
    request = LocalModelImport(name="on-prem base", directory="specialist")
    job = services.repository.enqueue(Job(kind="import_model", payload=request.model_dump()))
    run_worker(services, once=True)
    finished = services.repository.job(job.id)
    assert finished.state == "succeeded"
    candidate = services.candidates.get(finished.result["id"])
    assert candidate.spec.repo_id is None
    copied = services.artifacts.path(candidate.spec.model_path) / "model.safetensors"
    assert copied.read_bytes() == (source / "model.safetensors").read_bytes()
    (source / "model.safetensors").write_bytes(b"changed staging")
    assert copied.read_bytes() != (source / "model.safetensors").read_bytes()
    assert services.artifacts.path(candidate.manifest).is_file()


def test_import_disabled_without_operator_staging_root(services):
    with pytest.raises(RigError, match="RIG_MODEL_IMPORT_ROOT"):
        services.model_imports.validate(LocalModelImport(name="model", directory="model"))


@pytest.mark.parametrize("directory", ["../outside", "/etc"])
def test_import_cannot_escape_root(services, tmp_path, directory):
    staged(services, tmp_path)
    with pytest.raises(RigError):
        services.model_imports.validate(LocalModelImport(name="model", directory=directory))


def test_import_rejects_symlinks_and_byte_limit(services, tmp_path):
    source = staged(services, tmp_path)
    (source / "alias.json").symlink_to(source / "config.json")
    request = LocalModelImport(name="model", directory="specialist")
    with pytest.raises(RigError, match="symbolic"):
        services.model_imports.validate(request)
    (source / "alias.json").unlink()
    services.settings.max_model_import_bytes = 1
    with pytest.raises(RigError, match="BYTES"):
        services.model_imports.validate(request)

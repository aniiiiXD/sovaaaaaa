import pytest

from rig.domain.models import DatasetCreate, Record
from rig.errors import Conflict, RigError


def test_holdout_cannot_become_training_across_versions(services, dataset):
    with pytest.raises(Conflict, match="another split"):
        services.datasets.create(DatasetCreate(name="leak", records=[
            Record(prompt="  TEST   ONE  ", completion="E", system="Different instructions", split="train")
        ]))
    assert len(services.repository.list("dataset")) == 1


def test_train_cannot_be_presented_as_a_new_test(services, dataset):
    with pytest.raises(Conflict):
        services.datasets.create(DatasetCreate(name="contaminated test", records=[
            Record(prompt="train one", completion="A", split="test")
        ]))


def test_duplicate_normalized_inputs_are_rejected(services):
    with pytest.raises(Conflict):
        services.datasets.create(DatasetCreate(name="duplicates", records=[
            Record(prompt="Question", completion="yes", split="train"),
            Record(prompt=" question ", completion="no", split="valid"),
        ]))


def test_tampered_dataset_fails_before_use(services, dataset):
    services.artifacts.path(dataset.artifact).write_text("{}\n")
    with pytest.raises(Conflict, match="modified"):
        services.datasets.records(dataset.id)


def test_artifact_paths_cannot_escape_storage(services):
    with pytest.raises(RigError):
        services.artifacts.path("../../outside")


def test_missing_training_split_is_rejected(services):
    dataset = services.datasets.create(DatasetCreate(name="eval only", records=[
        Record(prompt="evaluation-only question", completion="yes", split="valid")
    ]))
    with pytest.raises(RigError, match="nonempty"):
        services.datasets.export_training(dataset.id, "scratch")

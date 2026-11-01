import pytest

from rig.domain.models import DatasetCreate, Record
from rig.errors import Conflict
from rig.jobs.worker import run_worker
from rig.workflows.models import CycleCreate
from tests.test_workflows import completed_cycle, workflow


def state(services):
    """Capture persistence, including split reservations invisible in the dataset list."""
    with services.repository.connection() as db:
        tables = {
            table: [tuple(row) for row in db.execute(f"SELECT * FROM {table} ORDER BY rowid")]
            for table in ("records", "prompt_splits", "jobs")
        }
    artifacts = sorted(str(path) for path in services.artifacts.root.rglob("records.jsonl"))
    return tables, artifacts


@pytest.mark.parametrize("reason", ["budget", "active", "stale_parent"])
def test_rejected_cycle_does_not_register_data_or_reserve_inputs(services, base, dataset, reason):
    work = workflow(services, base, dataset, max_cycles=1 if reason == "budget" else 10)
    first = completed_cycle(services, work)
    if reason != "budget":
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id,
            new_training_records=[Record(prompt="accepted child example", completion="A", split="train")]))
        if reason == "stale_parent":
            run_worker(services, once=True)
    before = state(services)
    message = {"budget": "budget", "active": "active", "stale_parent": "latest cycle"}[reason]
    with pytest.raises(Conflict, match=message):
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id,
            new_training_records=[Record(prompt="rejected request input", completion="B", split="train")]))
    assert state(services) == before
    # The rejected request never admitted this input to training, so it is still eligible for a holdout.
    registered = services.datasets.create(DatasetCreate(name="independent holdout", records=[
        Record(prompt="rejected request input", completion="B", split="test")]))
    assert registered.counts == {"test": 1}


def test_queue_insert_failure_rolls_back_dataset_splits_cycle_and_job(services, base, dataset, monkeypatch):
    work = workflow(services, base, dataset)
    first = completed_cycle(services, work)
    before = state(services)
    insert = services.repository._insert_job

    def fail_after_insert(db, job):
        insert(db, job)
        raise RuntimeError("injected queue failure")

    monkeypatch.setattr(services.repository, "_insert_job", fail_after_insert)
    with pytest.raises(RuntimeError, match="injected"):
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id,
            new_training_records=[Record(prompt="rolled back input", completion="A", split="train")]))
    assert state(services) == before


def test_split_conflict_rolls_back_earlier_new_fingerprints(services, base, dataset):
    work = workflow(services, base, dataset)
    first = completed_cycle(services, work)
    services.datasets.create(DatasetCreate(name="external holdout", records=[
        Record(prompt="reserved elsewhere", completion="A", split="test")]))
    before = state(services)
    with pytest.raises(Conflict, match="another split"):
        services.workflows.start_cycle(work.id, CycleCreate(parent_cycle_id=first.id,
            new_training_records=[
                Record(prompt="new before conflict", completion="A", split="train"),
                Record(prompt="reserved elsewhere", completion="A", split="train"),
            ]))
    assert state(services) == before

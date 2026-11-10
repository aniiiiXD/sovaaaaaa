"""Validated, read-only access to the prepared ContractNLI decision records.

``train`` always refers to the deduplicated ``train_clean`` files. Gold labels
and evidence live on a separate target object and are never added to model
inputs. Documents are loaded in full; this module does not tokenize or truncate.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re
from typing import Iterator

LABELS = ("Entailment", "Contradiction", "NotMentioned")
SPLIT_FILES = {"train": ("train_clean", "train"), "dev": ("dev", "dev"), "test": ("test", "test")}
DEFAULT_DATASET = Path(__file__).resolve().parents[1] / "datasets" / "processed" / "contractnli"


class DatasetIntegrityError(ValueError):
    """A missing or inconsistent source record makes the dataset unsafe to load."""


@dataclass(frozen=True)
class ModelInput:
    contract: str
    statement: str
    choices: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        """Return the complete allowed model input; this contains no gold fields."""
        return {"contract": self.contract, "statement": self.statement, "choices": list(self.choices)}


@dataclass(frozen=True)
class EvidenceSpan:
    span_index: int
    start: int
    end: int
    text: str


@dataclass(frozen=True)
class GoldTarget:
    label: str
    evidence: tuple[EvidenceSpan, ...]


@dataclass(frozen=True)
class DecisionExample:
    decision_id: str
    document_id: str
    source_file: str | None
    model_input: ModelInput
    target: GoldTarget


@dataclass(frozen=True)
class SplitAudit:
    document_counts: dict[str, int]
    within_split_duplicate_groups: dict[str, tuple[tuple[str, ...], ...]]
    cross_split_exact_matches: int


@dataclass(frozen=True)
class _Document:
    document_id: str
    text: str
    spans: tuple[tuple[int, int], ...]
    source_file: str | None


def _records(path: Path) -> Iterator[tuple[int, dict]]:
    try:
        with path.open(encoding="utf-8") as file:
            for line_number, line in enumerate(file, 1):
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise DatasetIntegrityError(f"Invalid JSON at {path}:{line_number}") from exc
                if not isinstance(record, dict):
                    raise DatasetIntegrityError(f"Expected an object at {path}:{line_number}")
                yield line_number, record
    except OSError as exc:
        raise DatasetIntegrityError(f"Cannot read dataset file: {path}") from exc


def _nonempty_string(value: object, field: str, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DatasetIntegrityError(f"Invalid {field} at {location}")
    return value


def _text_hash(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class ContractNLILoader:
    """Join contracts and decisions, validating the three official splits.

    Initializing checks document IDs and exact whitespace-normalized document
    overlap across splits. The official test set contains an internal duplicate;
    it is reported in ``audit`` but left unchanged. Near duplicates and pretraining
    contamination are outside the scope of this exact check.
    """

    def __init__(self, dataset_dir: str | Path = DEFAULT_DATASET) -> None:
        self.dataset_dir = Path(dataset_dir)
        self._statements = self._load_statements()
        self._documents = {split: self._load_documents(split) for split in SPLIT_FILES}
        self.audit = self._audit_documents()

    def _load_statements(self) -> dict[str, str]:
        path = self.dataset_dir / "statements.json"
        try:
            with path.open(encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise DatasetIntegrityError(f"Cannot read statement definitions: {path}") from exc
        if not isinstance(data, dict) or not data:
            raise DatasetIntegrityError(f"Invalid statement definitions in {path}")
        statements = {}
        for statement_id, definition in data.items():
            _nonempty_string(statement_id, "statement_id", str(path))
            if not isinstance(definition, dict):
                raise DatasetIntegrityError(f"Invalid statement definition in {path}")
            statements[statement_id] = _nonempty_string(definition.get("hypothesis"), "hypothesis", str(path))
        return statements

    def _load_documents(self, split: str) -> dict[str, _Document]:
        filename, expected_source_split = SPLIT_FILES[split]
        path = self.dataset_dir / "documents" / f"{filename}.jsonl"
        documents: dict[str, _Document] = {}
        for line_number, record in _records(path):
            location = f"{path}:{line_number}"
            document_id = _nonempty_string(record.get("document_id"), "document_id", location)
            text = _nonempty_string(record.get("text"), "document text", location)
            if document_id in documents:
                raise DatasetIntegrityError(f"Duplicate document ID {document_id!r} in {path}")
            if record.get("official_split") != expected_source_split or record.get("source_dataset") != "contractnli":
                raise DatasetIntegrityError(f"Unexpected source or split at {location}")
            raw_spans = record.get("spans")
            if not isinstance(raw_spans, list):
                raise DatasetIntegrityError(f"Invalid spans at {location}")
            spans: list[tuple[int, int]] = []
            for span in raw_spans:
                if (not isinstance(span, list) or len(span) != 2 or
                    any(not isinstance(v, int) or isinstance(v, bool) for v in span) or
                    not 0 <= span[0] < span[1] <= len(text)):
                    raise DatasetIntegrityError(f"Invalid document span at {location}")
                spans.append((span[0], span[1]))
            source_file = record.get("source_file")
            if source_file is not None and not isinstance(source_file, str):
                raise DatasetIntegrityError(f"Invalid source_file at {location}")
            documents[document_id] = _Document(document_id, text, tuple(spans), source_file)
        if not documents:
            raise DatasetIntegrityError(f"No documents found in {path}")
        return documents

    def _audit_documents(self) -> SplitAudit:
        id_owner: dict[str, str] = {}
        hash_owner: dict[str, str] = {}
        duplicate_groups: dict[str, tuple[tuple[str, ...], ...]] = {}
        for split, docs in self._documents.items():
            per_hash: dict[str, list[str]] = {}
            for doc in docs.values():
                if doc.document_id in id_owner:
                    raise DatasetIntegrityError(f"Document ID appears across splits: {doc.document_id}")
                id_owner[doc.document_id] = split
                digest = _text_hash(doc.text)
                if digest in hash_owner and hash_owner[digest] != split:
                    raise DatasetIntegrityError(f"Exact normalized document text overlaps {hash_owner[digest]} and {split}")
                hash_owner[digest] = split
                per_hash.setdefault(digest, []).append(doc.document_id)
            groups = tuple(tuple(ids) for ids in per_hash.values() if len(ids) > 1)
            if split == "train" and groups:
                raise DatasetIntegrityError("Clean training split contains duplicated normalized contract text")
            duplicate_groups[split] = groups
        return SplitAudit(
            document_counts={split: len(docs) for split, docs in self._documents.items()},
            within_split_duplicate_groups=duplicate_groups,
            cross_split_exact_matches=0,
        )

    def iter_split(self, split: str) -> Iterator[DecisionExample]:
        """Yield validated examples for ``train``, ``dev``/``validation`` or ``test``."""
        if split == "validation":
            split = "dev"
        if split not in SPLIT_FILES:
            raise ValueError("split must be train, dev, validation, or test")
        filename, expected_source_split = SPLIT_FILES[split]
        path = self.dataset_dir / "decisions" / f"{filename}.jsonl"
        documents = self._documents[split]
        seen: set[str] = set()
        used_docs: set[str] = set()
        statements_by_doc: dict[str, set[str]] = {}
        for line_number, record in _records(path):
            location = f"{path}:{line_number}"
            decision_id = _nonempty_string(record.get("decision_id"), "decision_id", location)
            document_id = _nonempty_string(record.get("document_id"), "document_id", location)
            statement = _nonempty_string(record.get("statement"), "statement", location)
            statement_id = _nonempty_string(record.get("statement_id"), "statement_id", location)
            if decision_id in seen:
                raise DatasetIntegrityError(f"Duplicate decision ID {decision_id!r} in {path}")
            seen.add(decision_id)
            if record.get("source_dataset") != "contractnli" or record.get("official_split") != expected_source_split:
                raise DatasetIntegrityError(f"Unexpected source or split at {location}")
            if document_id not in documents:
                raise DatasetIntegrityError(f"Decision {decision_id!r} references a missing document in {split}")
            if statement_id not in self._statements or self._statements[statement_id] != statement:
                raise DatasetIntegrityError(f"Statement does not match its definition at {location}")
            doc_statements = statements_by_doc.setdefault(document_id, set())
            if statement_id in doc_statements:
                raise DatasetIntegrityError(f"Duplicate document and statement pair at {location}")
            doc_statements.add(statement_id)
            used_docs.add(document_id)
            doc = documents[document_id]
            if record.get("options") != list(LABELS):
                raise DatasetIntegrityError(f"Unexpected choices at {location}")
            label = record.get("gold_label")
            if label not in LABELS:
                raise DatasetIntegrityError(f"Invalid gold label at {location}")
            indices = record.get("evidence_span_indices")
            if (not isinstance(indices, list) or
                any(not isinstance(i, int) or isinstance(i, bool) or i < 0 or i >= len(doc.spans) for i in indices)):
                raise DatasetIntegrityError(f"Invalid evidence indexes at {location}")
            if (label == "NotMentioned" and indices) or (label != "NotMentioned" and not indices):
                raise DatasetIntegrityError(f"Evidence does not match the official label at {location}")
            evidence = tuple(EvidenceSpan(i, *doc.spans[i], doc.text[doc.spans[i][0]:doc.spans[i][1]]) for i in indices)
            yield DecisionExample(
                decision_id=decision_id, document_id=document_id, source_file=doc.source_file,
                model_input=ModelInput(contract=doc.text, statement=statement, choices=LABELS),
                target=GoldTarget(label=label, evidence=evidence),
            )
        if not seen:
            raise DatasetIntegrityError(f"No decisions found in {path}")
        if used_docs != set(documents):
            raise DatasetIntegrityError(f"One or more documents have no decisions in {split}")
        if any(statement_ids != set(self._statements) for statement_ids in statements_by_doc.values()):
            raise DatasetIntegrityError(f"One or more documents have incomplete statement decisions in {split}")

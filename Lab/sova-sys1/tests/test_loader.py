from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from sova_data import ContractNLILoader, DatasetIntegrityError


PROJECT = Path(__file__).resolve().parents[1]
REAL_DATASET = PROJECT / "datasets" / "processed" / "contractnli"
OPTIONS = ["Entailment", "Contradiction", "NotMentioned"]


def write_rows(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


class LoaderFixtureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.documents = {
            "train": self.document("train-id", "Café data stays private.\nSecond line.", "train"),
            "dev": self.document("dev-id", "The fee is payable in June.", "dev"),
            "test": self.document("test-id", "The parties agree to arbitration.", "test"),
        }
        self.decisions = {
            "train": self.decision("train-id", "train", "Contradiction", [0]),
            "dev": self.decision("dev-id", "dev", "Entailment", [0]),
            "test": self.decision("test-id", "test", "NotMentioned", []),
        }
        self.persist()

    @staticmethod
    def document(document_id: str, text: str, split: str) -> dict:
        return {
            "document_id": document_id, "source_dataset": "contractnli", "official_split": split,
            "text": text, "spans": [[0, len(text)]], "source_file": document_id + ".pdf",
        }

    @staticmethod
    def decision(document_id: str, split: str, label: str, evidence: list[int]) -> dict:
        return {
            "decision_id": split + "-decision", "document_id": document_id,
            "source_dataset": "contractnli", "official_split": split,
            "statement_id": "s1", "statement": "The statement to check.", "options": OPTIONS,
            "gold_label": label, "evidence_span_indices": evidence,
        }

    def persist(self) -> None:
        (self.root / "statements.json").write_text(
            json.dumps({"s1": {"hypothesis": "The statement to check."}}), encoding="utf-8"
        )
        for split in ("train", "dev", "test"):
            name = "train_clean" if split == "train" else split
            write_rows(self.root / "documents" / f"{name}.jsonl", [self.documents[split]])
            write_rows(self.root / "decisions" / f"{name}.jsonl", [self.decisions[split]])

    def test_input_and_gold_are_separate_and_full_text_is_preserved(self) -> None:
        example = next(ContractNLILoader(self.root).iter_split("train"))
        self.assertEqual(example.model_input.as_dict(), {
            "contract": "Café data stays private.\nSecond line.",
            "statement": "The statement to check.", "choices": OPTIONS,
        })
        self.assertEqual(example.target.label, "Contradiction")
        self.assertEqual(example.target.evidence[0].text, example.model_input.contract)
        self.assertNotIn("gold_label", example.model_input.as_dict())
        self.assertNotIn("evidence_span_indices", example.model_input.as_dict())

    def test_span_offsets_use_unicode_characters_not_bytes(self) -> None:
        self.documents["train"]["spans"] = [[0, 4]]
        self.persist()
        evidence = next(ContractNLILoader(self.root).iter_split("train")).target.evidence[0]
        self.assertEqual((evidence.start, evidence.end, evidence.text), (0, 4, "Café"))

    def test_uses_only_clean_training_file_and_validation_alias(self) -> None:
        write_rows(self.root / "documents" / "train.jsonl", [{"incorrect": "old file"}])
        write_rows(self.root / "decisions" / "train.jsonl", [{"incorrect": "old file"}])
        loader = ContractNLILoader(self.root)
        self.assertEqual(next(loader.iter_split("train")).document_id, "train-id")
        self.assertEqual(next(loader.iter_split("validation")).document_id, "dev-id")
        with self.assertRaises(ValueError):
            list(loader.iter_split("train_clean"))

    def test_missing_referenced_document_fails(self) -> None:
        self.decisions["train"]["document_id"] = "missing"
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "missing document"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_bad_evidence_index_fails(self) -> None:
        self.decisions["train"]["evidence_span_indices"] = [4]
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Invalid evidence"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_document_span_outside_text_fails(self) -> None:
        self.documents["train"]["spans"] = [[0, 100000]]
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Invalid document span"):
            ContractNLILoader(self.root)

    def test_document_without_decisions_is_reported(self) -> None:
        extra = self.document("orphan", "A different contract with no question.", "train")
        write_rows(self.root / "documents" / "train_clean.jsonl", [self.documents["train"], extra])
        with self.assertRaisesRegex(DatasetIntegrityError, "documents have no decisions"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_changed_statement_is_rejected(self) -> None:
        self.decisions["train"]["statement"] = "A different statement."
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Statement does not match"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_duplicate_document_statement_pair_is_rejected(self) -> None:
        duplicate = dict(self.decisions["train"])
        duplicate["decision_id"] = "another-id"
        write_rows(self.root / "decisions" / "train_clean.jsonl", [self.decisions["train"], duplicate])
        with self.assertRaisesRegex(DatasetIntegrityError, "Duplicate document and statement pair"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_missing_statement_decision_is_rejected(self) -> None:
        (self.root / "statements.json").write_text(json.dumps({
            "s1": {"hypothesis": "The statement to check."},
            "s2": {"hypothesis": "Another published statement."},
        }), encoding="utf-8")
        with self.assertRaisesRegex(DatasetIntegrityError, "incomplete statement decisions"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_absent_statement_cannot_have_evidence(self) -> None:
        self.decisions["test"]["evidence_span_indices"] = [0]
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Evidence does not match"):
            list(ContractNLILoader(self.root).iter_split("test"))

    def test_supported_statement_requires_evidence(self) -> None:
        self.decisions["train"]["evidence_span_indices"] = []
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Evidence does not match"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_unknown_gold_and_changed_choices_fail(self) -> None:
        self.decisions["train"]["gold_label"] = "maybe"
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Invalid gold label"):
            list(ContractNLILoader(self.root).iter_split("train"))
        self.decisions["train"]["gold_label"] = "Contradiction"
        self.decisions["train"]["options"] = list(reversed(OPTIONS))
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Unexpected choices"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_split_label_mismatch_fails(self) -> None:
        self.decisions["train"]["official_split"] = "test"
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Unexpected source or split"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_same_document_id_across_splits_fails(self) -> None:
        self.documents["test"]["document_id"] = "train-id"
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "Document ID appears across splits"):
            ContractNLILoader(self.root)

    def test_same_normalized_text_across_splits_fails(self) -> None:
        self.documents["test"] = self.document("other-id", "Café data stays private.  Second line.", "test")
        self.persist()
        with self.assertRaisesRegex(DatasetIntegrityError, "document text overlaps"):
            ContractNLILoader(self.root)

    def test_test_split_internal_duplicate_is_reported_and_preserved(self) -> None:
        duplicate = self.document("test-copy", self.documents["test"]["text"], "test")
        write_rows(self.root / "documents" / "test.jsonl", [self.documents["test"], duplicate])
        second = self.decision("test-copy", "test", "NotMentioned", [])
        second["decision_id"] = "test-decision-copy"
        write_rows(self.root / "decisions" / "test.jsonl", [self.decisions["test"], second])
        loader = ContractNLILoader(self.root)
        self.assertEqual(loader.audit.within_split_duplicate_groups["test"], (("test-id", "test-copy"),))
        self.assertEqual(len(list(loader.iter_split("test"))), 2)

    def test_invalid_json_fails_instead_of_being_skipped(self) -> None:
        (self.root / "decisions" / "train_clean.jsonl").write_text("{bad json}\n", encoding="utf-8")
        with self.assertRaisesRegex(DatasetIntegrityError, "Invalid JSON"):
            list(ContractNLILoader(self.root).iter_split("train"))

    def test_missing_dataset_file_fails(self) -> None:
        (self.root / "documents" / "dev.jsonl").unlink()
        with self.assertRaisesRegex(DatasetIntegrityError, "Cannot read dataset file"):
            ContractNLILoader(self.root)


@unittest.skipUnless(REAL_DATASET.is_dir(), "Prepared ContractNLI data is not present locally")
class PreparedDatasetTests(unittest.TestCase):
    def test_real_split_counts_evidence_and_isolation(self) -> None:
        loader = ContractNLILoader(REAL_DATASET)
        self.assertEqual(loader.audit.document_counts, {"train": 420, "dev": 61, "test": 123})
        self.assertEqual(loader.audit.cross_split_exact_matches, 0)
        self.assertEqual(len(loader.audit.within_split_duplicate_groups["test"]), 1)
        for split, expected in (("train", 7140), ("dev", 1037), ("test", 2091)):
            count = 0
            for example in loader.iter_split(split):
                count += 1
                self.assertEqual(set(example.model_input.as_dict()), {"contract", "statement", "choices"})
                self.assertIn(example.target.label, example.model_input.choices)
                for span in example.target.evidence:
                    self.assertEqual(span.text, example.model_input.contract[span.start:span.end])
            self.assertEqual(count, expected)


if __name__ == "__main__":
    unittest.main()

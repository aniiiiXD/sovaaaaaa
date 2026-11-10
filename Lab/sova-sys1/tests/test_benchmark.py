"""Synthetic checks for the performance benchmark's accounting and packaging."""

from __future__ import annotations

import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest import mock

from sova_bench.collect_sagemaker import read_archive
from sova_bench.metrics import percentile, summarize
from sova_bench import submit_sagemaker


def row(number: int, *, tokens: int = 100, ms: float = 10, status: str = "scored") -> dict:
    result = {"decision_id": str(number), "document_id": str(number), "status": status}
    if status == "scored":
        result.update({"input_tokens": tokens, "end_to_end_ms": ms, "tokenization_ms": ms / 4,
                       "gpu_forward_ms": ms / 2, "gpu_peak_allocated_bytes": 100,
                       "gpu_peak_reserved_bytes": 120, "prediction": "Entailment",
                       "reference_prediction": "Entailment"})
    return result


class BenchmarkMetricTests(unittest.TestCase):
    def test_interpolated_percentile_and_invalid_measurements(self):
        self.assertEqual(percentile([20, 10], 0.5), 15)
        self.assertAlmostEqual(percentile([10, 20], 0.95), 19.5)
        self.assertIsNone(percentile([], 0.5))
        with self.assertRaises(ValueError):
            percentile([float("nan")], 0.5)
        with self.assertRaises(ValueError):
            percentile([1], 1.1)

    def test_excludes_skips_from_latency_and_counts_bucket_coverage(self):
        rows = [row(1, tokens=100, ms=10), row(2, tokens=1500, ms=20),
                row(3, status="context_too_long")]
        result = summarize(rows)
        self.assertEqual(result["requests"], 3)
        self.assertEqual(result["scored_requests"], 2)
        self.assertEqual(result["context_too_long"], 1)
        self.assertEqual(result["overall"]["end_to_end_ms"]["p50"], 15)
        self.assertEqual(result["token_buckets"]["1-512"]["examples"], 1)
        self.assertEqual(result["token_buckets"]["1025-2048"]["examples"], 1)
        self.assertIsNone(result["token_buckets"]["513-1024"]["end_to_end_ms"]["p95"])
        self.assertEqual(result["peak_gpu_allocated_bytes"], 100)

    def test_refuses_duplicate_ids_and_invalid_timing(self):
        with self.assertRaises(ValueError):
            summarize([row(1), row(1)])
        with self.assertRaises(ValueError):
            summarize([row(1, ms=-1)])
        with self.assertRaises(ValueError):
            summarize([row(1, tokens=4097)])

    def test_records_prediction_disagreements(self):
        changed = row(2)
        changed["prediction"] = "Contradiction"
        self.assertEqual(summarize([row(1), changed])["prediction_disagreements_with_saved_run"], 1)


class BenchmarkPackageTests(unittest.TestCase):
    def test_package_excludes_test_labels(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            name = "datasets/processed/contractnli/decisions/dev.jsonl"
            data = root / name
            data.parent.mkdir(parents=True)
            data.write_text("{}\n", encoding="utf-8")
            for directory in ("sova_data", "sova_model", "sova_eval", "sova_bench"):
                (root / directory).mkdir()
                (root / directory / "__init__.py").write_text("", encoding="utf-8")
            path = root / "bundle.tar.gz"
            with mock.patch.object(submit_sagemaker, "ROOT", root), mock.patch.object(submit_sagemaker, "FILES", [name]):
                hashes = submit_sagemaker.package(path)
            with tarfile.open(path) as archive:
                names = archive.getnames()
            self.assertIn(name, names)
            self.assertNotIn("datasets/processed/contractnli/decisions/test.jsonl", names)
            self.assertEqual(set(hashes), set(names))

    def test_collector_rejects_unexpected_archive_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "output.tar.gz"
            with tarfile.open(path, "w:gz") as archive:
                data = b"unsafe"
                member = tarfile.TarInfo("../escape")
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))
            with self.assertRaises(ValueError):
                read_archive(path)


if __name__ == "__main__":
    unittest.main()

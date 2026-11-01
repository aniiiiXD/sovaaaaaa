from types import SimpleNamespace

from rig.domain.models import ComparisonGate
from rig.evaluation.service import comparison_failures


def test_missing_price_never_passes_a_cost_comparison():
    baseline = SimpleNamespace(score=0.8, p95_latency_ms=100, estimated_usd_per_1k=None)
    assert "comparison_cost_estimate_missing" in comparison_failures(
        baseline, 0.9, 50, None, ComparisonGate(max_estimated_cost_ratio=0.5))


def test_gates_require_all_selected_improvements():
    baseline = SimpleNamespace(score=0.8, p95_latency_ms=100, estimated_usd_per_1k=2)
    gate = ComparisonGate(min_score_gain=0.02, max_latency_ratio=0.9, max_estimated_cost_ratio=0.5)
    assert comparison_failures(baseline, 0.82, 90, 1, gate) == []
    assert comparison_failures(baseline, 0.81, 91, 1.1, gate) == [
        "required_quality_gain_not_met", "required_latency_ratio_not_met",
        "required_estimated_cost_ratio_not_met",
    ]


def test_zero_baseline_cost_cannot_be_beaten_by_positive_cost():
    baseline = SimpleNamespace(score=1, p95_latency_ms=10, estimated_usd_per_1k=0)
    assert comparison_failures(baseline, 1, 10, 0.01, ComparisonGate(max_estimated_cost_ratio=1)) == [
        "required_estimated_cost_ratio_not_met",
    ]

import pytest

from rig.domain.models import EvalConfig, QualityGate
from rig.evaluation.metrics import gate_failures, score


def config(metric):
    return EvalConfig(dataset_id="a" * 32, metric=metric)


@pytest.mark.parametrize("answer", ["contains 42 somewhere", "42 or 43", "NaN", "inf", "42%"])
def test_numeric_scoring_does_not_extract_convenient_substrings(answer):
    assert score(answer, "42", config("numeric")) == 0


def test_numeric_tolerance():
    assert score("42.0000001", "42", config("numeric")) == 1
    assert score("43", "42", config("numeric")) == 0
    assert score("1e999999999999999999999999", "42", config("numeric")) == 0


def test_normalized_exact_does_not_reward_extra_explanation():
    assert score("  Credit   Card ", "credit card", config("normalized_exact")) == 1
    assert score("I think credit card", "credit card", config("normalized_exact")) == 0


def test_missing_cost_cannot_pass_a_cost_gate():
    failures = gate_failures(QualityGate(max_estimated_usd_per_1k=1), 1, 10, None)
    assert failures == ["cost_estimate_missing"]

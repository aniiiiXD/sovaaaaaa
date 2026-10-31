from decimal import Decimal, DecimalException
import math
import re
import unicodedata

from rig.domain.models import EvalConfig, QualityGate


def normalized(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def score(prediction: str, expected: str, config: EvalConfig) -> float:
    if config.metric == "exact":
        return float(prediction == expected)
    if config.metric == "normalized_exact":
        return float(normalized(prediction) == normalized(expected))
    # Numeric scoring requires the whole answer to be a number. Never extract a
    # convenient matching number from an otherwise wrong paragraph or calculation.
    number = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$")
    if not number.fullmatch(prediction.strip()) or not number.fullmatch(expected.strip()):
        return 0.0
    try:
        actual, gold = Decimal(prediction.strip()), Decimal(expected.strip())
        tolerance = max(Decimal(str(config.numeric_absolute_tolerance)),
                        abs(gold) * Decimal(str(config.numeric_relative_tolerance)))
        return float(abs(actual - gold) <= tolerance)
    except (DecimalException, OverflowError):
        return 0.0


def percentile(values: list[float], quantile: float) -> float:
    if not values:
        raise ValueError("A percentile needs observations")
    ordered = sorted(values)
    position = (len(ordered) - 1) * quantile
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def gate_failures(gate: QualityGate, quality: float, p95_ms: float,
                  estimated_cost: float | None) -> list[str]:
    failures = []
    if quality < gate.min_score:
        failures.append("score_below_minimum")
    if gate.max_p95_latency_ms is not None and p95_ms > gate.max_p95_latency_ms:
        failures.append("p95_latency_above_maximum")
    if gate.max_estimated_usd_per_1k is not None:
        if estimated_cost is None:
            failures.append("cost_estimate_missing")
        elif estimated_cost > gate.max_estimated_usd_per_1k:
            failures.append("estimated_cost_above_maximum")
    return failures

# Evaluation library

Create versioned, reusable evaluations around real customer tasks so model and prompt changes can be compared on the same cases.

## Initial scope

- Versioned cases with inputs, expected properties, and data provenance.
- Per-case results alongside aggregate quality, latency, and cost metrics.
- Pluggable deterministic checks and clearly labeled human review.
- A held-out set for checking that improvements are not limited to training examples.

## Acceptance check

Two model versions can run against the same frozen dataset and produce an inspectable report with per-case outputs, scoring details, and comparable operational metrics. Dataset and evaluator versions are recorded with every run.

Do not use one aggregate score to hide failures on high-impact cases; retain the case-level evidence.

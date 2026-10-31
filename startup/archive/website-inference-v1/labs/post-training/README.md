# Post-training rig

Build a controlled path from approved examples and expert feedback to a specialist-model experiment, then measure the result against the same evaluation set.

## Initial scope

- Validate data format, provenance, licensing, and sensitive-data handling before a run.
- Record dataset versions, train/validation/holdout splits, base model, settings, and produced artifacts.
- Keep training examples separate from the held-out evaluation set.
- Compare each candidate with its baseline before promotion; keep the run reproducible.

## Acceptance check

An approved dataset can produce a reproducible run manifest and a candidate model that is evaluated on held-out customer tasks. A candidate is not promoted unless the evaluation shows a useful improvement without unacceptable regressions.

No training provider or runtime is selected yet. Keep the runtime behind an adapter so the first pilot can choose based on its data, quality, and deployment constraints.

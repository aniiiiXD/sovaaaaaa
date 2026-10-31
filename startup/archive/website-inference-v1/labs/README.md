# SOVA Labs

This is the product workspace for turning the SOVA website promises into tested software. Keep product code, experiments, and benchmark evidence here; a capability is not considered shipped until its behavior is measured on a real task.

## Areas

- [`inference/`](./inference/README.md) — serve and compare multiple models through one SOVA interface.
- [`evaluations/`](./evaluations/README.md) — maintain task-specific eval sets and compare quality, latency, and cost.
- [`post-training/`](./post-training/README.md) — curate training data, run specialist-model experiments, and validate results.

## First milestone

Choose one customer workflow and a small, approved set of representative examples. Record a general-model baseline, run the same cases through at least two model options, and keep per-case quality, latency, and cost results. Only then decide whether post-training improves the workflow enough to justify a training run.

No model provider, customer data store, or training runtime is wired up yet. Add those behind the interfaces and controls agreed for the first pilot; do not treat placeholder results as product evidence.

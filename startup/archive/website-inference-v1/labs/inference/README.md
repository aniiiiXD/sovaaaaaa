# Multi-model inference

Build one SOVA interface for sending a task to approved model providers and comparing the resulting work.

## Initial scope

- A provider adapter per model API, with one normalized request and response shape.
- Explicit model selection first; add routing policies only when an evaluation can justify them.
- Capture model/version, latency, token usage, retries, and provider-reported cost for each request.
- Set timeouts and clear error behavior. Never silently present a failed or partial response as a successful one.

## Acceptance check

The same request can run against two model adapters, with outputs and operational metrics stored side by side. A provider outage is visible to the caller and in the run record.

No provider is connected yet; credentials and provider choice belong in environment configuration, never source control.

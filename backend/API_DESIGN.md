# API design — the three demos

Date: 2026-10-29. Status: design, nothing deployed. Parent plan: `SERVING_PLAN_DEMOS.md`.

## Decision: extend the Next.js backend, skip FastAPI (for now)

The playbook proposes a FastAPI hub on AWS. We already run a **live,
authenticated, production backend** in the website:

- `POST /api/v1/chat/completions`, `GET /api/v1/models` (`src/lib/inference-runtime`)
- `POST /api/demo/run` — the pattern to copy: access-code auth
  (`SOVA_DEMO_ACCESS_CODE`), max-2-concurrent guard, byte-bounded input,
  warmup flag, 240 s timeout, no-store responses
- Vercel OIDC → AWS credentials; keys never reach the client; streaming validated

A second FastAPI service would mean a second thing to authenticate, deploy,
and keep alive, for zero capability gain at demo scale. **FastAPI becomes
worth it only if/when a background worker or scheduled jobs appear.**

## Route map (website route → API → model)

| Public page | API route | Auth | Backend | Model |
|---|---|---|---|---|
| `/extract` | `POST /api/v1/extract` | public, rate-limited | Bedrock | imported Fin-o1-14B |
| `/extract` sample set | `GET /api/v1/extract/samples` | public | static JSON | none |
| `/arena` | `GET /api/v1/arena/results` | public, cached | static JSON from `Lab/arena/build_scoreboard.py` | none |
| `/arena` live run | `POST /api/v1/arena/run` | **access code** + max-1 active | Bedrock (+ specialist endpoint) | both |
| `/arena` failure explorer | `GET /api/v1/arena/cases/[id]` | public | static JSON | none |
| `/private` | `POST /api/v1/private/infer` | **access code** | isolated endpoint (see airgap runbook) | specialist |
| `/private` proof | `GET /api/v1/private/attestation` | public | static JSON | none |

## Contracts

All responses `Cache-Control: no-store` except the cached arena reads.
Errors, everywhere: `{ "error": "human readable" }` with 400/401/429/503 —
same as the existing demo route.

### `POST /api/v1/extract`

Request: `{ "sampleId": string }` or `{ "document": string (40..10_000 bytes) }`.

Response:
```json
{
  "fields": { "vendor": "", "invoice_number": "", "date": "",
              "subtotal": 0, "tax": 0, "total": 0 },
  "raw_output": "",
  "latency_ms": 0,
  "usage": { "input_tokens": 0, "output_tokens": 0 },
  "validation": { "per_field": "…", "exact_match_ratio": 0.0 }
}
```
Numbers pass through currency/number normalization before compare.
`validation` present only when the sample has ground truth.

### `POST /api/v1/arena/run`  (auth, mirrors `/api/demo/run` discipline)

Request: `{ "suite": "extract", "limit": 10..50 }`.
Runs both models with **identical prompts and decoding params**, streams
progress or returns a job, writes `results.jsonl`, updates the scoreboard
JSON. Public pages only ever read the committed JSON — a live run never
writes to a public page without passing the arena gates.

Metrics (unchanged from playbook, already half-implemented in `Lab/arena`):
field accuracy, document accuracy, P50/P95 latency, cost per 1k docs
(Fireworks published rates; AWS instance-seconds at measured utilization).

### `POST /api/v1/private/infer` + `GET /api/v1/private/attestation`

Infer: `{ "prompt": string (≤1_000 chars) }` → `{ "output", "latency_ms",
"isolation": { "mode": "vpc-isolated | offline-host", "verified_at": "…",
"checks": "…" } }`. Attestation: the static record of the isolation
verification (see `AIRGAP_RUNBOOK.md`). Wording rule: describe it as
**network-isolated / private inference**, never "certified air-gapped".

## Backend rules carried over from the live service

- Bounded inputs (bytes + chars), bounded `max_tokens`, hard timeout with
  `AbortSignal.any([request.signal, AbortSignal.timeout(...)])`
- Access codes via env only; concurrency guards per route
- Log timing, token counts, finish reason, request id — never prompts,
  never credentials
- New providers plug into `inference-runtime` with an internal alias
  (stable caller-facing name → pinned deployment/ARN)

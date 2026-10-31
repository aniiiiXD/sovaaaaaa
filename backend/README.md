# Backend

Shared infrastructure common to everything: AWS connections, model serving
configs, and (as it grows) databases and API services.

```
backend/
├── aws/      SageMaker endpoint config, model package, boto3 session helper
├── bedrock/  Bedrock model-import scripts + IAM policies (trust, invoke,
│             S3 read, Vercel access)
├── API_DESIGN.md          The three-demo API contract (extract/arena/private)
├── SERVING_PLAN_DEMOS.md  Model × demo matrix, quota/billing reality, cost rules
└── AIRGAP_RUNBOOK.md      Private-inference options + verification protocol
```

## Scope

- Anything that connects the ML labs or the website to the outside world
  (cloud credentials, endpoints, policies) lives here.
- Future DBs and API services belong in this folder.
- Note: the website's API route handlers (`website/src/app/api/`) stay in
  the Next.js app — Next.js requires them there. This folder is the home
  for shared infra they call into.

## Sources

Moved from `sova-labs/serving/` during the 2026-10-29 restructure.
See each subfolder's README for runbooks.

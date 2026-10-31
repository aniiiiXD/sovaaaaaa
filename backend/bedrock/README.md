# Sova Fin-o1 serverless deployment

Target: `TheFinAI/Fin-o1-14B`, revision `bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d`, original BF16 weights. Its `Qwen3ForCausalLM` architecture and Transformers 4.51.3 configuration match Bedrock's supported import requirements. Bedrock successfully imported this checkpoint.

## Current status (2026-10-24)

**LIVE:** `https://sova-native.vercel.app/api/v1`, model `fin-o1-14b`. JSON and streaming were verified through Vercel OIDC and the tested deployment was promoted. Main-domain authenticated chat returned HTTP 200 and the correct answer; unauthorized requests return 401. See `validation.json`.

Administrator setup completed using version 2 of the bootstrap. Both IAM roles and Vercel OIDC are configured; the user has the scoped managed policy. All 16 Virginia S3 objects match the local checkpoint by size: 29,552,590,506 bytes, including all six weight shards.

Bedrock import completed:
`arn:aws:bedrock:us-east-1:169970912263:model-import-job/frqte2u3ndp2`.
First live invocation succeeded: a revenue increase from 120 to 150 produced the correct final answer, 25%. It generated 306 completion tokens in about 6.8 seconds including CLI/network overhead, after an initial cold start. This is a smoke result, not a representative benchmark. Imported ARN: `arn:aws:bedrock:us-east-1:169970912263:imported-model/agzp8jpcfo1b`. The model uses 2 CMUs v1.0: approximately $0.5718 per active five-minute window and $3.90/month model storage, excluding S3 and transfer. Exact billed charges have not been retrieved. No dedicated SageMaker or Fireworks instance is running.

## Administrator setup

Review the JSON files in this directory, then run with an administrator profile in the same account:

```sh
python3 bootstrap-admin.py --profile YOUR_ADMIN_PROFILE --apply
```

In AWS CloudShell signed into this account as an administrator, omit `--profile`.

For AWS Console users: sign into account `169970912263` with an administrator identity, open [CloudShell in Virginia](https://us-east-1.console.aws.amazon.com/cloudshell/home?region=us-east-1), then paste:

```sh
aws s3 cp s3://passkarwado-useast1/sova/setup/bedrock-admin-v2.zip /tmp/sova-bedrock-admin.zip --region us-east-1 &&
unzip -o /tmp/sova-bedrock-admin.zip -d /tmp/sova-bedrock-admin &&
python3 /tmp/sova-bedrock-admin/bootstrap-admin.py --apply
```

This private archive contains only the reviewed bootstrap script and five JSON policies; no credentials. Version 2 uses a managed policy to avoid the IAM user 2,048-byte aggregate inline-policy limit and includes read-only inspection of the import role. CloudShell uses the console identity, so signing in as `PassKarwado` will not resolve its IAM denial.

The script creates:

- `SovaBedrockModelImport`: Bedrock trust restricted to this account's Virginia import jobs, read-only access to the pinned S3 checkpoint prefix.
- The Vercel OIDC provider `https://oidc.vercel.com/aniiiixds-projects` if absent.
- `SovaBedrockInvoke`: trust restricted to `sova-native`, production, the exact team audience; only invocation rights for Virginia imported models tagged `SovaService=fin-o1-14b`.
- Customer-managed policy `SovaBedrockImport`, attached on `PassKarwado`: pass only the import role to Bedrock, create tagged imports in Virginia, inspect and invoke tagged models. No IAM administrator rights are granted.

The script verifies the account and refuses to overwrite an existing role with different trust. It does not import a model, allocate a dedicated GPU, perform inference, or copy secrets.

## Upload and import

Local weights: `../../../models/Fin-o1-14B` relative to the repository root's parent workspace.
The original upload to the private Mumbai bucket has completed. The server-to-server copy into the private Virginia bucket is also complete and verified. Both buckets have all four public-access-block settings enabled. Destination:

```text
s3://passkarwado-useast1/sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/
```

After the Mumbai upload finishes, synchronize the remaining objects (this copies data, no model compute):

```sh
aws s3 sync s3://passkarwado/sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/ \
  s3://passkarwado-useast1/sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/ \
  --source-region ap-south-1 --region us-east-1 --profile passkarwado --sse AES256 --no-progress
```

From this directory, verify completeness before submission:

```sh
python3 import-model.py --check-only
python3 import-model.py --submit
```

The preflight compares each S3 object size to the verified local checkpoint and requires six shards. It refuses missing or unexpected model files and checks the import role's trust. Submission uses an idempotent request token and tags the imported model for the runtime IAM policy. Poll the returned job ARN with `aws bedrock get-model-import-job --job-identifier ARN --profile passkarwado --region us-east-1`. Do not enable Sova until status is `Complete` and a direct invocation succeeds.

## API release

The website's Bedrock adapter uses `InvokeModel` / `InvokeModelWithResponseStream`, not Converse (unsupported for Qwen3). It converts AWS events into OpenAI SSE and preserves reasoning and usage. Cold-start errors return 503; retry with backoff. Mock tests and real JSON/SSE calls pass; smoke timings are recorded in `validation.json`. Streaming usage is incomplete in this Bedrock import; use non-streaming token counts for accounting.

Production environment: `SOVA_INFERENCE_PROVIDER=bedrock`, `AWS_REGION=us-east-1`, `AWS_ROLE_ARN=arn:aws:iam::169970912263:role/SovaBedrockInvoke`, `BEDROCK_MODEL_ARN=<successful import ARN>`, existing private `SOVA_API_KEY`. Enable `SOVA_INFERENCE_ENABLED=true` only when the model is ready. AWS keys and the HF token are not needed in Vercel. See `../../../website/docs/inference.md` for API usage and validation.

## Cost and compute policy

User requested completion of this serverless deployment after being told of five-minute billing and storage charges. This does not authorize switching back to a continuously billed dedicated GPU. The laptop only uploads files, makes control-plane requests and runs mock tests. Initial live testing should be limited to one direct request and JSON/streaming gateway checks.

Bedrock Custom Model Import has no import fee. Virginia Qwen pricing currently lists $0.05718 per custom model unit per minute, billed in five-minute active windows, plus $1.95 per CMU per month for storage. CMUs are determined by the import. One active window costs `CMUs * $0.28590`; get `customModelUnitsPerModelCopy` and `customModelUnitsVersion` before inference and confirm the matching rate. Inactive compute scales to zero after five minutes. No keep-warm job is configured. S3 storage and cross-region copy charges also apply. Exact incurred costs and AWS credit coverage are not yet verified.

Dedicated SageMaker model/endpoint-config metadata exists in Mumbai as a fallback, but no endpoint is running. Do not launch it alongside this path. Fireworks model upload also has no serving deployment.

Sources: [supported imports](https://docs.aws.amazon.com/bedrock/latest/userguide/model-customization-import-model.html), [import service role](https://docs.aws.amazon.com/bedrock/latest/userguide/model-import-iam-role.html), [invocation](https://docs.aws.amazon.com/bedrock/latest/userguide/invoke-imported-model.html), [pricing](https://aws.amazon.com/bedrock/pricing/), [Vercel OIDC](https://vercel.com/docs/oidc/aws), [IAM resource tags](https://docs.aws.amazon.com/service-authorization/latest/reference/list_bedrock.html).

# Fin-o1 on AWS SageMaker

Prepared October 24, 2026. **No GPU endpoint has been launched.**

User confirmed AWS account `169970912263`, profile `passkarwado`; Mumbai preferred, US fallback. Quota in both Mumbai and US East permits one `ml.g6e.2xlarge` SageMaker endpoint. EC2 G-family quota is zero in Mumbai, Virginia, Ohio and Oregon, and this IAM user cannot inspect EC2 instances. SageMaker is the working route. Quota does not guarantee physical GPU capacity.

Registered in `ap-south-1`:

- Model and endpoint configuration: `sova-fin-o1-14b-bd4b97b8`.
- Execution role: `arn:aws:iam::169970912263:role/PasskarwadoSageMaker`.
- Checkpoint upload destination: `s3://passkarwado/sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/`. SSE-S3 encryption; bucket blocks public access. Weight transfer is in progress.
- One L40S GPU with 48 GB memory, 64 GiB host RAM, BF16 weights, 8,192-token context and up to four concurrent sequences.
- AWS vLLM image `server-sagemaker-cuda-v2.7`, with GPU host AMI `al2-ami-sagemaker-inference-gpu-3-1`. Model network isolation enabled; weights mount from S3 at `/opt/ml/model`. No Hugging Face credential is stored in the cloud model configuration.

`model.json` and `endpoint-config.json` are the exact registered settings. The instance has local NVMe storage; SageMaker rejects an explicit `VolumeSizeInGB` for this instance type, so that field is omitted.

## Cost and compute policy

AWS's regional price list published October 23, 2026 lists hosting `ml.g6e.2xlarge` in Mumbai at **$3.365825/hour**, before storage, requests, transfer and tax. AWS credit eligibility/balance has not been verified. Metadata registration does not launch a billed GPU; creating the endpoint does.

Follow the user's `ask-before-compute` skill: show the exact command, machine, estimated duration, cost and output and obtain approval for each paid run. A first session is limited to 60 minutes (about $3.37 instance time, plus extras), with deletion at the end or on failure. Do not launch until all weights are present and verified in S3.

From `backend`, after approval:

```sh
caffeinate -i python3 serving/aws/session.py --minutes 60
```

The script verifies AWS account, registered model/configuration, and every staged file size before invoking:

```sh
aws sagemaker create-endpoint \
  --endpoint-name sova-fin-o1-14b-bd4b97b8 \
  --endpoint-config-name sova-fin-o1-14b-bd4b97b8 \
  --tags Key=Project,Value=Sova \
  --profile passkarwado --region ap-south-1
```

It monitors the endpoint and deletes it at its deadline or when terminated. The watchdog runs independently of API requests, but it is a local process: **leave it and the laptop running**. `caffeinate` prevents idle sleep. Laptop shutdown or SIGKILL can prevent automatic cleanup. If interrupted, manually delete and verify absence:

```sh
aws sagemaker delete-endpoint --endpoint-name sova-fin-o1-14b-bd4b97b8 --profile passkarwado --region ap-south-1
aws sagemaker describe-endpoint --endpoint-name sova-fin-o1-14b-bd4b97b8 --profile passkarwado --region ap-south-1
```

Retain free model/configuration metadata and S3 artifacts for reuse. The script reports elapsed-time cost as an estimate, not an invoice; actual costs must be checked in AWS Billing after usage appears. Never launch AWS and Fireworks GPUs together for this test.

## Sova backend

The backend supports `SOVA_INFERENCE_PROVIDER=sagemaker`, `AWS_REGION=ap-south-1` and `SAGEMAKER_ENDPOINT=sova-fin-o1-14b-bd4b97b8`. Local development uses `AWS_PROFILE=passkarwado`. Keep `SOVA_INFERENCE_ENABLED=false` until the approved endpoint is healthy.

The SDK signs SageMaker calls and unwraps event-stream `PayloadPart` bytes into normal SSE. The public contract remains `/api/v1/chat/completions`, model `fin-o1-14b`, protected by `SOVA_API_KEY`.

Production AWS authentication is not configured yet. This IAM user cannot create Vercel's OIDC provider; for the initial bounded session, short-lived AWS session credentials can be stored as sensitive Vercel environment variables if available. A persistent release should use a dedicated invocation identity or an administrator-created OIDC role, scoped to the endpoint. Do not expose credentials to browser code.

## Sources

- [AWS vLLM SageMaker deployment](https://aws.github.io/deep-learning-containers/vllm/deployment/sagemaker/)
- [AWS vLLM configuration](https://aws.github.io/deep-learning-containers/vllm/configuration/)
- [Uncompressed SageMaker model artifacts](https://docs.aws.amazon.com/sagemaker/latest/dg/large-model-inference-uncompressed.html)
- [Mumbai SageMaker price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonSageMaker/current/ap-south-1/index.json)

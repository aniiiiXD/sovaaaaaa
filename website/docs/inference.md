# Sova inference API

**Live in production:** `https://sova-native.vercel.app/api/v1`, model `fin-o1-14b`, provider AWS Bedrock Custom Model Import in `us-east-1`. Authentication uses the existing private `SOVA_API_KEY`. Vercel exchanges its OIDC token for scoped AWS credentials; no AWS access keys were copied into the deployment. JSON and SSE were tested through the exact promoted deployment, and an authenticated request to the main production domain returned HTTP 200 with the correct 25% answer.

Target: `TheFinAI/Fin-o1-14B`, Qwen3-14B, revision `bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d`. The original BF16 weights live outside this repository in `../models/Fin-o1-14B`. Fireworks model resource: `accounts/anixd/models/fin-o1-14b-bd4b97b8`. Serving precision depends on the approved deployment shape.

## Environment

Keep these server-only values in the ignored `.env.local` for local development and in Vercel's production environment for deployment. Do not overwrite the existing contact-form credentials or use `NEXT_PUBLIC_` prefixes.

| Variable | Meaning |
| --- | --- |
| `SOVA_API_KEY` | Private caller key, at least 32 characters. Separate from the provider key. |
| `FIREWORKS_API_KEY` | Provider credential. Never sent to callers. |
| `FIREWORKS_DEPLOYMENT` | Exact `accounts/anixd/deployments/<deployment-id>` resource. |
| `SOVA_INFERENCE_ENABLED` | Must be exactly `true` to accept inference calls. |
| `SOVA_INFERENCE_PROVIDER` | `bedrock` (selected), `fireworks` (default), or `sagemaker`. |
| `AWS_REGION` | Bedrock: `us-east-1`; SageMaker fallback: `ap-south-1`. Pin explicitly on Vercel. |
| `BEDROCK_MODEL_ARN` | Exact imported-model ARN returned after a successful import. |
| `AWS_ROLE_ARN` | Production Bedrock role: `arn:aws:iam::169970912263:role/SovaBedrockInvoke`. |
| `SAGEMAKER_ENDPOINT` | For SageMaker: `sova-fin-o1-14b-bd4b97b8`. |
| `AWS_PROFILE` | Local only: `passkarwado`. Do not set this in Vercel. |

Bedrock uses Vercel OIDC federation when `AWS_ROLE_ARN` is set, or the local AWS SDK credential chain otherwise. Production needs no copied AWS access keys. The prepared IAM role trusts only Sova's production project and can invoke only imported models tagged `SovaService=fin-o1-14b` in this account and region. Administrator setup is complete. SageMaker fallback uses the standard SDK credential chain. All providers retain the same caller key and API contract.

The Hugging Face token is used for weight downloads only and is not needed in Vercel. Update environment values and redeploy when enabling/disabling the API or rotating keys. Deleting the Fireworks deployment stops GPU billing independently of Vercel.

## Requests

Base URL: `https://sova-native.vercel.app/api/v1`.

- `GET /models`: authenticated model discovery; advertises `fin-o1-14b`. This is not a GPU readiness probe.
- `POST /chat/completions`: authenticated text chat, with optional SSE streaming.

```sh
curl https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"model":"fin-o1-14b","messages":[{"role":"user","content":"Revenue rose from 120 to 150. What is the percentage increase?"}],"max_tokens":1024,"stream":true}' \
  --no-buffer
```

OpenAI-compatible clients can use this base URL with the Sova key and model alias. Only the documented text-chat subset is supported; tools, images, Responses API, and arbitrary model routing are not implemented. Responses preserve provider reasoning fields, usage and finish reasons. Bedrock responses use the `fin-o1-14b` alias and convert AWS EventStream JSON chunks to SSE; Fireworks and SageMaker pass their response bodies through. No reasoning mode is overridden.

Supported fields: `model`, `messages`, `stream`, `stream_options.include_usage`, `max_tokens`, `temperature`, `top_p`, `stop`, `seed`, `n=1`. Messages accept only `role` (`system`, `user`, `assistant`) and string `content`. Unknown fields are rejected.

Limits: 128 KiB JSON body, 1–64 messages, 16,000 aggregate UTF-8 text bytes, 1–4,096 output tokens (default 1,024), and a 240-second deadline. The provider enforces its actual token/context limit; the byte limit is not a token count. The route allows 300 seconds on Vercel. Four simultaneous requests are admitted per process; this is not a global rate limit across Vercel instances. Keep the key private. Bedrock scales idle compute to zero after five minutes; cold starts can return 503 and callers should retry with backoff. Active inference is billed in five-minute windows plus monthly model storage. No automatic inference retries are performed by this adapter.

Authentication failures return 401; invalid inputs 400/413/415; admission/provider capacity failures 429; disabled/starting service 503; provider timeout 504; other provider failures 502. Provider error bodies are sanitized. Once a streaming response starts, disconnects/timeouts terminate the stream rather than changing its HTTP status; callers must treat a missing `[DONE]` as incomplete. Client cancellation aborts provider fetches, though already consumed GPU time remains billable.

Logs contain request ID, status, total duration and time to first response byte. They contain neither prompts nor credentials. First byte is not necessarily the first answer token, especially for reasoning models.

## Validation and release

`npm run test:inference` uses in-memory transports and does not invoke cloud models. Nineteen tests cover authentication, input limits, routing, JSON and SSE, cancellation, failures, timeout, Bedrock cold starts, ARN pinning, Unicode and interrupted streams. TypeScript, targeted ESLint and the production build must pass before release. Next.js and eslint-config-next were updated from 16.2.9 to 16.4.3; vulnerable transitive dependencies were updated. The Vercel AWS credentials helper is pinned to 3.1.2 because the newer release pulls a vulnerable CLI dependency. `npm audit` reports zero vulnerabilities.

The IAM bootstrap, weight upload, Bedrock import, direct invocation, staging JSON/SSE tests and production promotion are complete. Production homepage returns 200, unauthenticated discovery returns 401, authenticated discovery returns 200, and authenticated inference returns 200. The last production smoke request generated 309 tokens in 4.978 seconds including network overhead. These small arithmetic checks verify integration, not model accuracy on broader finance tasks or comparative speed.

## Compute policy

The laptop handles uploads, control-plane requests and mock tests. Inference runs in Bedrock and scales down when idle. The user explicitly requested completion of this serverless deployment after being told its five-minute billing and storage terms. Do not launch a dedicated SageMaker or Fireworks instance under that authorization. Record Bedrock CMUs and expected billing before the first invocation; use only a few smoke requests. Import has no separate import fee; S3 storage, cross-region transfer, model storage and active inference can cost money. Exact charges and credit coverage have not been verified.

## Live model validation

Bedrock imported ARN: `arn:aws:bedrock:us-east-1:169970912263:imported-model/agzp8jpcfo1b`. Exact release: `https://sova-native-muqqdz0bm-aniiiixds-projects.vercel.app`, deployment `dpl_fkZCX8HC4Ksxn4FBpn9xBFNXfccv`. Authenticated JSON and SSE both returned HTTP 200 and the correct final answer (25%) through Vercel OIDC. JSON reported 305 completion tokens; the SSE response ended with `[DONE]`. Request timings include CLI/network overhead and are smoke measurements, not benchmarks.

**Streaming usage limitation:** this Bedrock import currently emits no OpenAI `usage` chunk, even with `stream_options.include_usage=true`. Its raw invocation metrics report zero input tokens. The gateway preserves the provider response and does not invent counts. Use non-streaming JSON responses for token accounting. Fin-o1 emits its reasoning and final-answer headings inside `message.content`; the gateway preserves that text.

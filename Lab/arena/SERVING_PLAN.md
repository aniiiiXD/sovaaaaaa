> Live (2026-10-24): Fin-o1-14B on Bedrock Custom Model Import in Virginia, served by Sova with Vercel OIDC. JSON and streaming validated and production promoted. See [Bedrock runbook](../serving/bedrock/README.md). Dedicated SageMaker/Fireworks plans below are inactive fallbacks.

# Fin-o1 serving plan

Date: 2026-10-24. Status: weights downloaded and structurally verified; private Fireworks upload in progress; Sova backend implemented locally and mock-tested. No GPU deployment or Vercel release launched. Fireworks validation currently reports `payment method is required`; account `anixd` needs billing setup.

AWS update: the user selected AWS as an alternative and approved account `169970912263` (`passkarwado`), Mumbai preferred. Mumbai and US East SageMaker quota each permit one `ml.g6e.2xlarge`. The Mumbai model and endpoint configuration are registered; weights are uploading to private S3. No GPU endpoint is launched. The current runbook is `../serving/aws/README.md`; the Sova backend supports both providers and all 13 mock tests, lint, TypeScript and production build pass.

## Objective and model

Serve the released Qwen-based financial specialist behind a private SOVA backend, ready for experiments tomorrow. This replaces the training-first sequence in PLAN.md for the immediate task.

Selected checkpoint: `TheFinAI/Fin-o1-14B` (Qwen3-14B), revision `bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d`. The older, differently named `Fino1-8B` uses Llama; it is not our target. Pin the exact repository revision during preparation. Preserve the supplied tokenizer and chat template. [Model card](https://huggingface.co/TheFinAI/Fin-o1-14B)

## Request path

Authenticated caller → SOVA backend → private Fireworks deployment → streamed response.

Use the existing Next.js backend in `website` for the first integration. Implemented routes: `POST /api/v1/chat/completions` and `GET /api/v1/models`. See `../../website/docs/inference.md` for the interface and limitations. The provider API key stays on the server. Map a stable internal alias to the explicit Fireworks deployment resource so experiments can change the model without changing callers.

## Execution order

1. **Access and configuration.** Verify Fireworks authentication, credits, GPU quota, and Hugging Face access to the exact checkpoint. Fireworks account `anixd` authentication and Hugging Face model access now work. Credentials are in the ignored `website/.env.local`. Model files are in `models/Fin-o1-14B`; all six shard sizes and tensor headers agree with the index. Do not print credentials.
2. **Prepare the backend before GPU launch.** Add server-side provider configuration, caller authentication, request validation, bounded prompt/output sizes, streaming, cancellation, timeouts, and request limits. Restrict callers to the configured model. Log timing, token counts, finish reason, and request ID; omit credentials and prompt contents. Validate these paths with a mocked upstream. Confirm the hosting runtime supports the required stream duration.
3. **Prepare the checkpoint.** Pin the model revision and stage weights in an approved location. Keep large weights outside Git. Upload the complete checkpoint and verify the model reaches READY. Use cloud storage transfer if already available; select a transfer route and estimate its time before starting a large download. [Custom model requirements](https://docs.fireworks.ai/models/uploading-custom-models)
4. **Select and price the deployment.** Run `firectl deployment-shape-version match --model <MODEL_RESOURCE>`. Choose a validated shape compatible with the checkpoint; record precision, GPU type/count, context limit, and total hourly rate. Start with at most one replica. The installed CLI disallows combining `--deployment-shape` and `--max-context-length`, so use the validated shape’s context limit and bound request sizes in the backend. Prefer BF16 for the initial reference if available; record any other precision explicitly. Do not assume a default shape uses one GPU.
5. **Launch the approved serving session.** Show the fully resolved command, machine, duration, estimated cost, and output before launch. Set max replicas to one. During active verification keep one replica warm, and arrange teardown at session completion and on failure. A timed cleanup must be independent of the client stream so disconnecting cannot leave an unattended deployment.
6. **Verify the full path.** First make one direct provider call, then call through the authenticated backend. Run a small approved smoke set covering ordinary text, simple financial arithmetic, a table, and a multi-turn request. Check streaming, finish reason, output truncation, cancellation, invalid input, missing authentication, provider errors, and timeouts. Measure time to first content token and total latency separately; record output tokens and generation rate. This confirms serving, not frontier parity.
7. **Handoff and shut down.** Deliver the endpoint contract, example request, model revision, deployment configuration, smoke results, timing/token logs, restart/teardown commands, and cost report. Delete the test deployment and verify deletion. Retain the uploaded model and configuration for tomorrow. If continuous availability is wanted, price and explicitly schedule that separately.

## Command templates

These are planning templates, not commands executed in this session. Resolve account, model, shape, and deployment names before approval.

```sh
firectl model create <MODEL_ID> <CHECKPOINT_DIRECTORY>
firectl model get <MODEL_RESOURCE>
firectl deployment-shape-version match --model <MODEL_RESOURCE>
firectl deployment create <MODEL_RESOURCE> \
  --deployment-id <DEPLOYMENT_ID> \
  --deployment-shape <VALIDATED_SHAPE_RESOURCE> \
  --min-replica-count 1 \
  --max-replica-count 1
firectl deployment get <DEPLOYMENT_RESOURCE>
firectl deployment delete <DEPLOYMENT_RESOURCE> --wait
```

Provider API: `https://api.fireworks.ai/inference/v1/chat/completions`, with the explicit deployment resource as the model identifier. Capture creation output rather than constructing a provider-owned model name. [Deployment quickstart](https://docs.fireworks.ai/getting-started/ondemand-quickstart)

## Time and cost

Engineering estimate: 2–4 hours for preparation, backend integration, and a verified first serving session once credentials and model access work. Transfer time, validated-shape availability, and GPU quota can extend this; this is not a provider guarantee.

Current listed H100/H200 price: $8 per GPU-hour. If the validated shape uses one such GPU, 30–60 billable minutes is approximately $4–8; propose a $10 initial serving-session budget, subject to the actual shape. Multiple GPUs multiply this estimate. A continuously warm single GPU at that rate is $192 per day. Backend hosting, transfer, storage, and taxes are additional where applicable. Verify actual usage after teardown and mark billing data pending if not yet available. [Fireworks pricing](https://fireworks.ai/pricing)

Scale-to-zero is an optional later development mode: it saves idle GPU cost but introduces cold starts and can return `503 DEPLOYMENT_SCALING_UP`. It is not equivalent to an always-warm endpoint. [Autoscaling behavior](https://docs.fireworks.ai/deployments/autoscaling)

## Tomorrow

Evaluate quality, latency, output length, and cost on the intended workloads with the exact checkpoint and prompt settings recorded. Repair the existing numeric scorer before using its results. Compare serving optimizations only after establishing the selected 14B reference. Published performance is contextual evidence; our speed and token-efficiency claims require our own measurements.

## Compute policy

The laptop handles code and short control-plane operations; model inference runs on Fireworks. Follow the existing ask-before-compute policy: each deployment or compute run requires its own concrete command, machine, duration, cost estimate, output description, and approval. Retries with changed configurations require a new run approval. The user authorized upload and backend preparation. Resolve the exact paid launch configuration and cost for approval. Delete dedicated serving resources after each approved session and report costs. AWS remains a fallback if Fireworks cannot accept or provision the checkpoint; do not launch both providers in parallel.

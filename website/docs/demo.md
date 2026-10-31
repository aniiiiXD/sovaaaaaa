# Sova Studio sales demo

Route: `/demo`. A finance-workflow demonstration built on the existing Fin-o1-14B Bedrock endpoint. The homepage navigation links to it.

Both example tabs initially show genuine outputs recorded on 24 October 2026, labeled **Recorded run** with their original timing and token counts. Aster returned 659 output tokens in 11.083 seconds; Northline returned 647 in 9.433 seconds. Both passed all four numeric checks. Aster was tested through the local app against Bedrock; Northline through the deployed Vercel app and OIDC. These are smoke tests, not a comparative or load benchmark. The recordings contain only the fictional sample documents, and the UI rejects a recording when the current source or task instruction differs. Public visitors can inspect and export these recordings without incurring inference costs.

## Two-minute sales walkthrough

1. Before the meeting, open Presenter access and use `SOVA_DEMO_ACCESS_CODE` from the ignored `.env.local`. This is a separate credential from `SOVA_API_KEY`; share only the demo code with an authorized presenter. It remains in the current browser tab's memory and clears on reload.
2. Click **Prepare model**. If Bedrock reports a cold start, wait 20–30 seconds and prepare again. Startup can take minutes. Prepare shortly before presenting; compute can scale down after five idle minutes. There is no automatic keep-warm loop.
3. Show **Aster Systems**. Explain that it is fictional data and the workflow is a financial brief with four numerical fields and source references. Click **Run financial brief**.
4. Inspect the generated metrics and summary. The four checks compare numerical fields with predefined expected answers. Citation checks only establish that listed section IDs exist, not that every sentence is supported. Expand the full response if helpful.
5. Open **Reference brief** to show the prepared target. It is never included in the model prompt. Switch to **Northline Components** to demonstrate negative cash flow if another run is useful.
6. Use **Your excerpt** for a prospect's authorized sample. Paste text, not a PDF; add section IDs such as `[S1]`. Custom excerpts have no reference answer and are explicitly marked for human review. The maximum is 10,000 UTF-8 bytes.
7. Export the JSON run report, which includes the source, full task instruction, outputs, token counts, server timing, checks, warm-up timestamp if available, and caveats. **Discuss a pilot** opens the existing Sova booking page.

Suggested talk track: “This is the workflow before customer-specific training. In a pilot, we agree on your quality threshold, evaluate your current system, and test whether a specialized model can meet that threshold with lower latency and cost. Your examples and expert corrections guide the work.”

Do not claim that this example proves broad financial accuracy, paid customer results, customer-specific training, frontier superiority, or a cost/speed advantage. Measure those on the customer's workload.

## Live access and provider setup

`SOVA_DEMO_ACCESS_CODE` must be at least 32 characters and is server-only. It is separate from provider credentials. Both local and production environments have it. No secret is included in client bundles or URL parameters. Paid inference is inaccessible without this credential. The UI and reference examples are publicly viewable.

The existing `SOVA_INFERENCE_ENABLED`, `SOVA_API_KEY`, `AWS_REGION`, `AWS_ROLE_ARN`, and `BEDROCK_MODEL_ARN` configure Fin-o1. The demo internally calls the existing inference handler, retaining its authentication and provider safeguards.

Optional frontier comparison uses `BEDROCK_DEMO_BASELINE_ID`, restricted to `us.openai.gpt-6.1-sol`, `global.openai.gpt-6.1-sol`, `us.anthropic.claude-opus-5-5`, or `global.anthropic.claude-opus-5-5`. An optional `BEDROCK_DEMO_BASELINE_ROLE_ARN` selects a separately provisioned Vercel OIDC role; otherwise the existing AWS role is used. The baseline requires account model access and IAM invocation permissions for its inference profile and destination models. Merely setting the variable does not grant these permissions.

On 24 October 2026, a direct GPT-6.1 Sol smoke invocation returned AWS `AccessDeniedException`: the model is not available for this account. The production role also currently permits only the tagged Fin-o1 import. No permissions were broadened, no model terms accepted, and no baseline variable was enabled. The UI therefore disables the frontier comparison and offers clearly labeled reference checks. The adapter is implemented for an authorized baseline when access is available.

## Measurements and interpretation

The demo uses non-streaming responses to retain real token accounting. Duration measures server-side time around the provider request and response; it is not time to first token and excludes browser-to-server transit. Effective output tokens/second includes provider/network overhead and reasoning tokens. There are no simulated timing values or fabricated output counts.

Both comparison requests receive identical source/task instructions and a 2,048-token maximum. Fin-o1 uses temperature 0.2; the optional frontier uses its default supported sampling/reasoning settings. This is a product demonstration, not a controlled benchmark of equivalent reasoning settings. A response that hits the token limit is marked incomplete and cannot pass numerical checks.

The Fin-o1 cost caption reports published shared-capacity billing ($0.5718 per active five-minute window per copy), not a per-answer price. Storage and other infrastructure charges are additional. The baseline does not report dollar costs until rates are verified and implemented. No savings percentage is fabricated.

## Data and operational limits

The application holds source text and results in memory for a request/browser session; it does not persist them in an application database. Model requests transmit text to AWS Bedrock. Provider/platform processing and retention policies still apply. Exporting downloads the source document and outputs to the presenter's machine.

Errors are sanitized and contain no provider diagnostic payloads or credentials. Requests are bounded to 24KB, with 10KB of document text and a 240-second model deadline. Demo admission allows two simultaneous requests per process; the existing Fin-o1 handler also applies its four-request per-process cap. This is not a distributed account-level quota. Keep the presenter credential private; rotate it for a broader event or separate customer access.

There is no automatic retry or keep-warm job. Stop aborts the HTTP/model request, but already performed inference can still be billable. No document execution, remote URL fetch, file upload, or model-selected tools are enabled.

## Validation and compute policy

`npm run test:demo` covers reasoning/JSON extraction, numerical errors, citation IDs, custom-document review behavior, fail-closed credential checks and bounded request bodies. `npm run test:inference` covers the provider adapters. TypeScript, targeted lint, production build and browser review are part of release verification.

The laptop runs the app build, mock tests and HTTP control requests. Inference runs on the existing Bedrock import; no new GPU instance or training job is created. A small number of live smoke requests validate the explicitly requested demo. Larger evaluation/training runs require their own scoped run plan, estimated cost and user authorization. Current serving billing is approximately $0.57 per active five-minute window per model copy; actual billed usage and credit coverage are not available from these tests.

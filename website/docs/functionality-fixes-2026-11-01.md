# Website functionality repair

The existing layout, typography, colors, and CSS are preserved.

## Changes

- The homepage identifies saved playback as Replay and derives its throughput from recorded tokens and duration (59.5 tok/s).
- Both demo pages use the API's serving configuration and baseline allowlist. Configuration checks do not claim provider health or IAM access.
- Homepage capability flags are evaluated at request time.
- The presenter form resumes the selected action on submission and reopens after rejected credentials.
- The workbench guards duplicate requests, times out stalled requests, and prevents stopped or superseded requests from updating results.
- Switching comparison mode preserves the specialist result. Empty exports are disabled; download URLs are released after the browser can consume them.
- Raw homepage responses remain inspectable when structured parsing fails.
- Footer service links resolve to real section IDs.

## Validation

- 28 demo and inference tests passed with mocked transports; no provider calls.
- TypeScript, scoped ESLint, diff whitespace checks, and the production build passed.
- Chrome local production-build check: saved replay and measured throughput, sample switching, reference expansion, and invalid-code recovery.
- Local browser testing used invalid test credentials and an automatically stopped local server. No customer data, contact messages, or paid inference requests were sent.

## Production state and remaining verification

The public site is https://sova-native.vercel.app/. Inspection on November 1 found production deployment `dpl_DXA94u6N2oKENXZpAmQBbAPoCME5`, created October 29. It has not received these fixes yet.

Production has no `BEDROCK_DEMO_BASELINE_ID` setting, so a real comparison cannot run until an account-accessible model and serving-role permissions are configured. The existing baseline allowlist has not been expanded. Read-only AWS model inventory was unavailable because the local CLI has no credentials; production uses Vercel OIDC. Specialist inference has not been exercised in this repair; a successful page load or configuration check does not prove it works.

CDN request-log retrieval was unavailable on the current Vercel plan. No plan upgrade was attempted. Contact delivery has not been tested because that sends a message.

## Compute policy

Publishing requires the user's per-run approval under their ask-before-compute skill. Proposed command from `website/`: `vercel deploy --prod --yes`. It builds on Vercel (approximately 30–90 seconds), consumes existing Vercel build quota, and updates the production site; it does not provision model capacity. Actual incremental billing depends on the account plan. Paid inference verification is a separate explicitly approved run; no model warmup or training is included in deployment.

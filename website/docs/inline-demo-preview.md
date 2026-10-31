# Homepage comparison demo

2026-10-24. Implements the user's approved ASCII layout: preserved skyline hero, scroll cue, shared question + Run button, Sova/GPT answer panels, speed/time/accuracy table, Talk to us CTA, then all original sections.

## Behavior
- Initial example replays the saved Aster response when the section enters view. Answer animation is presentation-only, explicitly labeled; it does not claim original token timings.
- Run replays the default question without paid inference. Editing the question clears stale answers/metrics and requires presenter access for a fresh run.
- Live requests use the same source, question and parameters for both connected models. Requests run independently; failures, Stop, timeout and unmount are handled per generation to prevent stale results.
- Preview environments without live configuration offer a link to the existing live presenter demo. Presenter codes remain in memory and are sent only in the Authorization header.
- GPT is currently not configured. Its panel says so and its metrics remain blank. No invented GPT answer or comparative performance claim.
- The recorded Sova speed prominently shows 120 tok/s as a target, not measured. Recorded response time and four calculation checks are evidence-backed. Fresh live runs show actual effective output rate.
- Existing /api/demo/run now accepts an optional validated question and includes it for both model paths. Older requests without a question retain the original prompt behavior.

## Verification
- Production build / TypeScript and scoped ESLint passed.
- Six demo tests passed, including optional-question validation and existing recording/auth checks.
- Browser verified desktop two-column panels, 390px/320px stacking with no horizontal overflow, Run replay, custom-question access dialog, invalid credential handling, and reduced-motion full answer.
- Authenticated API checks: invalid question -> 400; unconfigured baseline -> 503. Neither invokes a model.
- GLM review (hyde/glm-5.3-flash) found no blockers; log /tmp/sova-comparison-glm-review.jsonl.
- Original sections from Services through Footer match the pre-inline backup byte for byte. No production promotion or new paid inference performed.

Preview: https://sova-native-huyrf1bnk-aniiiixds-projects.vercel.app/#live-demo
Screenshot: ../Research/sova-labs/sova-comparison-preview.jpg

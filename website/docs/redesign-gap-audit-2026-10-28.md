# SOVA website: gap audit against the redesign primer

Audited 28 October 2026. Sources: live homepage and `/demo`, local website code, saved Banking77 reports and evaluation code, and YC's official Requests for Startups page. This is an audit, not a deployed redesign. No inference or training was launched.

## Main finding

The strongest available story is enterprise model ownership, demonstrated by a narrow specialist improvement. The current site mixes that story with broad inference claims, incomparable provider numbers, and a separate finance demo. Align the evidence and product experience before expanding the claims.

Preserve the existing workflow diagram and useful deployment content. The homepage needs a new hierarchy and verified proof; it does not need another capabilities catalog.

## Required differences

| Area | Current state | Required change | Priority |
| --- | --- | --- | --- |
| Positioning | “Your workflows deserve their own model”; “Frontier quality without frontier bills.” | “Own your intelligence.” Explain business data, workflow evaluations, model adaptation, and control of deployment. Keep sovereign inference as a capability. | P0 |
| Proof | Banking77 accuracy mixed with provider speed/cost comparisons and an 8B serving footnote. | One explicitly scoped 0.6B experiment; link to methodology and limitations. Remove unsupported frontier equivalence and incompatible comparisons. | P0 |
| Demo | Public recorded Fin-o1-14B finance brief; live calls need presenter access; frontier comparison disabled. | Banking77 baseline and specialist on the same input, with actual outputs and measured latency. Clearly identify any retained finance demo as a separate experiment. | P0 |
| Benchmark page | No dedicated `/benchmarks` route. | Publish model/dataset revisions, split construction, hardware/software, prompts, scoring, run settings, raw outputs, case IDs, and cost methodology. | P0 |
| Trust and conversion | Placeholder email, unsupported “most chosen”, anonymous team claims, broken footer anchors, broad privacy promises. | Working contact path; factual team identities; deployment-specific data boundaries; remove unsupported adoption claims; repair navigation. | P0 |
| Homepage order | Hero → workflow → services → proof → serving → capabilities → why → plans → contact. | Hero → proof → product loop → interactive demo → deployment → three workflows → pilot CTA. | P1 |
| Product structure | Overlapping services with broad LIVE labels. | Train / Serve / Private, each with an accurate availability statement and concrete deliverable. | P1 |
| Deployment | Shared/dedicated/private presented broadly. | Distinguish actual operating modes and customer responsibilities. Air-gapped remains a planned capability until offline operation is demonstrated. | P1 |
| Use cases | Eight broad workflows described as already used by teams. | Financial extraction, financial-operations classification, private assistants; label examples versus demonstrated capabilities. | P1 |
| Pilot | Generic call and free-text form. | “One workflow. One measurable outcome.” Capture workflow, baseline, quality target, and deployment constraints; deliver a benchmark-backed pilot proposal. | P1 |
| Visual system | Dark city photography, serif display type, orange accent. | Primer proposes restrained dark engineering visuals, interface typography, cyan/teal accent, and actual product evidence. Review the first screen before applying a global visual replacement. | P2 |
| Vertical page | No focused financial-operations landing page. | Reuse the verified classification proof and a specific pilot offer on a finance page. | P2 |

## What the saved Banking77 evidence actually supports

These figures were recalculated from saved CSVs, not from a fresh model run.

| Measure | Untuned Qwen3 0.6B | SOVA LoRA Qwen3 0.6B |
| --- | ---: | ---: |
| Correct cases | 101 / 770 | 608 / 770 |
| Accuracy | 13.1169% | 78.9610% |
| Reported median throughput | 87.5 tok/s | 81.5 tok/s |
| Median time to first token | about 82.1 ms | 112.2 ms |
| Mean recorded total generation time, including first-token wait | 428.6 ms | 176.3 ms |

The accuracy gain is **65.8 percentage points** when calculated from the counts and rounded once. The site's 65.9 comes from subtracting rounded percentages.

The specialist completed requests faster on average in these recordings, but did not improve token throughput or first-token latency. The saved results are consistent with shorter completions. Do not turn this into a general claim of faster inference or a frontier-model win.

### Evidence defects to resolve

1. The comparison row called “Frontier API” is actually the small untuned Qwen baseline. Relabel it.
2. The 8B dedicated-serving footnote describes a different configuration from the 0.6B result. Separate the experiments.
3. `$0.14 / 1,000 tasks` is an estimate based on post-first-token generation time and an assumed $8/hour GPU rate. The run documentation describes local MLX/M5 execution. This is not observed cloud billing. The estimate omits first-token wait, idle capacity, and other serving costs; remove it as a headline price.
4. Cross-provider throughput/pricing rows have no inspectable common test protocol in this implementation. Remove them or publish separately sourced, explicitly non-equivalent reference information. A controlled comparison needs the same task set, scoring, output constraints, concurrency, warm/cold conditions, model versions, and cost boundary.
5. The evaluation counts stream chunks and divides by time after the first chunk. Validate token accounting and timing before presenting that value as authoritative token throughput.
6. Prediction parsing selects the first matching label in the label list, not necessarily the first label appearing in the output. Use a documented unambiguous output contract and preserve raw responses.
7. Saved CSVs contain labels, correctness, and timings, but no inputs, stable case IDs, raw model output, or token usage. They do not yet support the requested per-case inspection.
8. The 770-case sample can be reconstructed with seed 77 and its gold-label order matches both CSVs. After whitespace/case normalization, one sampled prompt also appears in training and another in validation. The specialist got the training-overlap case right; both models missed the validation-overlap case. Deduplicate splits and rerun before advertising a fully clean held-out evaluation. This limited overlap does not explain the large observed improvement, but needs disclosure and correction.
9. Pin model/dataset revisions and capture exact hardware, dependency versions, adapter identity, sampling settings, and run timestamp. The current artifacts do not form a complete reproducibility manifest.

Evidence paths in the parent workspace:

- `Lab/triage/reports/base.csv`, `tuned.csv`, and corresponding JSON summaries.
- `Lab/triage/eval.py`, `prepare_data.py`, `report.py`, and `README.md`.
- `Lab/triage/adapters/triage/adapter_config.json`.
- Local split sizes: 9,503 training, 500 validation, 3,080 test; evaluation samples 10 per intent across 77 intents.

## Demo implementation gap

Existing `/demo` has useful reusable pieces: a recorded-run view, presenter-gated live execution, output checks, and server-side inference integration. It currently uses TheFinAI's Fin-o1-14B, not the SOVA-trained 0.6B classifier.

The live page shows “Baseline connection pending.” Backend documentation describes an optional frontier adapter and a previous account-access failure; current frontier execution was not retested in this audit.

A coherent Banking77 demo needs:

- Serving routes for both the exact base model and the exact specialist adapter.
- Identical input and evaluation contract; labels shown as classifications, not padded into chat answers.
- Real elapsed time and token usage where available; no fabricated streaming or fixed performance numbers.
- Ground truth and correctness only for labeled examples. Arbitrary visitor input has no automatically known accuracy.
- Aggregate accuracy linked to the published evaluation, clearly separate from a single request.
- Cost shown only with a defensible provider/hardware accounting basis; otherwise omit it.
- Public access controls, distributed quotas, and a bounded inference budget before ungating execution.
- Warm/cold status and failures disclosed; recordings remain explicitly labeled fallbacks.

The existing arithmetic checks on the finance demo are not a general financial-reasoning accuracy score. Citation-ID checks likewise do not establish factual support for every claim.

## Trust and conversion details

- Replace `hello@sova.example` in Footer, About, and Careers with an operating business contact.
- Repair footer links to missing `#advise`, `#build`, and `#run` targets.
- Remove “most chosen” unless adoption data supports it.
- Qualify “your data never leaves your boundary” by deployment mode; shared/provider infrastructure is not the customer's private boundary.
- Clarify “no training on client data”: customer-authorized specialist training is the offer; reuse for unrelated customers is a separate policy.
- Replace “teams already route” with prospective-use-case language unless there is evidence of real customer use.
- Add actual founder/engineering profiles rather than relying only on “IIT engineers.”
- Verify contact delivery. The code uses Resend and configured recipient variables, but no submission was sent in this audit.
- Update metadata alongside hero copy so browser titles and social previews match the new positioning.

## YC RFS alignment

Reference: https://www.ycombinator.com/rfs (Winter 2027 entries, checked during this work).

- **Own Your Intelligence:** strongest fit for SOVA's proposed workflow → evaluation → adaptation → controlled deployment → improvement story.
- **Vertical Foundation Models:** a possible research direction, not a capability proven by a single fine-tuned intent classifier.
- **AI for the Air-Gapped Economy:** requires demonstrably offline operation, including dependencies and deployment tools. Private cloud alone does not establish this.

These are positioning references, not YC endorsement of SOVA.

## Implementation sequence and acceptance criteria

1. **Correct evidence and trust copy.** No mislabeled frontier baseline, mixed model sizes, unsupported cost headline, unsupported adoption claims, placeholder contact, or broken anchors remains.
2. **Produce a reproducible benchmark package.** Clean splits, pinned revisions, explicit protocol, raw case outputs, and hardware details; publish `/benchmarks`. A model rerun is separate compute work, not performed by this audit.
3. **Connect a coherent two-model demo.** Both outputs originate from the stated models; metrics come from the actual requests; public access has abuse controls; no fabricated frontier comparison.
4. **Rebuild homepage hierarchy and product narrative.** Implement the seven sections from the primer, reuse the workflow diagram, consolidate the three pillars, and make proof and the demo accessible within the opening scrolls.
5. **Finish conversion and visual polish.** Specific pilot flow, team credibility, finance landing page, responsive layouts, reduced-motion support, and real product visuals.

Completion means the homepage, benchmark, and demo refer to the same inspectable experiment, and every broader capability is labeled according to what is implemented and validated.

## Release caution

The local working tree contains pending homepage/demo changes that differ from the currently deployed homepage. In particular, local `HomeDemo` integration was not present on the live homepage during this audit. Preserve unrelated changes and review the release diff before deployment; do not deploy the entire dirty tree blindly.

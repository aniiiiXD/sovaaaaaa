# Added coverage: Hyde, Dvar and Isoquant

Checked 31 October 2026. These companies fill a gap in the first brief: enterprise adaptation and inference engineering. They belong on the company map even when no verified public financing amount is available. Their inclusion does not change the four-deal $610M+ financing subtotal.

## Identity and position

| Company | Public positioning | Place in the workflow |
|---|---|---|
| [Hyde](https://hyde.ai/) | Specialist enterprise models; Campfire training platform and embedded delivery teams | Enterprise data → training/evaluation → deployment → feedback |
| [Dvar](https://www.dvarlabs.ai/) | Customer-specific model adaptation and India-hosted inference | Task evaluation → model selection → post-training → sovereign serving |
| [Isoquant](https://isoquant.ai/) | Optimized open-model inference and workload-specific improvement | Adaptation → architecture/kernel/decoding optimization → serving |

`dvar.ai` did not resolve during the check. The matching enterprise AI business was found at `dvarlabs.ai`; this is the working entity match for the user's reference. None of these labels implies that every implementation or case study uses reinforcement learning.

## Funding and commercial evidence

**Hyde:** Bain Capital Ventures lists Hyde as a 2025 seed portfolio company; General Catalyst includes it in its portfolio. These are direct investor confirmations of backing. No specific financing amount or company revenue was verified in the reviewed sources. A partner logo alone would not be enough to establish investment. [BCV](https://baincapitalventures.com/team/kevin-zhang/), [General Catalyst](https://www.generalcatalyst.com/portfolio)

**Dvar:** Moneycontrol reported on 27 October 2026 that General Catalyst was in advanced discussions to invest approximately **$4M**. The article says the parties did not respond. Treat it as reported talks, not a closed round, and exclude it from raised-capital totals. No verified company revenue was found. [Original reporting](https://www.moneycontrol.com/news/business/startup/peak-xv-partners-lightspeed-activate-general-catalyst-in-talks-to-invest-in-half-a-dozen-indian-ai-startups-14060568.html)

**Isoquant:** YC's own directory confirms its membership and inference focus. Public third-party funding records disagree: one lists $125k while another lists $500k. Do not infer a company-specific closed total from standard accelerator terms or pick one directory number without confirmation. No independently verified round total or company revenue was established here. [YC](https://www.ycombinator.com/companies/isoquant/jobs), [Dealroom discrepancy](https://app.dealroom.co/companies/isoquant), [Caplight discrepancy](https://www.caplight.com/company/isoquant)

## Technical evidence to use carefully

### Hyde

Its May 4, 2026 stock-exchange case describes 75,000+ model runs and expert-defined correctness feeding post-training and continued RL. The customer is unnamed. Its $20M+ figure is a **potential customer revenue opportunity**, not Hyde's revenue or funding. No independently reproducible accuracy benchmark is supplied in this narrative. [Case study](https://hyde.ai/blog/us-stock-exchange)

### Dvar

The banking case reports a 0.5B classifier's Hinglish accuracy moving **59.7% → 88.1%** after supervised cross-entropy training. Important limitations: Sonnet answered fewer test rows; Dvar's cost uses GPU-time modeling while comparison APIs use billing; public English data may be contaminated. This is task-specific, company-reported SFT evidence, not an RL result or a clean universal model ranking. [Case study and limitations](https://www.dvarlabs.ai/banking77)

### Isoquant

Its banking comparison reports **74.7% → 91.8% accuracy**, **91.7% lower estimated inference cost**, and **931 → 588 ms mean latency** across 3,079 requests, comparing GPT-5.4 mini with a Qwen3-8B specialist. These are vendor-reported measurements; public headline numbers are not independent replication. [Case study](https://isoquant.ai/case-studies/banking-intent-classification)

Do not put Dvar and Isoquant accuracies on a shared leaderboard: the language variants, models, denominators and methods differ. Also do not attribute the similarly named academic “IsoQuant” KV-cache paper to this startup without an author/company connection; a name match is not evidence.

## What changes in the business argument

The first funding sample emphasized companies supplying frontier AI development. Add a separate enterprise layer: teams selling a specialist model, operational integration, and efficient serving for a customer's actual work.

That changes the budget to investigate. For a data supplier it is data procurement; for an environment vendor it is training/evaluation infrastructure; for an enterprise specialist it may include integration, model adaptation and recurring serving. These budgets overlap. The broad dataset-market estimate cannot represent all three companies' addressable demand.

The useful buyer metric is **cost per successful task**, subject to latency, reliability and deployment constraints. This is an analytical lens, not a verified common pricing model or proof that any one company wins.

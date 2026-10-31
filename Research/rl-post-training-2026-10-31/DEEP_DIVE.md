# Where the post-training business actually sits

Expanded research, checked **31 October 2026**. Read alongside [the original brief](RESEARCH.md) and [Hyde, Dvar and Isoquant](COMPANIES.md). Figures below are attributed announcements or experiments, not independently audited results. This is a selected landscape, not an exhaustive census.

## What the additional research changes

The useful thesis is that several businesses share the same improvement loop: obtaining task knowledge, creating practice environments, measuring outcomes, changing model behavior, and operating the resulting system. A vendor can span several steps. “RL data company” is often too broad a description to explain its buyer, costs or defensibility.

Three more dated financing announcements establish **$126M**: Applied Compute $80M, AfterQuery $30M, and Plato $16M. Separately, Bespoke announced $40M across seed and Series A rounds. Its headline is not a $40M Series A. Sources and dates follow.

## Additional capital: preserve the accounting labels

| Company | Date | Verified announcement | Treatment |
|---|---|---|---|
| Applied Compute | 8 Apr 2026 | $80M new financing; $160M cumulative; $1.3B post-money valuation | Count $80M as the announcement, not $160M plus $80M. Enterprise-specific agents and deployment. [Company](https://www.appliedcompute.com/company/fundraise) |
| AfterQuery | 9 Apr 2026 | $30M Series A at $300M valuation, led by Altos | Datasets and environments built around professional expertise. Later directory valuations are not a substitute for a verified new-round announcement. [Company-issued Business Wire release](https://www.businesswire.com/news/home/20260409469482/en/) |
| Bespoke Labs | 6 Jul 2026 | $40M across seed and Series A; seed explicitly $8.25M | Multi-round announcement. Do not label the entire amount a new Series A or assume both rounds closed in July. [Company](https://bespokelabs.ai/blog/bespoke-labs-raises-40m-to-build-environments-that-enable-reliable-agents) |
| Plato | 28 Oct 2026 | $16M Series A; $19M cumulative, led by Nava | Simulated workplaces with repeatable tasks and constraints. $19M is not this round. [Company-issued release](https://www.prnewswire.com/news-releases/plato-raises-16-million-to-build-the-training-grounds-for-ais-next-leap-into-real-work-302921832.html) |
| Veris AI | 3 Jun 2025 | $8.5M seed, led by Decibel and Acrew | Historical context outside the 2026 sample. Enterprise simulation and agent training. [Company](https://veris.ai/blog/introducing-veris-ai-a-new-way-to-train-enterprise-ai-agents-through-simulated-experience) |
| HUD | Observed 31 Oct 2026 | Employer-written YC job listing says $16M backing | Useful primary company claim, but this page does not establish a dated financing event. Exclude from a time-window funding sum. [YC listing](https://www.ycombinator.com/companies/hud/jobs/xRmqcxW-senior-software-engineer-reinforcement-learning) |

The earlier four-deal July–October subtotal remains **>$610M**, including Labelbox's equity/credit package. Extending the window to April–October and adding Applied Compute, AfterQuery and Plato yields **>$736M across seven selected announcements**. This is not an industry total, pure-equity total, or expenditure on RL. Bespoke's multi-round $40M is kept separate. Adding the original subtotal to this expanded subtotal would double-count the original four companies.

## Commercial demand: a large run rate can hide a labor-intensive business

micro1's 12 October update claims **>$1B annual run rate**, a **$4B Series B valuation**, and an approximately **$25M employee tender**. The page does not specify the primary Series B amount. It distinguishes a roughly 180-person core team from tens of thousands of experts. Do not calculate “software revenue per employee” using the core team alone, or count employee liquidity as fresh operating capital. [Company update](https://www.micro1.ai/blog/q3)

AfterQuery's April release claims **>$100M annual revenue run rate**. It is a dated company claim about sales pace, not audited annual revenue, subscription ARR, gross profit or market size. [Release](https://www.businesswire.com/news/home/20260409469482/en/)

**Interpretation:** expert sourcing, screening, task writing, QA and rework can be substantial production costs. Commercial scale does not establish high margins. No comparable audited gross-margin series was established for these private vendors in the reviewed sources.

## A fuller map of the work

These are overlapping activities, not mutually exclusive market segments. The “economic test” column is our analysis, not a claim about a company's pricing.

| Work being sold | Examples | Economic test |
|---|---|---|
| Expert tasks, demonstrations, rubrics | AfterQuery, micro1; Mercor, Turing, Snorkel in the first brief | Can accepted quality scale faster than recruitment, expert pay and rework? |
| Executable work environments | Plato, Veris, Bespoke, Fleet, Mechanize | Can the environment be reused, maintained and shown to improve held-out real tasks? |
| Environment/data platform | HUD | Does the platform reduce authoring, execution and acceptance costs across vendors and buyers? |
| Managed training infrastructure | Tinker; Prime Intellect in the first brief | Can users iterate cheaply while retaining control of tasks and reward design? |
| Enterprise adaptation and delivery | Applied Compute, Hyde, Dvar | How much integration and expert engineering repeats for every new customer? |
| Model efficiency and serving | Isoquant; portions of Dvar and Hyde | Do savings survive quality constraints, low utilization, fallback and operational overhead? |

Additional primary positioning sources: [AfterQuery product scope](https://www.afterquery.com/), [Fleet environment engineering role](https://www.fleetai.com/careers/software-engineer), [Mechanize founding thesis](https://www.mechanize.work/announcing-mechanize-inc/), [Tinker](https://thinkingmachines.ai/tinker/). Hyde, Dvar and Isoquant source details are in [COMPANIES.md](COMPANIES.md). Fleet and Mechanize are included for product scope; unconfirmed financing or transaction headlines are not counted here.

## Three technical cases worth explaining

### 1. Glean: specialize one repeated step

Glean's Waldo search planner uses **DPO followed by RL**, with LoRA through Tinker. Its reported reward includes termination and retrieval recall/F1. The company reports **~50% lower system latency and ~25% fewer tokens**. The separate **3-second versus 250-millisecond per-call** comparison is not an end-to-end speedup. Customer deployment is described as forthcoming; these are company-reported results. [Glean engineering account](https://www.glean.com/blog/waldo-launch)

**Interpretation:** a startup may improve one expensive, frequent action without replacing the model responsible for the entire task. System architecture and model training jointly affect the outcome.

### 2. Bespoke + Intuit/Credit Karma: data engineering can dominate

The coauthored SeeWhy report uses structured synthetic data, rejection filtering, LoRA SFT and GEPA prompt optimization. It describes naive fine-tuning on skewed logs making errors worse. Semantic tags bind product facts to their source and support deterministic validation.

Its offline table reports **99.2% fee accuracy** and **99.9% rate accuracy** for the final system. This is not evidence that every rubric improves: rewards accuracy is **98.3% versus 98.9%** for GPT-4.1-mini. The paper also gives inconsistent base fee accuracy in prose and table, so avoid a precise base-to-final fee uplift. The reported 15–20× serving-cost saving is not a demonstrated fully loaded project ROI. [Joint technical report](https://files.bespokelabs.ai/ck-bespoke-tr.pdf)

**Interpretation:** “more post-training” can amplify a bad data distribution. This case supports data design plus checks; it is not an RL experiment. [Company case summary](https://bespokelabs.ai/blog/post-training-seewhy-with-intuit-credit-karma)

### 3. AfterQuery + Hebbia: inspect the denominator

An October case reports a Nemotron model's perfect-solve rate moving **47% → 74%** on a nominal **100-task held-out credit set**. However, the source excludes **5 base-model and 8 post-trained judge failures**, leaving different effective denominators. One run per task and model-judged rubrics limit the precision of the comparison.

The **$3.63** adapted-model cost is an estimated solver bill for the 100-task run; grading and training costs are excluded. It is not total deployment cost. [Methods and results](https://www.afterquery.com/blog/post-training-nemotron-on-credit-workflows-in-partnership-with-hebbia)

**Interpretation:** plot this as an attributed experiment with visible missing judgments, not a universal ranking or proof of production savings.

## Actual pricing anchor, not an invented contract value

Tinker's published rates, dated **14 October 2026**, list Qwen3-8B at 32K context: **$0.195/M prefill tokens, $0.60/M sampled tokens, $0.44/M training tokens**. Checkpoint storage is separately priced. [Official pricing](https://thinkingmachines.ai/tinker/pricing/)

For illustration only, 10M uncached prefill + 20M sampled + 20M training tokens gives:

```text
10 × $0.195 + 20 × $0.60 + 20 × $0.44 = $22.75
```

This is an arbitrary metered-token basket, not the cost of achieving a quality target. It excludes experts, environment execution, grading, storage, failed experiments and engineering. Actual jobs may repeat passes and samples many times. The low unit price of a training operation does not tell you the cost of a useful learning loop.

## Return efficiency: calculate the crossover

Use the same quality and latency requirements for both systems. For a defined workload, let:

```text
F = incremental fixed cost of data, adaptation, evaluation and integration
v_base = full variable cost per task under the baseline
v_new = full variable cost per task under the proposed system

Break-even task volume = F / (v_base - v_new), if v_base > v_new
```

Include inference, retries, fallback, human review, environment/tool charges and ongoing support in the relevant costs. Amortize retraining and integration explicitly. If the new system changes quality, first establish a common acceptance threshold; cheaper failed outputs are not equivalent deliverables.

**Hypothetical example:** $50,000 setup cost and $0.02 savings per task require **2.5M tasks** to recover setup. This is arithmetic, not a vendor margin or demand forecast. High volume makes specialization more attractive; low volume or unstable tasks can favor a general API.

For your operational-difficulty/return-efficiency chart, we do not yet have comparable private-company margins, staff effort or customer lifetime economics. Use qualitative business-model hypotheses, or plot disclosed case metrics. Numeric company “ROI scores” would imply evidence we do not have.

## The technical debate worth getting right

Yue et al.'s RLVR study finds that tested RL models improve small-k success while base models can cover more problems at high sampling budgets. That is evidence about the evaluated methods, models and tasks, not a theorem that RL can never add capability. [Paper, revised November 2025](https://arxiv.org/abs/2504.13837)

ProRL reports different results under prolonged training, KL control and reference-policy resets, including improvements over base models across pass@k evaluations. [ProRL](https://arxiv.org/abs/2505.24864)

**Synthesis:** both the training recipe and evaluation budget matter. A useful business comparison measures accepted outcomes at a fixed total cost and latency, with a held-out test. Avoid “RL is just resampling” and “RL automatically creates new intelligence” as settled universal claims.

## TAM: why the earlier market estimates need restraint

The dataset-market forecasts in the original brief describe a broad externally estimated category. The cases here span expert services, environment development, compute, enterprise integration and serving. They cannot all be squeezed into that one denominator, and summing adjacent market forecasts would create overlap.

Use a budget tree for a specific offering:

| Buyer | Purchase to measure | Evidence still needed |
|---|---|---|
| Frontier lab | Accepted data/tasks, environments, evaluation work | Number of purchasing teams; annual external spend; repeat orders; concentration |
| Enterprise model team | Adaptation projects and ongoing improvement | Task volume; annual contract value; delivery hours; renewal and expansion |
| Platform/AI application team | Training and serving consumption | Active customers; token or compute use; platform take rate; infrastructure costs |

No exact standalone RL-data TAM or audited industry margin is established by this research. Announced financing shows capital supply; customer spending measures demand; annual revenue opportunity needs a defined product and buyer population.

## Best new publication angles

1. Data is becoming executable: from labeled examples to task worlds with state and grading.
2. Train the expensive repeated step: the Glean search-planner case.
3. Fine-tuning can make a model worse when the training distribution is wrong.
4. Cheap training tokens do not imply cheap operational delivery.
5. The economically relevant axis is cost per accepted outcome at a specified quality and latency.

See [new tweet drafts](TWEETS.md) 15–22 and [drawing plans](BOARDS.md) 6–8. These remain drafts; nothing has been posted.

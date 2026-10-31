# RL, post-training and data: research for a tweet series

Research cutoff: **31 October 2026**. Currency: USD unless stated. Focus: language models and software agents; robotics is outside the main funding sample. This is a selected-source research brief, not a comprehensive funding database. Nothing has been posted.

**Further research:** [DEEP_DIVE.md](DEEP_DIVE.md) adds Applied Compute, AfterQuery, Bespoke, Plato, Veris, HUD, micro1, Fleet, Mechanize and Tinker; checks three technical cases; and develops pricing, break-even economics and TAM limitations. Its expanded seven-announcement April–October subtotal is >$736M; the four-deal July–October sample below remains a separate, narrower view.

**Expanded company coverage:** [Hyde, Dvar and Isoquant](COMPANIES.md) add enterprise model adaptation and optimized inference to the map. Their funding status is tracked separately: confirmed backers, reported talks, and unverified amounts must not become invented closed-round totals. See tweets 11–14 and Board 5 for this part of the story.

## The strongest headline

**More than $610 million across four selected financings announced July–October 2026 for companies working across AI data, RL environments and training infrastructure.**

Calculation: 350 + 130 + 30 = $510M in three announced rounds; add Labelbox's $100M+ equity/credit package to exceed $610M. This is financing announced, not audited cash disbursement or spending specifically on RL. The companies sell broader products, and this is not a sector total.

| Announcement | Company | Financing | What it buys exposure to | Evidence |
|---|---|---:|---|---|
| 8 Jul 2026 | Prime Intellect | $130M Series A | Compute and infrastructure for post-training, RL, environments and evaluation | [Company announcement](https://primeintellect.one/blog/series-a); [transaction counsel](https://www.cooley.com/news/coverage/2026/2026-07-08-prime-intellect-raises-%24130-million-series-a) |
| 22 Sep 2026 | Snorkel AI | $350M Series E | Specialized AI data and environment development | [Company announcement](https://snorkel.ai/blog/data-2-0-and-the-research-era-of-ai-data/) |
| 1 Oct 2026 | Halluminate | $30M Series A | Benchmarks and RL environments for knowledge work | [Company announcement](https://www.halluminate.ai/blog/series-a) |
| 14 Oct 2026 | Labelbox | **More than $100M**, equity plus credit facility | RL environments/evaluations and managed enterprise agents | [Company-issued release](https://www.prnewswire.com/news-releases/labelbox-raises-100-million-in-series-e-funding-to-advance-reinforcement-learning-and-enterprise-ai-agents-302909147.html) |

Keep Labelbox's financing-type footnote visible on any chart. Do not call the combined total pure venture equity.

## Bigger transactions, kept in separate categories

| Company / transaction | Number | Correct label | Why it is separate |
|---|---:|---|---|
| Mercor, 27 Oct 2025 | $350M; $10B | Series C financing; valuation | Human expertise/data business. Valuation is not money raised. [Mercor](https://www.mercor.com/blog/series-c/) |
| Turing, company page dated 10 Jun 2025 | $111M; $2.2B | Series E financing; valuation | Broader AGI/data/services company. Use the page date, not an assertion that the round closed that day; other reports place the round earlier in 2025. [Turing](https://www.turing.com/blog/turing-raises-111m-to-accelerate-the-future-of-agi) |
| Ineffable Intelligence, 2026 | $1.1B | Seed funding for a frontier RL research lab | A model developer rather than an external training-data vendor; not in the $610M basket. A June 16 partner announcement confirms the preceding seed round. [Google Cloud](https://www.googlecloudpresscorner.com/2026-06-16-Ineffable-Intelligence-Selects-Google-Cloud-To-Power-Its-Superintelligence-Mission) |
| Meta–Scale, Jun 2025 | Reported $14.3B | Strategic investment / ownership transaction | Includes shareholder liquidity, not a $14.3B new training-data budget. [AP](https://apnews.com/article/4b55aabf7ea018e38ffdccb66e37cf26); [Scale](https://scale.com/blog/scale-ai-announces-next-phase-of-company-evolution) |

Meta's filing identifies $13.79B as the equity-investment accounting component of total consideration. That is a different measure from the reported transaction headline; do not present the two as interchangeable round sizes. [Meta Q2 2025 filing](https://www.sec.gov/Archives/edgar/data/1326801/000162828025036791/meta-20250630.htm)

## Demand signals, not funding

Snorkel reported a **$375M annualized revenue run rate** in September 2026. Prime Intellect reported **over $100M annualized revenue** in July 2026. Both are company claims about a recent pace, not audited full-year sales, and neither isolates revenue from RL alone. They should not be added to the financing numbers or treated as standalone market-size estimates. [Snorkel](https://snorkel.ai/blog/data-2-0-and-the-research-era-of-ai-data/), [Prime Intellect](https://primeintellect.one/blog/series-a)

Run rate is especially easy to misuse in labor-intensive businesses: invoiced sales can contain large expert-compensation and infrastructure costs. These figures do not establish software-like gross margins.

## What can we say about TAM?

The reviewed sources do not establish a reliable, separately measured global TAM for **LLM reinforcement-learning data + environments + post-training software**. The category crosses several markets.

| Publisher / scope | 2025 estimate | 2026 estimate | Future forecast |
|---|---:|---:|---:|
| Grand View Research: global AI training datasets | $3.2B | $3.9B | $16.3B in 2033 |
| Fortune Business Insights: global AI training datasets | $3.59B | $4.44B | $23.18B in 2034 |

Sources: [Grand View Research](https://www.grandviewresearch.com/industry-analysis/ai-training-dataset-market), [Fortune Business Insights](https://www.fortunebusinessinsights.com/ai-training-dataset-market-109241), accessed 31 Oct 2026. These are publisher estimates/forecasts, not a census. Their public summaries do not establish identical market definitions. Do not combine the different forecast years into one forecast range or label either number “the RL market.”

An adjacent spending anchor: Menlo estimates **$4B in model-training infrastructure spending in 2025**, within its broader $37B enterprise generative-AI estimate. Its model uses survey input and bottom-up analysis; this is not a post-training-only or RL-only category. It overlaps parts of the opportunity described above and must not simply be added to dataset-market estimates. [Menlo's 2025 report](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/)

For an actual startup, size a defined offering from buyer budgets:

```text
Annual addressable revenue
  = eligible buyers × annual spend on YOUR defined offering

Illustrative scenarios, NOT measured market estimates:
  500 buyers × $200k/year = $100M/year
  1,000 buyers × $1M/year = $1B/year
```

Validate both the buyer count and annual contract value through procurement evidence/interviews. Separate frontier-lab customers from enterprises. Separate task/data contracts from software fees and compute resale; exclude pass-through compute if describing a software-only opportunity. A few large lab buyers can create large revenue but also substantial concentration risk.

## Technical explanation worth drawing

**Post-training is the umbrella; RL is one method within it.**

| Method | Training input / signal | Practical explanation |
|---|---|---|
| Supervised fine-tuning (SFT) | Prompt and target demonstration | Learn to produce examples of the desired behavior |
| Direct preference optimization (DPO) | Preferred/rejected response pairs | Adjust preferences with a direct objective; standard offline DPO does not require online rollout generation or a separately fitted reward model |
| Reinforcement learning | Generated attempts/trajectories and reward signals | Try, score, update the policy; task outcomes can provide verifiable rewards |
| LoRA | Low-rank trainable weight updates | A parameter-efficient adaptation technique, not an RL objective; can be used with different training objectives |

Sources: [DPO paper](https://arxiv.org/abs/2305.18290), [DeepSeek-R1 paper](https://arxiv.org/html/2501.12948v1), [Hugging Face LoRA guide](https://huggingface.co/docs/peft/main/en/conceptual_guides/lora).

Useful technical numbers: the original DeepSeek-R1 report describes R1-Zero's AIME 2024 pass@1 moving **15.6% → 71.0%** during RL, from an already pretrained base. Keep the benchmark and metric attached. Do not mix in its 86.7% majority-vote result as if it were the same single-answer metric. The R1 pipeline also used roughly **800,000 curated SFT examples**, so the lesson is not that RL eliminates curated data. [Original report, sections 2.2.4 and 2.3.3](https://arxiv.org/html/2501.12948v1)

For software agents, a training environment can specify the initial state, tools, task, transition rules and a success verifier. The business may sell reusable task infrastructure rather than only static labeled rows. This is an interpretation of the shift represented by the vendors, not a claim that static datasets disappear.

**Reward and independent evaluation must stay separate in the diagram.** Maximizing a proxy reward can worsen the true objective; this is the reward-hacking problem. A better score from the training reward alone does not prove the product improved. [Reward-hacking research](https://arxiv.org/abs/2209.13085)

## Business interpretation: where a small team might compete

These are hypotheses, not measured market shares or forecasts:

- **Domain data:** acquire legitimate task access, recruit qualified experts, deliver reproducible accepted examples. Watch rejection and rework rates.
- **Environments:** reproduce a valuable workflow with resets, usable tools and meaningful scoring. Watch simulator shortcuts and whether performance transfers to actual work.
- **Verifiers/evals:** measure correctness that generic grading misses. Watch subjective criteria, disagreement and reward exploitation.
- **Post-training systems:** make repeated experiments reproducible and operationally affordable. Watch differentiation from existing providers and internal teams.
- **Vertical delivery:** sell a measurable business result, with adaptation/evaluation under the hood. Watch integration costs, reliability and service margins.

Model project economics using **accepted** work, not just generated volume:

```text
Contribution per accepted task
  = price per accepted task
    - (expert + acquisition + QA/rework + compute costs) / accepted task count
```

Illustration only: $200k revenue minus $80k expert costs, $40k QA and $20k compute produces $60k contribution, or 30%, before other expenses. This is not a claimed vendor margin or market price.

## Boundaries for public claims about Sova

Rig's current source implements **LoRA supervised fine-tuning**, evaluation, iteration, fusion/quantization and local serving interfaces. It does **not** implement PPO/GRPO or an RL rollout-and-policy-update trainer. It has not been run or tested. Say “building a post-training/evaluation loop” rather than “we have a working RL training platform.” No business revenue, quality gains or performance results for Rig have been established.

## Publication hygiene

Use the dated, categorized numbers in `facts.csv`. Use the source reply under each draft in `TWEETS.md`. Keep the distinction among funding, valuation, annualized revenue, annual market estimates and research metrics visible. Re-check dates/announcements if publishing substantially after the cutoff. Fundraising rumors and directory-only estimates were not used in the main funding basket.

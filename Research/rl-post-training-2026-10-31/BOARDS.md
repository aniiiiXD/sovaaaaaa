# Eight paper / whiteboard layouts

These are drawing plans, not charts pretending to contain measured data where none exists. Photograph one page per topic. Landscape paper, black text, one blue accent for training, one orange accent for money. Keep the headline, unit, date and source footer in the photograph. Full sources are in `RESEARCH.md` and `facts.csv`.

New layouts 6–8 draw on [DEEP_DIVE.md](DEEP_DIVE.md). They add system-level performance, break-even economics and a map of what the buyer purchases.

## Board 1 — Where money is going

Title: **AI data + RL infrastructure: four recent financings**
Subtitle: **Announcements, Jul–Oct 2026 | USD millions | selected sample**

Draw four horizontal bars against a shared zero baseline. Mark 0, 100, 200, 300 and 400. Draw their lengths proportionally; Labelbox is a lower bound, marked with an arrow/hatching after 100.

```text
Snorkel          |----------------------------------- 350
Prime Intellect  |------------- 130
Labelbox         |----------> 100+
Halluminate      |--- 30
                 0         100       200       300       400

                       Total > $610M
```

Footer: **Sources: company announcements, 8 Jul / 22 Sep / 1 Oct / 14 Oct 2026. Labelbox includes equity + credit. Not total sector funding or RL spending.**

Do not add Meta–Scale's transaction, company valuations or revenue run rates as bars on this chart. Put those on separate pages if wanted.

Pair with tweet 1.

## Board 2 — What an RL loop actually needs

Title: **From examples to experience**

Top left, a small SFT lane:

```text
Prompt + target demonstration -> supervised update -> model
```

Center, a larger RL loop:

```text
              TASK / INITIAL STATE
                      |
                      v
       MODEL -> ACTIONS / TRAJECTORY -> ENVIRONMENT
         ^                                |
         |                                v
    POLICY UPDATE <---------------- REWARD / VERIFIER
```

This is a schematic: in a real interactive episode, model actions and environment observations alternate repeatedly before and/or during reward assignment.

Outside the training loop, draw a thick dividing line and:

```text
       HELD-OUT EVALUATION -> ACCEPT / REJECT -> SERVE
```

Under the environment, write: **state · tools · transitions · goal · verifier**.
Under the dividing line: **The training reward is not independent proof of success.**

Source footer: **DeepSeek-R1 (2025); Skalse et al., reward hacking (2022/2025).** Do not show evaluation answers feeding directly into the training data.

Pair with tweets 2, 3 and 6.

## Board 3 — A technical result with the label intact

Title: **R1-Zero: AIME 2024 pass@1**

Draw two vertical bars on a 0–100% axis:

```text
100% |
     |
 71% |                       █████
     |                       █████
     |                       █████
15.6%|    █████              █████
  0% +----------------------------------
       Initial             After RL
```

Write **+55.4 percentage points** between the bars. This is the difference between the reported endpoints, not a new experiment.

Footer: **DeepSeek-R1 original report, Jan 2025. Pretrained starting model. Benchmark-specific result.**

Do not invent the shape of the learning curve between endpoints. Do not replace 71.0% with the separately reported majority-vote score.

Pair with tweet 4. For a second photo, use “R1 also used ~800k curated SFT examples” from tweet 5; avoid implying those examples were the training recipe for the separate R1-Zero experiment.

## Board 4 — TAM without mixing unlike numbers

Title: **What exactly are you selling?**

Draw three equal-size boxes; they are categories, not proportional market areas:

```text
DATA / EXPERT WORK      ENVIRONMENTS / VERIFIERS      TRAINING SOFTWARE
Accepted examples      Reusable tasks + scoring      Experiments + deployment
```

Below them:

```text
Broad AI training-dataset market, 2026 estimates:
GVR: $3.9B       Fortune BI: $4.44B

Neither isolates RL.
Do not add these two estimates together.
```

At the bottom:

```text
YOUR annual opportunity = eligible buyers × annual spend on YOUR offering
Example only: 500 × $200k = $100M / year
Buyer count and spend are assumptions to validate.
```

Footer: **Publisher estimates retrieved 31 Oct 2026. Scenario is illustrative, not measured TAM.**

Pair with tweets 7, 8 and 9. Avoid nested circles: these categories overlap and the available estimates do not establish their relative sizes.

## Suggested sequence

Post the money chart first to introduce the business question. Follow with the training-loop drawing, then the labeled research result, then the market-definition page. Each photo should make one claim understandable without reading the rest of the thread. Put the matching source links in the post or its immediate source reply.

## Board 5 — Who owns each part of the improvement loop?

Title: **Data is one layer. Delivering the specialist is another.**

Draw a horizontal workflow, then company spans below it. Spans show public product positioning, not measured capability or exclusivity.

```text
TASK DATA -> TRAIN / ADAPT -> EVALUATE -> OPTIMIZE -> SERVE
    ^                                                |
    +--------------- PRODUCTION FEEDBACK ------------+

HYDE       enterprise knowledge + training + deployment
DVAR       workflow evaluation + adaptation + India serving
ISOQUANT   specialist adaptation + inference engineering
```

Use [each company's primary site](COMPANIES.md) for the placement. These companies overlap; this is not a ranking. Add three small finance-status labels: **Hyde: backers confirmed, amount unverified; Dvar: ~$4M reported talks; Isoquant: YC-backed, total unverified.** Do not draw money-sized bubbles for unknown amounts.

For a separate technical photo, show one vendor's before/after case only. Do not compare Dvar's Hinglish accuracy directly with Isoquant's banking-intent results. Put **company-reported · task-specific** next to any result. Pair this board with tweets 11–14.

## Board 6 — Faster calls are not the same as faster work

Title: **Measure the whole system**

Draw two small horizontal-bar panels with zero baselines. Normalize each baseline to 100; label the unit **index, baseline = 100**. Waldo's full-system latency is approximately 50, and token use approximately 75. Keep the panels separate; latency and tokens are different measures. Avoid a pie chart and avoid displaying normalized values as milliseconds.

Caption: **Glean/Tinker case · company-reported · approximate · system includes orchestration and adaptive reasoning.** Source: [Tinker's Glean case](https://thinkingmachines.ai/tinker/). These are relative reductions, not raw observations. Pair with tweet 17; do not depict the separate per-call speedup as end-to-end performance.

## Board 7 — When does specialization pay back?

Title: **A custom model needs enough volume**
Subtitle: **Hypothetical economics at equivalent quality**

Use x = cumulative tasks, from 0 to 5 million. Use y = cumulative net savings after setup, from -$50,000 to +$50,000. Draw the line `y = $0.02 × tasks - $50,000`. It begins at -$50k, crosses zero at 2.5M tasks, and reaches +$50k at 5M. Put a clear dot at the crossover.

Annotate: **$50k setup; 2 cents saved per task.** The per-task saving must include retries, fallback and human review. This is not a company ROI estimate, and fixed/variable costs must be revised if maintenance changes with scale. No external market claim is implied. Pair with tweet 21.

## Board 8 — What does the buyer actually purchase?

Title: **Five businesses inside one improvement loop**

Draw equal-sized boxes in a horizontal chain:

```text
TASK KNOWLEDGE → PRACTICE WORLD → LEARNING LOOP → INTEGRATION → SERVING
examples          environments   training/evals  workflow      outcomes
```

Under the boxes, use small text labels: AfterQuery/micro1; Plato/Veris; Tinker/Prime Intellect; Hyde/Applied Compute/Dvar; Isoquant. Add a thin production-feedback arrow returning to task knowledge. The company examples overlap; box width does not encode market size or capital raised.

Below, write one question per step: **Accepted quality? Reusable world? Held-out improvement? Delivery hours? Cost per accepted task?** This is our analytical map, sourced to the primary company descriptions in [DEEP_DIVE.md](DEEP_DIVE.md) and [COMPANIES.md](COMPANIES.md). It should be a photographed explanation, not a market-share chart.

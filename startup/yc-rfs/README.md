# YC Requests for Startups — knowledge source

- **Source:** https://www.ycombinator.com/rfs (Winter 2027 edition)
- **Fetched:** 2026-10-29 via Firecrawl
- **Files:** `yc-rfs.html` (raw HTML, the knowledge source), `yc-rfs.md`
  (readable twin), `rfs-page.json` (scrape provenance)

Eleven RFS items this cycle. **Three are us.** This document maps each one
to what we have already built.

---

## 1. Own Your Intelligence — Jon Xu ← *the core thesis match*

> "More companies will want to own the models they rely on: improve them on
> their own data, run them where they choose... Someone has to turn workflows
> into evals, expertise into training data, production failures into
> improvements, and carry all of it forward with each new base model."

**That last sentence is our business.** Every piece exists in this repo:

| RFS asks for | We already have |
|---|---|
| Improve models on their own data | LoRA post-training on private datasets — Banking77 (triage), FinQA SFT (arena) |
| Turn workflows into evals | `Lab/arena/` — 200-question held-out FinQA eval, per-case CSVs, honesty rules |
| Run them where they choose | `backend/bedrock/import-model.py` — importing custom models into a customer's Bedrock; `backend/aws/` SageMaker endpoint configs |
| Carry forward with each new base model | Measured base-vs-specialist deltas per base model (13.1% → 79.0% on Banking77) |

## 2. Vertical Foundation Models — Diana Hu

> "Specialized foundation models... that work zero-shot or from a handful of
> examples. The bar is matching or beating general-purpose models at orders
> of magnitude less inference compute... The hard part is getting
> high-quality, vertical-specific, verifiable rewards."

- Small specialists vs general models is literally our arena: Qwen3-0.6B
  LoRA vs frontier on FinQA, P50 TTFT + cost measured — the "orders of
  magnitude less inference compute" claim, with numbers.
- "Verifiable rewards" — our FinQA ground truth is computed (yes/no +
  numeric scorer in `run_arena.py`), not vibes. The scoreboard on the
  website is the proof artifact.
- Her example (TimesFM-3, 330M params, one forward pass) says small is the
  point. Our positioning: better models, better prices, specific tasks.

## 3. AI for the Air-Gapped Economy — Brad Flora

> "Defense contractors, banks, hospitals... can't send it to an AI API...
> on-prem models, deployment tooling, security accreditation, and hardware."

- **Banks** = our first vertical (Banking77 intent triage).
- "On-prem models, deployment tooling" = `backend/` exists for exactly
  this: Bedrock import (model runs inside the customer's AWS account),
  IAM trust policies, Vercel access grants, SageMaker endpoints.
- We have already priced and rehearsed the serving story
  (`arena/SERVING_PLAN.md`).

---

## Adjacent (watch, don't chase)

- **The $15-an-Hour Expert** (Brad Flora) — AI-backed workers doing
  specialist work in banking/taxes/insurance. Our models could be the
  "back them with AI" layer inside someone else's product. Partnership
  surface, not a pivot.
- **LLMs That Write Well** — post-training opportunity, but off-thesis
  (not task-specific, not measurable the way our evals demand).

## Positioning takeaway

The RFS language is gift-wrapped for our pitch: **"Own your intelligence"
+ "verifiable rewards" + "run where you choose."** Use it verbatim on the
website where it fits — it's YC's vocabulary, aimed at exactly the buyer
we serve.

# SOVA ARENA — Build Plan, Code Budget & Gates

**Objective:** Live, testable Arena — Base Qwen vs SOVA specialist vs Fino1-8B vs frontier —
measured on 200 held-out FinQA questions, scoreboarded on the website.

**Date:** 24 Oct 2026 · **Budget:** $0–40 train + $200 serving buffer · **Deadline:** tonight

---

## 1. What already exists (no new code)

| Asset | Location | Status |
| --- | --- | --- |
| FinQA train/valid/eval JSONL | `Lab/arena/data/` | ✅ built |
| Arena runner (scoring, metrics) | `Lab/arena/run_arena.py` | ✅ ~200 lines |
| Base-model eval harness (MLX) | `Lab/arena/eval.py` pattern | ✅ proven on triage |
| Website + measured math section | `HeavyWork/website/` | ✅ live |
| Fireworks docs (SFT, deployment) | fetched, requirements known | ✅ read |

## 2. New code to write (~650–800 lines total, mostly glue)

| Component | File | Est. lines | Notes |
| --- | --- | --- | --- |
| Fireworks format converter | `arena/convert_finqa_fw.py` | ~70 | FinQA JSONL → `messages` chat format (system+user+assistant) |
| Train/deploy driver | `arena/fw_train.sh` + `arena/fw_deploy.sh` | ~40 | thin wrappers over `firectl` commands |
| Endpoint adapter in Arena | patch `run_arena.py` | ~80 | "endpoint" model type: OpenAI-style POST, same scoring path |
| Fino1-8B local eval | reuse `eval.py` + MLX convert step | ~30 | mlx-community conversion or direct download |
| Scoreboard generator | `arena/build_scoreboard.py` | ~60 | arena.json → static JSON for the site |
| `/arena` page | `website/src/app/arena/page.tsx` + module css | ~350 | three-column live layout, isoquant-style, no dashes |
| Arena nav link + OG tags | `website` layout/Nav patch | ~20 | |

**Verdict:** under 800 lines, 80% of it glue and layout. No research code.

## 3. Gates (in order — nothing proceeds past a failed gate)

### G0 · Credential gate — *owner: you*
- Action: create fireworks.ai account, set `FIREWORKS_API_KEY` env var
- Check: `firectl whoami` (or model list) returns the account
- Fail → stop; nothing else runs

### G1 · Dataset gate
- Action: `convert_finqa_fw.py` → upload via `firectl dataset create`
- Check: dataset shows `exampleCount: 5851`; spot-check 3 rendered rows (no truncation, question intact)
- Fail → fix converter, re-upload (cheap)

### G2 · Training gate
- Action: `firectl sftj create` — model choice at launch:
  - **Muse Glimmer 30B** (FREE until Nov 30) — default
  - Qwen3.8 27B (~$19) / GLM 5.3 Flash (~$40) — alternates
- Check: job status RUNNING; built-in eval loss trending down at first checkpoint
- Fail (OOM/format errors) → drop to 27B model or shorten contexts; budget untouched if free tier

### G3 · Training complete gate
- Check: job COMPLETED; carved-out eval loss ≤ ~0.15; output model listed
- Fail (loss plateau high) → 1 retry with +1 epoch before reconsidering recipe

### G4 · Serving gate
- Action: `firectl deployment create <model> --deployment-shape default`
- Check: single `POST /v1/chat/completions` returns a correct-format answer; measure P50 TTFT + tok/s over 10 calls
- Fail → alternate deployment shape; else fall back to Fino1-14B (Apache) as the served specialist

### G5 · Arena gate
- Action: run all columns on the 200-question eval
- Check: `reports/arena.json` has accuracy + hallucination + P50 TTFT + cost/1k for **every** column; per-case CSVs written
- Pass bar (reporting, not vanity): specialist ≥ base by a clear margin; every number traceable to a CSV
- Frontier column: only if `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` present (~$5); otherwise marked "pending"

### G6 · Publication gate
- Action: `build_scoreboard.py` → `/arena` page → deploy website
- Check: page live on sova-native.vercel.app, all columns render, footnote states measured date + dataset license; no dashes anywhere
- Fail → static JSON fallback renders a "results in progress" state

## 4. Budget checkpoints

| Gate | Spend so far |
| --- | --- |
| G0–G1 | $0 |
| G2 (training) | $0 (free tier) or $19–40 |
| G3–G4 (deploy + smoke) | +$1–3 |
| G5 (arena inference) | +$1–3 |
| G6 (page) | $0 |
| **Ceiling before any retry** | **≤ $45** (vs $100–200 approved) |

## 5. Timeline (from key handoff)

- T+0:20 — G1 dataset uploaded
- T+0:30 — G2 training launched
- T+1:30–3:30 — training (long pole; /arena page built in parallel here)
- T+3:45 — G4 endpoint live
- T+4:15 — G5 arena scored
- T+5:15 — G6 page live on the website

## 6. Honesty rules (unchanged)

- Eval = test split only; training never touches it.
- Every published number links to a per-case CSV.
- Fino1-8B is credited as the prior art it is (TheFinAI, arXiv 2502.08127).
- Anything unmeasured is labeled illustrative — or it doesn't go on the page.

## 7. Compute policy (binding, enforced by the `ask-before-compute` skill)

- **Cloud-first:** all training, fine-tuning, and long evals run on Fireworks/AWS.
  The user's laptop never runs compute-heavy jobs.
- **Laptop = conductor only:** scripts that fire HTTP calls to cloud endpoints and
  write CSVs are fine; anything touching the local GPU needs explicit per-run OK.
- **Per-run approval:** a prior "go" approves the plan, not the machine. Every run
  shows command + machine + duration + cost, and waits for a fresh "go".
- **Teardown:** dedicated deployments/instances bill hourly when idle — torn down
  after each run, spun up on demand. Estimated cost before, actual cost after.
- **Docs:** every future plan doc carries this section.

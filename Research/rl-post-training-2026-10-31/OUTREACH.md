# Sova: target accounts and video outreach

Working recommendation · 31 October 2026. Priorities, durations and outreach counts are hypotheses to test. No messages have been sent. No model benchmark has been run for this outreach.

## Sova context

Sova builds workflow-specific models and the infrastructure to evaluate, route and serve them. The intended offer combines customer-owned weights, deployment within the customer’s chosen infrastructure, and measured quality, latency and cost. The technical loop is data → post-training → evaluation → iteration → performance engineering → serving. SFT and RL are methods selected for the task, not the customer-facing product.

Existing project evidence includes the Banking77 triage report. Rig is written but unexecuted; do not present its planned capabilities as measured production results. A prospect-specific benchmark remains to be run.

## Start with one task and one buyer

Prioritize AI software vendors with a repeated production workflow, a reachable technical owner, usable examples and a measurable reason to improve. Public product features establish relevance, not buying intent or a performance problem.

| Priority | Segment | Contact | Opening experiment | First qualification question |
|---|---|---|---|---|
| 1 | Support-agent SaaS | Founder/CTO or head of AI | Ticket intent, routing and escalation | Which recurring cases consume the most review or model spend? |
| 2 | Document/accounting workflow SaaS | CTO or ML lead with product owner | Extract and validate one document family | Which fields or exceptions still need human correction? |
| Partner route | AI implementation firms | Founder or delivery lead | One repeated customer workflow | Is there a live project where evaluation or model adaptation blocks delivery? |

Start with ten researched accounts in the first segment. Record three genuinely personalized videos, learn from replies, then refine the remaining seven. These are activity targets, not promised conversions. Find accounts through YC’s directory, helpdesk integration ecosystems, product changelogs and engineering posts. Prefer a warm introduction when available.

## Concrete research examples

- **eesel AI:** its public site describes helpdesk agents, ticket categorization, replies and escalation. Contact role: founder/CTO or AI engineering lead. Video angle: a narrow intent-and-escalation evaluation. Ask whether that component is even a bottleneck. Source: https://www.eesel.ai/
- **Kapa:** its public site describes knowledge agents, retrieval and support integrations. Contact role: ML/retrieval engineering owner. Video angle: separately measure retrieval failures, answer grounding and appropriate abstention before proposing adaptation. It already has substantial technical capabilities; fit is unproven. Source: https://www.kapa.ai/
- **Nanonets:** its public site describes document/business-process agents including accounts payable and order management. Contact role: ML lead or product owner for one workflow. Video angle: invoice-field extraction, validation and exception routing. An established model vendor is a demanding prospect; pursue only with a specific gap or introduction. Source: https://nanonets.com/

Use these as research examples, not a claim that they lack engineers, have high costs, want outsourcing, or will buy. Look for similar teams with a reachable owner and less internal capacity; validate capacity directly.

## The 60–90 second video

| Time | Show | Say |
|---|---|---|
| 0–15s | Their public product page, one specific feature | “I saw you handle [workflow]. I have one experiment in mind for that component.” |
| 15–35s | Three labeled illustrative cases on paper or a simple board | “Routine, ambiguous, must escalate. Here is what a correct outcome would mean.” |
| 35–65s | Current baseline → candidate → same held-out evaluation | “We would compare accepted quality, latency and total cost. These are proposed tests, not measured results.” |
| 65–90s | One sentence: owner + next conversation | “Is this a priority? Could we spend 15 minutes checking fit with the workflow owner?” |

Record the relevant browser tab plus your face, or point the camera at a legible paper board. Keep the company-specific observation in the opening. Use one workflow, three cases and one ask. No general AI lecture or TAM slide. Put “Illustrative examples · benchmark not run” on the board.

## Read-aloud script

Hey [Name], I’m Ani, building Sova. We’re building specialist models for recurring business workflows, with customer-owned weights and deployment on infrastructure you control. I saw that [Company] handles [specific workflow], and I put together one experiment for that part of the product.

On this board are three illustrative cases: a routine request, an ambiguous one, and one that should go to a human. These are examples I made—not results from your system.

The question I’d test is whether a smaller specialist model can handle the routine cases while preserving quality and escalating the rest. I’d compare it with your existing setup and a simpler prompt or routing change, measuring accepted outcomes, latency and total cost including review.

If you have corrected examples, fine-tuning could be worth testing. For a multi-step task with a reliable success check, we could assess RL. We’d choose after establishing the baseline.

Is this workflow painful enough to explore? If so, would you be open to a 15-minute call with whoever owns it?

## Swap the middle for the buyer

**Support SaaS:** “I would isolate intent and escalation from the entire assistant. We would label when to route, answer or hand off, then measure misroutes and unnecessary escalations alongside cost. Is routing actually expensive or unreliable for you?”

**Document software:** “I would start with one document family and show the expected structured output, validation checks and exceptions. We would measure field correctness and human review time. Are corrected documents available for an agreed evaluation?”

**Implementation partner:** “You keep the customer relationship. We could scope the evaluation and adaptation for one existing workflow, with clear ownership and delivery terms. Do you have a current project where this is the blocker?”

## A paper board you can draw

PUBLIC WORKFLOW → THREE ILLUSTRATIVE CASES → PROPOSED TEST → DECISION

Cases: routine / ambiguous / must escalate.

Compare: current system / prompt or routing baseline / specialist candidate.

Score: accepted quality / p95 latency / cost per accepted outcome including review.

Decision: proceed only if the buyer’s agreed quality and economic thresholds are met.

Do not turn synthetic cases into a claimed customer benchmark. Keep a representative held-out set separate from training. Corrections and demonstrations may support SFT; RL needs an assessable outcome/reward and a suitable environment. Do not promise a method before diagnosing the task. Technical reference: https://arxiv.org/html/2501.12948v1

## The message around the video

Subject: One experiment for [Company]’s [workflow]

“Hey [Name] — I saw [specific public feature] and recorded a 75-second walkthrough of one evaluation I’d try: [link]. It covers [task] and what we’d measure before deciding whether a specialist model is worthwhile. Is this on your roadmap, or does someone else own it?”

Send through an appropriate published business channel or a warm introduction. The video should explain the relevant idea without requiring a meeting to understand it.

## After sending

- **Interested:** “Which part hurts most today: wrong outputs, latency or cost? Who owns that metric?” Offer a 15-minute fit call; ask for rough volumes and baseline economics before requesting data.
- **Already have an ML team:** “Makes sense. Is there a bounded evaluation or adaptation task that your team wants done but has not prioritized?” If there is no gap, stop.
- **No reply:** Follow up once after roughly 4–5 business days with a useful artifact: “I also sketched the three-case rubric for [workflow]. Happy to send it if relevant.” Send only an artifact that actually exists. Then stop unless invited to continue.
- **Good fit:** Agree one task, an authorized data path, representative evaluation, named owner, fixed scope and fee. Sell a paid diagnostic or scoped pilot; promise the deliverables and decision process, not an unmeasured percentage improvement.

Track accounts researched, videos sent, substantive replies, fit calls, usable-data access and paid pilots. Record objections. Small early samples guide learning; they do not establish a reliable conversion rate.

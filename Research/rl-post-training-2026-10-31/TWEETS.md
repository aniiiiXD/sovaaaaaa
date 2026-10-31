# Tweet drafts

Research cutoff: 31 October 2026. Equal technical/business mix. Fourteen optional posts; publish individually or as a series. None has been posted. Posts 11–14 add Hyde, Dvar and Isoquant.

Each body below is ASCII and under 280 characters, excluding the source notes. Add citations in a separate immediate reply when they do not fit; do not silently strip qualification to fit a link. Numbering and hashtags use extra characters. Post 10 is optional and describes Rig's actual current status.

## 1. 247 characters

> Four recent financings around AI data, RL environments and training infrastructure:
> Snorkel $350M
> Prime Intellect $130M
> Halluminate $30M
> Labelbox $100M+
> 
> Over $610M, Jul-Oct 2026. Selected deals, not total market funding. Labelbox includes credit.

Sources: [Snorkel](https://snorkel.ai/blog/data-2-0-and-the-research-era-of-ai-data/), [Prime Intellect](https://primeintellect.one/blog/series-a), [Halluminate](https://www.halluminate.ai/blog/series-a), [Labelbox](https://www.prnewswire.com/news-releases/labelbox-raises-100-million-in-series-e-funding-to-advance-reinforcement-learning-and-enterprise-ai-agents-302909147.html). Pair with Board 1.

## 2. 234 characters

> Post-training is a family of methods.
> 
> SFT: learn from demonstrations.
> DPO: learn which answer is preferred.
> RL: generate attempts, score them, update the policy.
> 
> LoRA changes which weights you train. It doesn't make the training RL.

Sources: [DPO paper](https://arxiv.org/abs/2305.18290), [LoRA guide](https://huggingface.co/docs/peft/main/en/conceptual_guides/lora). This is an explanatory taxonomy, not a claim that all post-training methods are listed. Pair with Board 2.

## 3. 210 characters

> For agentic RL, the training product can be a whole task:
> 
> an environment
> an initial state
> tools the agent can use
> a goal
> a verifier
> 
> A question tests an answer. An environment lets an agent attempt a workflow.

Sources/context: [Halluminate](https://www.halluminate.ai/blog/series-a), [DeepSeek-R1](https://arxiv.org/html/2501.12948v1). The environment description is a conceptual schematic, not a benchmark result. Pair with Board 2.

## 4. 237 characters

> One reason I take RL seriously: DeepSeek reported R1-Zero's AIME 2024 pass@1 rising from 15.6% to 71.0% during RL.
> 
> A specific benchmark result, not proof of universal reasoning. The experiment still started with a pretrained base model.

Source: [DeepSeek-R1 original report, section 2.2.4](https://arxiv.org/html/2501.12948v1). Pair with Board 3.

## 5. 250 characters

> RL didn't make curated data disappear.
> 
> DeepSeek-R1's pipeline included about 800k curated SFT samples alongside RL stages.
> 
> The business question is which inputs still improve the model: demonstrations, preferences, tasks, verifiers or environments?

Source: [DeepSeek-R1 original report, section 2.3.3](https://arxiv.org/html/2501.12948v1). This describes R1, not the separate R1-Zero experiment in tweet 4.

## 6. 260 characters

> A reward is the thing you optimize.
> An eval is how you check whether the improvement transfers.
> 
> If both reward the same loophole, your training curve can rise while the actual product gets worse.
> 
> My bet: reliable task verification is valuable infrastructure.

Source: [Defining and Characterizing Reward Hacking](https://arxiv.org/abs/2209.13085). The last sentence is an investment/business thesis, not a measured fact. Pair with Board 2.

## 7. 248 characters

> What's the TAM?
> 
> Two publishers estimate the broad AI training-dataset market at $3.9B and $4.44B in 2026.
> 
> Neither number is an RL-only TAM. Datasets, environment software, compute and expert services have different buyers and overlapping budgets.

Sources: [Grand View Research](https://www.grandviewresearch.com/industry-analysis/ai-training-dataset-market), [Fortune Business Insights](https://www.fortunebusinessinsights.com/ai-training-dataset-market-109241). Pair with Board 4. These are two publisher estimates, not a confidence interval.

## 8. 248 characters

> The money numbers need different labels:
> 
> Funding = capital raised.
> Valuation = price implied for ownership.
> Revenue = sales over a period.
> Run rate = a recent pace annualized.
> TAM = potential annual demand.
> 
> Adding them together tells you nothing.

Definitions/editorial explanation; no company-specific claim. Pair with Board 4.

## 9. 278 characters

> My startup thesis: own a narrow workflow where you can measure success.
> 
> Capture failures -> build better tasks -> post-train -> test on held-out work -> deploy.
> 
> The business needs repeatable quality improvements AND delivery margins. A big expert network alone proves neither.

Personal thesis. It makes no claim that a particular vendor has poor margins or that success is guaranteed.

## 10. 263 characters

> I'm building Rig around data -> post-training -> eval -> iteration -> optimization -> serving.
> 
> The current code implements LoRA SFT, not RL training. It hasn't been run yet.
> 
> The next research question: which tasks can we score well enough to support an RL loop?

First-person draft for your own account. Grounded in the current local Rig source and its unexecuted status. It should be updated if implementation or validation changes before publication.

## 11. 263 characters

> Hyde, Dvar and Isoquant belong on the post-training map too.
> 
> Hyde: enterprise-owned specialist models.
> Dvar: task adaptation + India-hosted inference.
> Isoquant: model optimization + serving.
> 
> Data is one business. Delivering a better cost per outcome is another.

Sources: [Hyde](https://hyde.ai/), [Dvar](https://www.dvarlabs.ai/), [Isoquant](https://isoquant.ai/). Placement is an interpretation of their public positioning; see Board 5.

## 12. 252 characters

> Dvar's banking case study reports a 0.5B model improving from 59.7% to 88.1% on Hinglish intent classification after supervised training.
> 
> Useful post-training evidence. Not an RL result, and not a universal claim that tiny models beat frontier models.

Source: [Dvar case study](https://www.dvarlabs.ai/banking77). Keep the company-reported qualifier in the source reply. This within-model comparison avoids implying identical Sonnet denominators.

## 13. 226 characters

> Isoquant reports 91.8% vs 74.7% accuracy and 91.7% lower estimated inference cost on a 3,079-request banking-intent comparison.
> 
> Company-reported, task-specific. The interesting chart has three axes: quality, latency and cost.

Source: [Isoquant case study](https://isoquant.ai/case-studies/banking-intent-classification). This is vendor evidence, not independent replication. For paper, use three separate panels rather than a 3D graph.

## 14. 256 characters

> Hyde's stock-exchange case study describes 75,000+ model runs, expert-defined correctness and an ongoing RL loop.
> 
> The business question: can proprietary workflows become repeatable training infrastructure?
> 
> A vendor case study, not independent validation.

Source: [Hyde case study](https://hyde.ai/blog/us-stock-exchange). Do not label its potential customer revenue opportunity as Hyde revenue.

## Further research: optional drafts 15–22

Choose a coherent subset; these are alternatives, not an instruction to publish a 22-post thread. Sources belong in the attached source reply. Character counts exclude Markdown blockquote markers and source notes.

## 15. 225 characters

> Three more 2026 funding announcements in the post-training stack: Applied Compute $80M, AfterQuery $30M, Plato $16M. That's $126M across three different businesses: enterprise adaptation, expert data and simulated workplaces.

Sources: [Applied Compute](https://www.appliedcompute.com/company/fundraise), [AfterQuery](https://www.businesswire.com/news/home/20260409469482/en/), [Plato](https://www.prnewswire.com/news-releases/plato-raises-16-million-to-build-the-training-grounds-for-ais-next-leap-into-real-work-302921832.html). Dates: 8 April, 9 April and 28 October 2026. Selected announcements, not an industry total.

## 16. 209 characters

> Bespoke announced $40M across seed and Series A rounds. Plato announced a $16M Series A, taking its total to $19M.
> 
> Round size, total funding and valuation tell different stories. Your chart has to choose one.

Sources: [Bespoke](https://bespokelabs.ai/blog/bespoke-labs-raises-40m-to-build-environments-that-enable-reliable-agents), [Plato](https://www.prnewswire.com/news-releases/plato-raises-16-million-to-build-the-training-grounds-for-ais-next-leap-into-real-work-302921832.html).

## 17. 262 characters

> Glean reports ~50% lower system latency and ~25% fewer tokens with Waldo, a search planner trained with DPO + RL.
> 
> A useful pattern: specialize a repeated step, then hand evidence to a frontier model. Company-reported system results, not an isolated RL ablation.

Source: [Glean](https://www.glean.com/blog/waldo-launch). The article describes customer deployment as forthcoming. The per-call timing comparison is a different metric.

## 18. 254 characters

> More fine-tuning can make errors worse.
> 
> Bespoke + Intuit's SeeWhy report describes skewed training logs causing problems. The final approach combines curated synthetic data, SFT, prompt optimization and deterministic checks.
> 
> Data design is engineering.

Source: [Joint technical report](https://files.bespokelabs.ai/ck-bespoke-tr.pdf). Offline experiment; this is not an RL result.

## 19. 247 characters

> Read the denominator before tweeting the accuracy.
> 
> AfterQuery + Hebbia report 47% -> 74% perfect solves on a 100-task credit evaluation. But judge failures were excluded: 5 before, 8 after.
> 
> Useful evidence, with different effective denominators.

Source: [Experiment and methods](https://www.afterquery.com/blog/post-training-nemotron-on-credit-workflows-in-partnership-with-hebbia). Company-reported; one run per task.

## 20. 255 characters

> micro1 reported >$1B annual run rate in October 2026. That's a demand signal, not a profit figure.
> 
> Its ~180-person core team sits alongside tens of thousands of experts. Treating that as pure software revenue per employee misses the production workforce.

Source: [micro1's 12 October update](https://www.micro1.ai/blog/q3). Company claim, not audited annual sales or subscription ARR.

## 21. 265 characters

> The economics of a custom model need a break-even calculation.
> 
> If adaptation costs $50k and saves $0.02 per task, you need 2.5M tasks to recover setup.
> 
> Hypothetical, at comparable quality. Include retries, fallback, review and maintenance in the real calculation.

Illustrative arithmetic, not observed vendor economics. See DEEP_DIVE.md for the cost definitions.

## 22. 267 characters

> An RL environment is more than a pile of prompts:
> 
> state + tools + task + constraints + reset + scoring.
> 
> The business question is whether better practice transfers to real work, and whether the environment can be reused across enough training runs to pay for itself.

Primary example: [Plato's environment description](https://www.prnewswire.com/news-releases/plato-raises-16-million-to-build-the-training-grounds-for-ais-next-leap-into-real-work-302921832.html). The economics question is our interpretation.





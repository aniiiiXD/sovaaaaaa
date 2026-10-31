**Sova: enterprise post-training and inference business assessment**

Research date: 24 October 2026. Working scope: global customers, beginning with finance-related enterprise workflows. Dollar figures are USD. Published estimates, vendor-reported results, and Sova planning assumptions are distinguished below. This research did not launch training, paid inference evaluations, or outreach.

**Recommendation**

Build a managed service that adapts models to one repeatable customer workflow, proves the result against that customer's existing system, and operates the model with ongoing evaluation. Sell a measurable quality threshold, lower end-to-end latency, and lower total cost per completed task. Begin with paid enterprise engagements; turn repeated delivery steps into a post-training platform after several customers expose the common requirements.

The proposed positioning is: “Sova turns your production examples and expert feedback into specialized models that meet your quality requirements at lower latency and cost.” This is a proposed promise to validate, not an achieved result.

Fin-o1 is one starting checkpoint. The business should remain free to select another model when it achieves the customer's requirements more economically. Our existing endpoint is a working demonstration of serving, not evidence that we already have a scalable enterprise training business.

**1. The market: use three distinct measurements**

| Market definition | Published estimate | Relevance to Sova |
| --- | --- | --- |
| Broad global AI inference | $132.7B in 2026; $421.8B in 2033 | Industry context. Includes hardware and non-generative workloads; too broad for Sova's addressable revenue. |
| Global AI inference software | $21.1B in 2026; $80.9B in 2033 | Closer adjacent market: serving, orchestration, platforms, and managed services. Still includes much more than post-training. |
| Inference within AI-optimized IaaS | $23.3B in 2026 | Infrastructure spending supporting inference. Relevant to customer budgets and underlying costs, not wholly capturable service revenue. |

Sources: Grand View Research's October 2026 [broad inference estimate](https://www.grandviewresearch.com/industry-analysis/artificial-intelligence-ai-inference-market-report), its [inference software estimate](https://www.grandviewresearch.com/industry-analysis/ai-inference-software-market-report), and Gartner's [August 2026 IaaS forecast](https://www.gartner.com/en/newsroom/press-releases/2026-08-10-gartner-forecasts-worldwide-artificial-intelligence-optimized-iaas-spending-to-grow-96-percent-in-2026). These are analyst estimates, not audited market revenues. Public summaries do not expose enough underlying methodology to reconcile them. Do not add these figures: their definitions differ and can overlap. Gartner's August forecast supersedes its older October 2025 forecast of $20.6B for 2026 inference IaaS.

Menlo estimates $37B of enterprise generative-AI spending in 2025 and says 76% of solutions were bought rather than built. Its methodology explicitly excludes chips and inference/model-serving providers. This is buying-behavior context, not another inference TAM to add. The survey covered 495 US enterprise decision-makers, so it is not a census of global buyers. [Menlo methodology and findings](https://menlovc.com/perspective/2025-the-state-of-generative-ai-in-the-enterprise/)

There is no defensible, separately verified enterprise post-training-as-a-service TAM in the sources reviewed. The honest pitch is a large adjacent market and a customer-level revenue model. A numeric serviceable market requires a list of qualified accounts, evidence of spend, deployment constraints, and willingness to pay.

**2. Evidence that the proposed outcome is possible**

Bridgewater AIA Labs and Thinking Machines report training Qwen3-235B for six financial information-filtering tasks. Their held-out evaluation averaged 84.66% accuracy, versus 78.2% for GPT-5.5, with a reported 13.8-fold reduction in inference cost per task. Expert label quality was a major part of the work. This is a particularly relevant example of enterprise-specific judgment learned from proprietary data. It uses a different, much larger model than Fin-o1-14B and is not evidence of Fin-o1 performance, universal superiority, or fully amortized training economics. [Primary research write-up, June 2026](https://thinkingmachines.ai/news/learning-to-replicate-expert-judgment-in-financial-tasks/)

Glean reports roughly 50% lower end-to-end latency and 25% fewer tokens, with no quality regression in its evaluation, by using its specialized Waldo model for search planning before a frontier model handles the answer. This supports optimizing selected stages rather than requiring one small model to handle every task. The figures are vendor-reported and workload-specific. [Glean launch report](https://www.glean.com/blog/waldo-launch)

AWS already markets Bedrock Model Distillation with task-specific speed, cost, and accuracy claims. This validates demand but also means managed distillation is an incumbent feature. Sova needs workflow expertise and verified customer outcomes beyond access to a training job. [AWS product description](https://aws.amazon.com/bedrock/model-distillation/)

**3. Two offers, with different buyers**

| Offer | Buyer | Deliverable | Revenue model |
| --- | --- | --- | --- |
| Enterprise-specific model service | CTO, head of AI, product owner; operations expert owns acceptance | Dataset preparation, private evaluation, model selection and adaptation, deployed endpoint, monitoring and scheduled updates | Paid pilot, implementation fee, recurring managed service and inference |
| Post-training as a service | Applied-ML teams and AI product companies with existing data and engineers | Versioned datasets, SFT/preference/RL workflows, reward environments, evaluation, checkpoint export and deployment integration | Platform commitment plus usage; specialist projects priced separately |

Launch the first offer now as a narrowly scoped service. Develop the second from repeated customer work. Starting with a general-purpose self-service platform would put Sova directly against established infrastructure providers before it has differentiated data, evaluations, or distribution.

Do not promise RL for every customer. First compare prompting, retrieval, tools, and an untuned small model. Train only when evidence indicates it improves the customer's objective. Adaptation can teach formats, decisions, and tool use; current private facts should remain available through permission-aware retrieval or tools. Training and serving are separate optimization problems: tuning the same architecture does not automatically increase decoding speed, and longer reasoning can increase latency and cost.

**4. Initial customer and workflow**

Proposed initial customer: a financial-software vendor or fintech with an existing production AI workload, accessible examples and expert reviewers, repeatable tasks, and meaningful inference or review costs. An initial qualification hypothesis is $20K–$100K monthly AI spend, or an equivalent measurable operational bottleneck. This is a prospecting filter to test, not observed demand.

Start with one of these measurable workflows:

- Financial document extraction into a fixed schema, with field-level correctness and source references.
- Financial research relevance classification, with expert labels and an agreed false-negative limit.
- Retrieval/tool routing for a finance assistant, measured on evidence recall, tool-call validity, and total answer latency.

Choose the first workflow based on a paying customer's data and pain. Retain human review for consequential actions. Avoid presenting “general finance intelligence” as a first deliverable: its success criteria are too broad for a fast, credible commercial proof.

A customer is a weak fit when traffic is too low to recover setup costs, there are no usable labels or review capacity, task definitions change constantly, or a cheaper prompted general model already meets all requirements.

**5. Competition and differentiation**

| Provider | Existing capability | Implication |
| --- | --- | --- |
| Fireworks | Managed SFT/DPO, training APIs and inference | Commodity training access is inexpensive. Its published LoRA SFT rate for models up to 16B is $0.50/M training tokens. |
| Together | Fine-tuning and dedicated model serving | Customers can acquire training and hosting directly. |
| Thinking Machines / Tinker | Programmable training infrastructure and enterprise case studies | A strong supplier or competitor for ML-heavy customers. |
| Baseten | Training, inference, applied research, custom RL environments | Competes directly with managed post-training and can also supply a partner channel. |
| AWS / Databricks | Integrated customization, model governance and deployment | Enterprise procurement and existing data access favor incumbents. |

Sources: [Fireworks pricing](https://fireworks.ai/pricing), [Together dedicated inference](https://www.together.ai/dedicated-model-inference), [Tinker](https://thinkingmachines.ai/tinker/), [Baseten training](https://www.baseten.co/products/training/), [Databricks model training](https://www.databricks.com/blog/introducing-mosaic-ai-model-training-fine-tuning-genai-models), and the AWS distillation source above. Training-token prices exclude data preparation, expert annotation, experiments, rollout generation, evaluation, and serving; cheap training does not mean a cheap end-to-end project.

Sova's defensible work would be reusable workflow integrations, expert-reviewed evaluation methods, strong reward/verifier design, efficient delivery, and a production feedback loop. Customer data and weights need explicit ownership and isolation; reuse of customer data cannot be assumed. Portable artifacts and deployment in a customer's preferred infrastructure can make buying easier.

A timely channel opportunity: on 23 October 2026, Baseten announced its Environment Network. Partners create customer-specific environments, tasks, rubrics, and data; Baseten handles training and inference. This suggests a route to revenue through domain evaluation and environment services while using another provider's infrastructure. Participation is not guaranteed, and no application or outreach has been made. [Baseten announcement](https://www.baseten.co/blog/introducing-the-baseten-environment-network/)

**6. Pricing and revenue scenarios — assumptions to validate**

Suggested initial offers: a $10K–$25K paid, four-to-six-week pilot for one workflow; a $25K–$100K production implementation where integration warrants it; and $3K–$15K/month for managed evaluation, updates, and operations, with compute separately metered. These are proposed testing ranges, not competitor quotes or established customer willingness to pay. Include expert-data work and experiment limits explicitly so a pilot cannot become unlimited research.

| Recurring customer scenario | Average annual service/platform revenue per customer | Recurring annual revenue |
| --- | --- | --- |
| 20 customers | $90K | $1.8M |
| 50 customers | $150K | $7.5M |
| 200 customers | $200K | $40M |

These are arithmetic planning scenarios, not SAM estimates, sales forecasts, or proven capacity. They exclude one-off implementation and pass-through compute; the $200K expansion case assumes broader account scope. A services-heavy delivery model may not support the largest case without substantial staffing or automation.

For an initial addressable-market model, build a named account list and classify each by workload volume, annual spend that can be displaced, data access, budget owner, and deployment feasibility. Annual qualified-account count multiplied by realistic recurring contract value provides an auditable SAM. Reachable accounts multiplied by realistic conversion and retention assumptions then informs SOM.

Illustrative all-in monthly economics for a large account:

| Item | Assumed amount |
| --- | --- |
| Existing equivalent workflow cost | $100K |
| Customer's all-in Sova bill | $60K |
| Sova serving and fallback compute | $15K |
| Sova direct support, data work and amortized retraining | $5K |
| Customer recurring saving before onboarding | $40K / 40% |
| Sova gross profit before sales, R&D and overhead | $40K / 66.7% |

This demonstrates a viable shape, not current Sova economics. Include cold/idle capacity, retries, frontier fallbacks, expert review, data work, and failed experiments when validating it. A $40K onboarding charge would add one month to customer payback in this simplified case. If actual compute doubles, gross margin falls to 41.7%; utilization and serving design matter.

Use total cost per accepted task as the commercial metric. Compare the same task mix and quality requirements, with training and onboarding amortized across realistic volume. Recalculate against the cheapest suitable baseline, including existing caching and batch discounts; comparing only with an expensive frontier configuration can manufacture a misleading win.

**7. A pilot acceptance contract**

Proposed target, subject to baseline measurement: at least 2x faster p95 end-to-end completion and 50% lower all-in cost per accepted task, while meeting the customer's minimum quality threshold. These are targets to test, not published Sova capabilities. Define quality separately for critical fields, citations, formats, and ordinary prose; a single averaged accuracy number can conceal expensive errors.

Use 100–200 representative examples for discovery, then expand the untouched test set according to error rates and the confidence needed for deployment. Split by customer/document/time where appropriate, rather than scattering near-duplicate excerpts across training and test sets. Have experts adjudicate ambiguous outputs. Fix the task context, tool access, output requirements, and concurrency; disclose model settings and reasoning budgets. Measure first-token latency, final-answer p50/p95, tokens per accepted task, error rates, fallback frequency and full cost.

Report warm results separately, as requested, but include warm-capacity cost in economics. A “warm-only” latency claim cannot exclude the cost of keeping the model warm. Re-test on a fresh task sample after optimization to reduce overfitting to the evaluation.

**8. What we have and what remains**

The existing Fin-o1 endpoint and short tests support a serving demonstration. They do not establish enterprise quality, concurrency capacity, tenant isolation, training automation, or a profitable service. Our recorded warm tests were about 40–60 output tokens/sec end-to-end on elementary arithmetic. [Local validation](../serving/bedrock/validation.json)

One imported model copy currently uses two CMUs. At published Virginia rates, continuous active capacity is about $6.86/hour, approximately $5,009 over a 730-hour month, plus storage and other charges. Bursty use bills in five-minute windows. This is a capacity cost, not evidence of savings relative to a token-priced API. [AWS pricing](https://aws.amazon.com/bedrock/pricing/)

Fin-o1's model page labels the model Apache-2.0 but also includes research-purpose wording in the access conditions. Resolve the exact checkpoint and accepted access terms before basing a commercial offering on it; do not infer commercial clearance from the badge alone. This is a checkpoint-selection question, not a reason the business must depend on Fin-o1. [Model page and access conditions](https://huggingface.co/TheFinAI/Fin-o1-14B)

**9. Suggested first 90 days**

| Period | Work | Commercial evidence required |
| --- | --- | --- |
| Days 1–14 | Interview 15–20 qualified buyers; inspect representative traces and current bills; choose one workflow; compare current system and smaller-model baselines | Named budget owners, an agreed evaluation rubric, and at least one paid pilot commitment |
| Days 15–45 | Run two or three tightly scoped pilots; improve data, train only where justified, optimize deployment, and measure full economics | At least one repeatable improvement in quality-constrained latency/cost and customer willingness to deploy |
| Days 46–90 | Convert successful pilots, package evaluation/data/deployment steps, establish update and support terms, pursue relevant infrastructure partnerships | Recurring contracts and a measured delivery margin; evidence that the same core process works across customers |

Minimum capabilities are applied model/evaluation engineering, production serving engineering, domain review, and founder-led enterprise sales. These can initially be shared roles rather than four new hires. Do not invest in a broad training dashboard or owned GPU fleet before repeated demand justifies it.

Proceed if customers supply real workloads and pay for demonstrated gains. Change the offer if most value comes from workflow integration or retrieval rather than training. Reject or narrow projects where model-quality regression, low traffic, data access, or delivery labor eliminates the economic advantage.

The near-term business test is whether three customers will pay Sova to improve one specific workflow and keep paying for its operation and improvement. The large inference market makes that opportunity plausible; it does not answer that test.

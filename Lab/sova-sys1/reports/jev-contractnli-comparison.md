# Jev and SOVA on the same ContractNLI development examples

The [published Jev evaluation](https://arxiv.org/html/2609.27678) reports
Jev-1.13.0 on 510 contract–hypothesis decisions from 30 development contracts.
In its one-question-per-request setting (K=1, Table 22), Jev scored **76.47%**.

The saved predictions from our completed run score **376/510 = 73.73%** for
the distilled SOVA student and **377/510 = 73.92%** for the labels-only
student on that same panel. Jev's reported score is therefore approximately
2.7 percentage points higher than the distilled student's score on this panel.

The 30-contract panel was reconstructed using the study's published
[selection code](https://raw.githubusercontent.com/ZF-Utokyo/Jev-Benchmark/main/benchmark/data.py):
sort the 61 development documents by numeric ID, then use
`random.Random(20260920).sample(rows, 30)`. Our original archive, development
member and reconstructed panel match the study's published SHA-256 hashes;
all 510 gold labels also match the saved SOVA predictions. SOVA's scores were
calculated from already collected predictions; no additional inference ran.

These are the same examples but separate runs with different model interfaces
and prompts. The comparison is descriptive, not an identical-prompt experiment.
The paper's public release does not include its per-example development
predictions, so this comparison cannot establish paired error overlap or
statistical significance. It concerns Jev 1.13.0, not 1.14, and the subset's
73.73% differs from SOVA's 71.26% across all 1,037 development decisions.

## Grouped-contract comparison and serving cost

The same study's joint baseline requests all 17 decisions about a contract in
one call. It reports the following accuracy and average inference costs for the
same 30 contracts. The per-1,000-contract figures below multiply its historical
per-contract values by 1,000; they are not new provider charges or quotes.

| Model | Accuracy on 510 decisions | USD per 1,000 contracts, 17 decisions each |
| --- | ---: | ---: |
| SOVA distilled, 17 individual decisions | 73.73% | ~$0.60, idealized GPU compute |
| Jev 1.13, grouped | 77.06% | $0.25, published API cost |
| GPT-6 Astra, grouped | 81.76% | $89.90, published API cost |
| Claude Sonnet 5, grouped | 81.37% | $12.87, published API cost |
| GPT-6.1 Sol | Not measured on this panel | Unknown |
| Claude Fable 5.1 | Not measured on this panel | Unknown |

SOVA's figure uses its actual 510-decision mean warm in-process time of
83.2297 ms, multiplied by 17, and the ~$1.52/hour A10G instance example on
[AWS's pricing page](https://aws.amazon.com/sagemaker/ai/pricing/). It assumes
continuous, serial work at that measured speed with no idle time, service
overhead, storage, networking or other charges. It is a hypothetical hosting
estimate, not a measured endpoint bill or throughput benchmark. A GPU left on
24/7 at $1.52/hour costs about $1,094 for 30 days even when idle. On-prem
economics differ. The academic models answer all 17 questions in one request;
SOVA's measured workload uses one request per decision, and the runs use
different prompts and systems. SOVA is trained on ContractNLI's training split.

For single-question requests, if Jev were billed for an assumed 3,000 input
tokens per request, [TypeSafe's published rate](https://help.typesafe.ai/articles/5187202169-how-much-does-jev-cost)
would yield $0.126 per 1,000 decisions; the SOVA saturated compute calculation
above yields roughly $0.035. The Jev token count here is an illustration, not
a measured token count for these inputs; Jev and SOVA use different tokenizers.

Current direct-API input/output list prices per million tokens include
[OpenAI GPT-6 Astra $10/$50 and GPT-6.1 Sol $2/$10](https://developers.openai.com/api/docs/models),
[Anthropic Claude Fable 5.1 $10/$50 and Sonnet 5 $2/$10](https://platform.claude.com/docs/en/about-claude/pricing),
and Jev $0.042/$0. Usage, reasoning tokens, caching and hosting provider change
actual charges. The academic model cost figures are historic and can vary.

No Jev API or Amazon Bedrock call was used to obtain the Jev result; it comes
from the cited paper. Our model was trained and benchmarked on SageMaker. The
user's Bedrock catalog lists Sol and Fable, but a catalog listing does not
establish inference access, and neither model has been run on this panel here.

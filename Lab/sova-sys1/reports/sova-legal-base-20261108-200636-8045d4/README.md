# Qwen3-4B legal baseline

The pretrained, unquantized FP16 Qwen3-4B was scored on ContractNLI's official
development split on 2026-11-09. No model training was performed.

| Measure | Result |
| --- | ---: |
| Correct among examples that fit | 543 / 901 = **60.3%** |
| Correct across all examples, counting unscored as wrong | 543 / 1,037 = **52.4%** |
| Context coverage | 901 / 1,037 = **86.9%** |
| Always predict the most frequent training label, on the same 901 examples | 427 / 901 = **47.4%** |
| Macro-F1 across all examples, with unscored counted as false negatives | **47.6%** |
| Contradictions identified, across all examples | 24 / 95 = **25.3%** |

The 136 unscored examples belong to eight contracts that exceeded the
4,096-token input limit. The development set contains 61 contracts with 17
repeated statements, so the examples are not 1,037 independent documents.
The official test decisions and their labels were not loaded or scored. Train
and test document texts were loaded only to verify split isolation.

This is an untuned baseline with uncalibrated scores. It is not an estimate of
customer production accuracy. The prompt describes `NotMentioned` as a case the
contract does not establish; that wording can overlap with contradiction, so a
future prompt revision should be evaluated as a separate, explicitly labeled
experiment. Near duplicates and model pretraining exposure remain unresolved.
The earlier local connection smoke test used 4-bit MLX weights, so these FP16
numbers do not directly measure that specific quantized runtime.

The independent collection check recomputed the counts, scores and per-class
metrics from `baseline-predictions.jsonl`. The SageMaker worker completed and
terminated. Instance compute was approximately **$0.37** using the previously
observed $1.515/hour rate for 881 billable seconds; storage, network, taxes and
actual billing may differ.

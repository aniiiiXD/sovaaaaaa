# Legal baseline evaluation

This evaluates the pretrained **unquantized FP16 Qwen3-4B** connector on the
official ContractNLI development decisions. It does not train the model or
score the official test decisions. It is a different numerical precision from
the earlier 4-bit Apple connection smoke test.

The report includes accuracy, macro-F1, class-level precision and recall,
confusion counts, Brier score and context coverage. The full contract must fit
the configured 4,096-token input limit. Examples that do not fit are reported
as unscored and count as wrong in `accuracy_all_examples`; the separately
reported `accuracy_scored_examples` excludes them.

The dev split has 1,037 decisions across 61 contracts, using the same 17
statements for each contract. The decisions are therefore correlated and do
not represent 1,037 independent documents. Near duplicates and potential
pretraining exposure remain unverified. Scores are not calibrated.

The SageMaker worker uses the existing S3 bucket and execution role, pinned
public model revision, one `ml.g5.2xlarge` instance and a one-hour runtime
cap. The package contains only dev decision labels; train and test document
texts are included solely for the loader's exact split-overlap check. The
worker uploads its result to S3 and terminates when the job completes or times
out. See the per-job submission receipt in `reports/` for the exact inputs.

Tests use synthetic scorers and do not require GPU or cloud access:

```sh
.venv/bin/python -B -m unittest discover -s tests -v
```

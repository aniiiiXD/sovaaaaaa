# ContractNLI data loader

From the `sova-sys1` folder:

```python
from sova_data import ContractNLILoader

dataset = ContractNLILoader()
example = next(dataset.iter_split("train"))

model_input = example.model_input.as_dict()
gold_label = example.target.label
gold_evidence = example.target.evidence
```

Pass only `model_input` to a model. The gold label and evidence are separate
supervision or evaluation targets. Character offsets in `gold_evidence` refer
to the unmodified full contract string.

Supported splits are `train`, `dev` (or `validation`) and `test`. `train`
always loads the deduplicated `train_clean` files. Initializing the loader
checks document IDs and exact, whitespace-normalized text across all splits.
The original test split includes an internal duplicate, reported in
`dataset.audit`; it is not removed. This does not detect near duplicates.

Invalid records raise `DatasetIntegrityError`. Exhaust an iterator to check all
of its records, including whether each document has exactly one decision for
each published statement. Each statement must match `statements.json`.

Run the tests without training or network access:

```sh
python3 -B -m unittest discover -s tests -v
```

# Local decision-model connector

This connects one `sova_data.ModelInput` to a pretrained Qwen3-4B model. It
uses the model's existing causal language-model head, reads the next-token
logits for the three decision labels in **one forward pass**, and normalizes
only those three logits. It does not generate explanatory text.

The model is a pretrained baseline; it has **not** been trained on our clean
dataset, and the resulting scores are not calibrated probabilities of
real-world correctness. Gold labels and annotated evidence are not passed to
the model. This connector does not retrieve evidence or establish accuracy.

The code loads weights locally only and pins the Qwen revision. It rejects
inputs longer than the configured limit rather than truncating the contract.

```python
from sova_data import ContractNLILoader
from sova_model import QwenDecisionModel

example = next(ContractNLILoader().iter_split("train"))
model = QwenDecisionModel.load_local(device="auto", max_input_tokens=4096)
result = model.score(example.model_input)
print(result.probabilities)
```

On Apple Silicon, install `requirements-mlx.txt` and use the pinned 4-bit MLX
weights for a lower-memory local run. On this laptop, the following command ran
one short training example successfully:

```sh
.venv/bin/python -B -m sova_model --backend mlx --index 3128
```

The CLI's `auto` backend selects MLX on Apple Silicon and PyTorch elsewhere.
Use `--backend torch` with `requirements-model.txt` and the full pinned Qwen
weights for the PyTorch path. Quantized and full-precision scores may differ;
no quality parity claim is made. The full PyTorch weights require substantially
more memory and were not run on the memory-pressured laptop.

Run the fixture tests with:

```sh
.venv/bin/python -B -m unittest discover -s tests -v
```

For the PyTorch backend, `--device auto` selects CUDA, Apple MPS, then CPU;
GPU/MPS weights use float16 and CPU uses float32. Hardware memory, latency and
real accuracy depend on the machine and input length and must be measured.

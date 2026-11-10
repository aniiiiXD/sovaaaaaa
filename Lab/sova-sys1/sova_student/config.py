"""Pinned model inputs and the first controlled student experiment."""

STUDENT_MODEL = "state-spaces/mamba2-370m"
STUDENT_REVISION = "0eb4c69a118dc9b7568ce0b52990dc8f99967983"
TOKENIZER_MODEL = "EleutherAI/gpt-neox-20b"
TOKENIZER_REVISION = "c292233c833e336628618a88a648727eb3dff0a7"
TEACHER_ADAPTER = "reports/sova-legal-lora-20261109-061959-54ad8d/adapter"
TEACHER_REFERENCE = "reports/sova-legal-lora-20261109-061959-54ad8d/tuned-predictions.jsonl"
BENCH_REFERENCE = "reports/sova-legal-bench-20261109-124257-582bda/benchmark-rows.jsonl"

TEACHER_MAX_TOKENS = 4096
STUDENT_MAX_TOKENS = 8192
SEED = 20261109
EPOCHS = 1
GRADIENT_ACCUMULATION = 8
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
TEMPERATURE = 2.0
TEACHER_WEIGHT = 0.5

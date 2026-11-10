#!/usr/bin/env bash
set -euo pipefail
cd /opt/ml/sova-train
python3 -m pip install -q \
  'transformers==4.52.4' \
  'peft==0.15.2' \
  'accelerate==1.15.0' \
  'huggingface-hub[hf_xet]==0.36.2' \
  'safetensors==0.8.0'
exec python3 -m sova_train.cloud_worker

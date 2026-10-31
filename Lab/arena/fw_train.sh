#!/bin/bash
# SOVA Arena — Fireworks managed SFT. Run after G0 (FIREWORKS_API_KEY set).
# Usage: bash fw_train.sh [BASE_MODEL_ID] [DATASET_ID] [EVALSET_ID] [OUTPUT_MODEL_ID]
set -e

BASE=${1:-accounts/fireworks/models/muse-glimmer-30b}   # FREE until Nov 30
DATASET=${2:-sova-finqa-sft-5851}
EVALSET=${3:-sova-finqa-eval-400}
OUTPUT=${4:-sova-finqa-specialist}

echo "== G1: upload datasets =="
firectl dataset create "$DATASET" data/fw_train.jsonl
firectl dataset create "$EVALSET" data/fw_eval.jsonl

echo "== G2: launch SFT job =="
firectl sftj create \
  --base-model "$BASE" \
  --dataset "$DATASET" \
  --evaluation-dataset "$EVALSET" \
  --lora-rank 16 \
  --output-model "$OUTPUT" \
  --job-id sova-finqa-sft

echo "== monitor: firectl sftj get sova-finqa-sft =="

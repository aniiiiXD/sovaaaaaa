#!/bin/bash
# Wrapper around the vLLM OpenAI server with our non-negotiable defaults.
set -euo pipefail

: "${MODEL:?MODEL env var is required}"
: "${SERVED_MODEL_NAME:?SERVED_MODEL_NAME env var is required}"

exec python3 -m vllm.entrypoints.openai.api_server \
  --host 0.0.0.0 --port 8000 \
  --model "$MODEL" \
  ${MODEL_REVISION:+--revision "$MODEL_REVISION"} \
  --served-model-name "$SERVED_MODEL_NAME" \
  --max-model-len "${MAX_MODEL_LEN:-8192}" \
  --gpu-memory-utilization "${GPU_MEM_UTIL:-0.92}" \
  --disable-uvicorn-access-log \
  "$@"

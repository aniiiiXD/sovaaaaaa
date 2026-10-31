#!/bin/bash
# SOVA Arena — deploy the trained specialist (G4). Run after G3 passes.
# Usage: bash fw_deploy.sh [OUTPUT_MODEL_ID] [DEPLOYMENT_ID]
set -e
MODEL=${1:-sova-finqa-specialist}
DEPLOY=${2:-sova-arena-specialist}

firectl deployment create "$MODEL" --deployment-shape default --deployment-id "$DEPLOY" 2>/dev/null \
  || firectl deployment create "$MODEL" --deployment-shape default

echo "== wait for deployment, then smoke test: =="
echo "curl -s https://api.fireworks.ai/inference/v1/chat/completions \\"
echo "  -H \"Authorization: Bearer \$FIREWORKS_API_KEY\" -H \"Content-Type: application/json\" \\"
echo "  -d '{\"model\":\"accounts/fireworks/models/$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Revenue 4000, operating income 620. Operating margin?\"}]}'"

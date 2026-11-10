#!/bin/bash
# Surgical: boot the ephemeral box, run ONLY the test suite, fetch the full
# log, destroy. No training. Purpose: see the 3 unknown test failures.
set -euo pipefail

HEAVY=/Users/anixd/Documents/Sova/HeavyWork
INFRA=$HEAVY/backend/infra-train
WS=$HEAVY/Lab/solva-fin-sys1
KEY=$INFRA/sova_train_key
REMOTE=ubuntu
OUT=$WS/modeling/reports/test-only-$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

cd "$INFRA"
export AWS_PROFILE=passkarwado
cleanup() { terraform destroy -auto-approve >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "── [1/4] box up ──"
terraform apply -auto-approve > /dev/null
IP=$(terraform output -raw public_ip)
echo "box: $IP"

echo "── [2/4] wait for torch + GPU ──"
for i in $(seq 1 60); do
  if ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes \
      "$REMOTE@$IP" 'test -f /opt/venv/bin/activate && /opt/venv/bin/python -c "import torch" && nvidia-smi -L' 2>/dev/null; then
    echo "ready after ~$((i*15))s"; break
  fi
  [ "$i" = 60 ] && { echo "FATAL: bootstrap timeout"; exit 1; }
  sleep 15
done

echo "── [3/4] ship code + run FULL test suite ──"
tar czf /tmp/sova-finance1-code.tgz -C "$WS" modeling finance1
scp -q -i "$KEY" /tmp/sova-finance1-code.tgz "$REMOTE@$IP:/tmp/"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" 'mkdir -p ~/work && tar xzf /tmp/sova-finance1-code.tgz -C ~/work --warning=no-unknown-keyword'

ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'cd ~/work && /opt/venv/bin/python -m unittest discover -s modeling/tests -t . -v > test-results.txt 2>&1; echo "exit=$?"; tail -4 test-results.txt' || true

echo "── [4/4] fetch log + destroy ──"
scp -q -i "$KEY" "$REMOTE@$IP:~/work/test-results.txt" "$OUT/" || true

terraform destroy -auto-approve > /dev/null
trap - EXIT

echo ""
echo "════ TEST LOG AT: $OUT/test-results.txt ════"
grep -E "^(FAIL|ERROR)" "$OUT/test-results.txt" | head -10 || echo "(no FAIL/ERROR lines)"

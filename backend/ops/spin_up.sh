#!/bin/bash
# Spin up the persistent work box: boot, install, verify, ship code, LEAVE RUNNING.
# Policy (founder): the box stays up across phases. It is destroyed ONLY on
# explicit order. Run backend/ops/close_box.sh to stop billing.
set -euo pipefail

HEAVY=/Users/anixd/Documents/Sova/HeavyWork
INFRA=$HEAVY/backend/infra-train
WS=$HEAVY/Lab/solva-fin-sys1
KEY=$INFRA/sova_train_key
REMOTE=ubuntu
OUT=$WS/modeling/reports/setup-$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

cd "$INFRA"
export AWS_PROFILE=passkarwado
# NO trap. NO destroy. The box lives until close_box.sh.

echo "── [1/5] booting box ──"
terraform apply -auto-approve > /dev/null
IP=$(terraform output -raw public_ip)
echo "$IP" > /tmp/sova_box_ip
echo "box: $IP"

echo "── [2/5] waiting for torch + GPU (verified bootstrap) ──"
for i in $(seq 1 60); do
  if ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes \
      "$REMOTE@$IP" 'test -f /opt/venv/bin/activate && /opt/venv/bin/python -c "import torch" && nvidia-smi -L' 2>/dev/null; then
    echo "ready after ~$((i*15))s"; break
  fi
  [ "$i" = 60 ] && { echo "FATAL: bootstrap timeout (box LEFT RUNNING for inspection)"; exit 1; }
  sleep 15
done

echo "── [3/5] shipping workspace (code + dataset package) ──"
tar czf /tmp/sova-finance1.tgz -C "$WS" \
  modeling finance1 PLAN.md README.md DATASET_START_HERE.md MASTER_PLAN.md \
  -C "$WS/datasets/processed/decisions/finqa" research-package-balanced-v2
scp -q -i "$KEY" /tmp/sova-finance1.tgz "$REMOTE@$IP:/tmp/"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'mkdir -p ~/work/datasets/processed/decisions/finqa && tar xzf /tmp/sova-finance1.tgz -C ~/work --warning=no-unknown-keyword'
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'if [ ! -d ~/work/datasets/processed/decisions/finqa/research-package-balanced-v2 ]; then mv ~/work/research-package-balanced-v2 ~/work/datasets/processed/decisions/finqa/; fi'

echo "── [4/5] verifying environment (119 tests, no training) ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'cd ~/work && /opt/venv/bin/python -m unittest discover -s modeling/tests -t . -v > test-results.txt 2>&1; tail -3 test-results.txt' || true
scp -q -i "$KEY" "$REMOTE@$IP:~/work/test-results.txt" "$OUT/" 2>/dev/null || true

echo "── [5/5] box state ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'nvidia-smi -L; /opt/venv/bin/python -c "import torch,transformers,peft; print(\"torch\", torch.__version__, \"| transformers\", transformers.__version__, \"| peft\", peft.__version__, \"| cuda\", torch.cuda.is_available())"'

cat <<EOF

═══════════════════════════════════════════════════════════
BOX IS UP AND STAYS UP
  IP:       $IP
  ssh:      ssh -i $KEY $REMOTE@$IP
  code:     ~/work/modeling   data: ~/work/datasets/...
  python:   /opt/venv/bin/python
  cost:     ~\$1.01/hr while standing
  close:    bash backend/ops/close_box.sh   (only on explicit order)
EOF
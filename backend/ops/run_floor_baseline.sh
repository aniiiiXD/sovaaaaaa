#!/bin/bash
# Run the Finance-1 floor baseline on an ephemeral cloud GPU box.
# Lifecycle: apply -> bootstrap wait -> ship code -> test -> train -> fetch -> destroy.
# Everything is logged; the box is destroyed in ALL exit paths.
set -euo pipefail

HEAVY=/Users/anixd/Documents/Sova/HeavyWork
INFRA=$HEAVY/backend/infra-train
WS=$HEAVY/Lab/solva-fin-sys1
KEY=$INFRA/sova_train_key
REMOTE=ubuntu
PKG=$WS/datasets/processed/decisions/finqa/research-package-balanced-v2
OUT=$WS/modeling/reports/floor-run-$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

export AWS_PROFILE=passkarwado   # IAM user with ec2/iam deploy rights; no creds = instant abort

cd "$INFRA"
cleanup() { terraform destroy -auto-approve >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "── [1/6] launching box (g5.xlarge, Mumbai) ──"
terraform apply -auto-approve > /dev/null
IP=$(terraform output -raw public_ip)
echo "box up: $IP"

echo "── [2/6] waiting for ssh + driver bootstrap ──"
for i in $(seq 1 60); do
  if ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 -o BatchMode=yes \
      "$REMOTE@$IP" 'test -f /opt/venv/bin/activate && /opt/venv/bin/python -c "import torch" && nvidia-smi -L' 2>/dev/null; then
    echo "box ready (torch + GPU verified) after ~$((i*15))s"; break
  fi
  [ "$i" = 60 ] && { echo "FATAL: bootstrap timeout"; exit 1; }
  sleep 15
done

echo "── [3/6] shipping workspace (code + package only) ──"
tar czf /tmp/sova-finance1.tgz -C "$WS" \
  modeling finance1 PLAN.md README.md DATASET_START_HERE.md \
  -C "$WS/datasets/processed/decisions/finqa" research-package-balanced-v2
scp -q -i "$KEY" /tmp/sova-finance1.tgz "$REMOTE@$IP:/tmp/"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'mkdir -p ~/work/datasets/processed/decisions/finqa && tar xzf /tmp/sova-finance1.tgz -C ~/work --warning=no-unknown-keyword'
# tar preserved modeling/finance1 at ~/work and the package inside datasets/... — fix layout:
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'if [ ! -d ~/work/datasets/processed/decisions/finqa/research-package-balanced-v2 ]; then mv ~/work/research-package-balanced-v2 ~/work/datasets/processed/decisions/finqa/; fi'

echo "── [4/6] full test suite (torch now present: validates peft fix) ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'cd ~/work && /opt/venv/bin/python -m unittest discover -s modeling/tests -t . -v > test-results.txt 2>&1; tail -4 test-results.txt' || true
# Incremental fetch: the test log comes home BEFORE anything can kill the box.
scp -q -i "$KEY" "$REMOTE@$IP:~/work/test-results.txt" "$OUT/" 2>/dev/null || true

echo "── [5/6] INSTRUMENTED fp32 DIAGNOSTIC (Codex protocol: one variable, full telemetry) ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=6 -o ConnectionAttempts=3 \
  "$REMOTE@$IP" 'bash -s' <<'RUN' || true
set -uo pipefail
cd ~/work
PKG=datasets/processed/decisions/finqa/research-package-balanced-v2
PY=/opt/venv/bin/python
mkdir -p runs/floor

# Environment record: exact versions (Codex: no ranges) + driver.
$PY -c "import torch, transformers; print('torch', torch.__version__, '| transformers', transformers.__version__, '| cuda', torch.cuda.is_available())"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv > runs/floor/gpu-info.txt

# Watchdog: every 30s push host RAM, GPU, kernel ring tail, live train output
# to /dev/console so a box death still leaves forensics via get-console-output.
cat > /tmp/watchdog.sh <<'WD'
#!/bin/bash
while true; do
  {
    echo "[wd $(date -u +%H:%M:%S)] host_free_mb=$(free -m | awk '/Mem:/{print $7}') load=$(cut -d' ' -f1 /proc/loadavg)"
    nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader
    dmesg 2>/dev/null | grep -iE "xid|nvrm|panic|oom|error" | tail -2
    tail -2 /home/ubuntu/work/train-live.log 2>/dev/null
  } >> /dev/console 2>&1
  sleep 30
done
WD
chmod +x /tmp/watchdog.sh
sudo nohup /tmp/watchdog.sh > /dev/null 2>&1 &
echo "watchdog pid $!"

# fp32: NO --amp, NO expandable_segments. One changed variable vs attempts 8/9.
# TORCHDYNAMO_DISABLE=1: torch 2.14 auto-compiles the model (inductor buffers
# ballooned an 8-row batch to 20.85GB). Eager restores the standard profile.
export TORCHDYNAMO_DISABLE=1
$PY -m modeling.floor.train \
  --data "$PKG" --val-data "$PKG" --out runs/floor \
  --backbone answerdotai/ModernBERT-large --epochs 12 --batch-size 1 --lr 2e-5 \
  2>&1 | tee train-live.log || true

sudo pkill -f watchdog.sh 2>/dev/null || true

$PY -m modeling.floor.calibrate \
  --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/temperature.json || true

$PY -m modeling.floor.evaluate \
  --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/report.json \
  --device cuda || true

sudo journalctl -k > runs/floor/journalctl-k.log 2>/dev/null || true
/opt/venv/bin/pip freeze > runs/floor/pip-freeze.txt 2>/dev/null || true
free -m > runs/floor/hostmem.txt

echo "── [5b] CONTROL: stock Qwen3-4B prompted, same 28 questions ──"
mkdir -p runs/control
$PY -m modeling.control.control_eval \
  --package "$PKG" --out runs/control/report.json \
  --model Qwen/Qwen3-4B --revision 1cfa9a7208912126459214e8b04321603b3df60c || true

echo "=== RUN COMPLETE ==="
true
RUN

echo "── [6/6] fetching results → destroying box ──"
# Rescue loop: if the box rebooted mid-training, give it a chance to come back
# so partial results (checkpoints, config) can still be fetched.
for attempt in 1 2 3 4 5; do
  if ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=8 -o BatchMode=yes \
      "$REMOTE@$IP" 'test -d ~/work' 2>/dev/null; then
    echo "box reachable on rescue attempt $attempt — fetching"; break
  fi
  echo "rescue attempt $attempt: box unreachable, waiting 45s"; sleep 45
done
scp -q -i "$KEY" -r "$REMOTE@$IP:~/work/runs/floor" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" -r "$REMOTE@$IP:~/work/runs/control" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" "$REMOTE@$IP:~/work/test-results.txt" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" "$REMOTE@$IP:~/work/train-live.log" "$OUT/" 2>/dev/null || true
# Forensic: pull the full bootstrap log from the console BEFORE destroying.
export AWS_PAGER=""
aws ec2 get-console-output --region "$(terraform output -raw region 2>/dev/null || echo ap-south-1)" \
  --instance-id "$(terraform output -raw instance_id)" \
  --latest --output text --query Output > "$OUT/bootstrap-console.log" 2>/dev/null || true
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE@$IP" \
  'cat ~/work/runs/floor/report.json' | head -c 200 > "$OUT/report-head.txt"

terraform destroy -auto-approve > /dev/null
trap - EXIT

echo ""
echo "═══════════════════════════════════════════"
echo "FLOOR BASELINE COMPLETE → $OUT"
echo "report: $OUT/floor/report.json"
echo "═══════════════════════════════════════════"
cat "$OUT/floor/report.json" 2>/dev/null | head -40 || true

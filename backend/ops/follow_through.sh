#!/bin/bash
# Follow-through: wait for floor training to finish on the standing box, then
# run calibrate + evaluate + control, fetch ALL artifacts home. One report.
set -uo pipefail
IP=13.126.215.189
KEY=/Users/anixd/Documents/Sova/HeavyWork/backend/infra-train/sova_train_key
OUT=/Users/anixd/Documents/Sova/HeavyWork/Lab/solva-fin-sys1/modeling/reports/steps-1-2-$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

echo "── waiting for training to complete (checkpoint written or process gone) ──"
for i in $(seq 1 40); do
  STATE=$(ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "ubuntu@$IP" \
    'if ! pgrep -f "modeling.floor.train" > /dev/null; then echo DONE; elif grep -q "checkpoint written" ~/work/train-live.log 2>/dev/null; then echo DONE; else echo RUNNING; fi' 2>/dev/null)
  echo "[$i] $STATE"
  [ "$STATE" = "DONE" ] && break
  sleep 120
done

echo "── tail of training log ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "ubuntu@$IP" 'grep -E "epoch|early|checkpoint" ~/work/train-live.log | tail -15' 2>/dev/null

echo "── calibrate + evaluate (GPU) + control ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "ubuntu@$IP" 'bash -s' <<'RUN' || true
cd ~/work
PY=/opt/venv/bin/python
PKG=datasets/processed/decisions/finqa/research-package-balanced-v2
$PY -m modeling.floor.calibrate --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/temperature.json || true
$PY -m modeling.floor.evaluate --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/report.json --device cuda || true
mkdir -p runs/control
$PY -m modeling.control.control_eval --package "$PKG" --out runs/control/report.json --model Qwen/Qwen3-4B --revision 1cfa9a7208912126459214e8b04321603b3df60c || true
echo "=== PHASES COMPLETE ==="
RUN

echo "── fetching artifacts home ──"
scp -q -i "$KEY" -r "ubuntu@$IP:~/work/runs/floor" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" -r "ubuntu@$IP:~/work/runs/control" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" "ubuntu@$IP:~/work/train-live.log" "$OUT/" 2>/dev/null || true
echo "── STEP 1 REPORT ──"
python3 - <<'PY'
import json, pathlib
out = pathlib.Path("$OUT".replace("$OUT", ""))
PY
cat "$OUT/floor/report.json" 2>/dev/null | head -14
echo "── STEP 2 REPORT ──"
cat "$OUT/control/report.json" 2>/dev/null | head -12
echo "── ARTIFACTS AT: $OUT ──"

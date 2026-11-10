#!/bin/bash
# Watch training to completion, IMMEDIATELY download the trained weights home,
# then run calibrate + eval on the box and fetch those reports too.
set -uo pipefail
IP=13.126.215.189
KEY=/Users/anixd/Documents/Sova/HeavyWork/backend/infra-train/sova_train_key
OUT=/Users/anixd/Documents/Sova/HeavyWork/Lab/solva-fin-sys1/modeling/reports/trained-weights-$(date +%Y%m%d-%H%M%S)
mkdir -p "$OUT"

echo "── waiting for 12-epoch training to complete ──"
for i in $(seq 1 60); do
  STATE=$(ssh -i "$KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "ubuntu@$IP" \
    'pgrep -f "modeling.floor.train" > /dev/null && echo RUNNING || echo DONE' 2>/dev/null)
  echo "[$i] $STATE"
  [ "$STATE" = "DONE" ] && break
  sleep 120
done

echo "── training summary ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "ubuntu@$IP" 'grep -E "epoch|early|checkpoint" ~/work/train-live.log | tail -14' 2>/dev/null

echo "── DOWNLOADING TRAINED WEIGHTS HOME (priority 1) ──"
scp -i "$KEY" "ubuntu@$IP:~/work/runs/floor/checkpoint.pt" "$OUT/" 2>/dev/null && echo "checkpoint.pt home" || echo "WARNING: checkpoint fetch failed"
scp -q -i "$KEY" "ubuntu@$IP:~/work/runs/floor/config.json" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" "ubuntu@$IP:~/work/train-live.log" "$OUT/" 2>/dev/null || true
ls -lh "$OUT/checkpoint.pt" 2>/dev/null | awk '{print "weights on laptop:", $5}'

echo "── calibrate + evaluate on box ──"
ssh -i "$KEY" -o StrictHostKeyChecking=no "ubuntu@$IP" 'bash -s' <<'RUN' || true
cd ~/work
PY=/opt/venv/bin/python
PKG=datasets/processed/decisions/finqa/research-package-balanced-v2
$PY -m modeling.floor.calibrate --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/temperature.json || true
$PY -m modeling.floor.evaluate --checkpoint-dir runs/floor --data "$PKG" --out runs/floor/report.json --device cuda || true
echo "=== EVAL COMPLETE ==="
RUN

echo "── fetching eval reports ──"
scp -q -i "$KEY" "ubuntu@$IP:~/work/runs/floor/report.json" "$OUT/" 2>/dev/null || true
scp -q -i "$KEY" "ubuntu@$IP:~/work/runs/floor/temperature.json" "$OUT/" 2>/dev/null || true

echo "── console forensics if box died at any point ──"
export AWS_PROFILE=passkarwado; export AWS_PAGER=""
IID=$(aws ec2 describe-instances --region ap-south-1 --filters "Name=instance-state-name,Values=running" --query "Reservations[0].Instances[0].InstanceId" --output text 2>/dev/null)
[ -n "$IID" ] && [ "$IID" != "None" ] && aws ec2 get-console-output --region ap-south-1 --instance-id "$IID" --latest --output text --query Output > "$OUT/console.log" 2>/dev/null || true

echo "════ DONE — weights + reports at: $OUT ════"
cat "$OUT/report.json" 2>/dev/null | head -14

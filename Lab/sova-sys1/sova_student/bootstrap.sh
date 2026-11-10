#!/usr/bin/env bash
set -euo pipefail
cd /opt/ml/sova-student
python3 -m sova_student.bootstrap
exec python3 -m sova_student.cloud_worker

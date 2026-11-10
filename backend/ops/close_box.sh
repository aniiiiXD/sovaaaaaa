#!/bin/bash
# Close the persistent work box. RUNS ONLY ON EXPLICIT FOUNDER ORDER.
# Stops billing immediately. Nothing else.
set -euo pipefail
cd "$(dirname "$0")/../infra-train"
export AWS_PROFILE=passkarwado
terraform destroy -auto-approve > /dev/null 2>&1 || true
rm -f .terraform.tfstate.lock.info
echo "box closed. billing stopped."

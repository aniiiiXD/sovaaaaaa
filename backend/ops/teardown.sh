#!/bin/bash
# Kill switch: removes every resource this stack created. The compute policy
# requires this to exist and work. Run it when the demo window ends.
set -euo pipefail

cd "$(dirname "$0")/../infra"

[ -f terraform.tfvars ] || { echo "No terraform.tfvars; refusing to guess what to destroy."; exit 1; }

terraform init >/dev/null
terraform plan -destroy
echo
read -rp "DESTROY the serving stack and STOP ALL SPEND? (yes/no): " answer
[ "$answer" = "yes" ] || { echo "Aborted, nothing destroyed."; exit 1; }

terraform destroy -auto-approve
echo "Stack destroyed. Verify the billing console shows no running GPU instances."

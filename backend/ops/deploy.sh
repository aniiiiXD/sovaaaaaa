#!/bin/bash
# Bring the serving stack up. Requires: terraform, aws CLI, aws login.
# APPROVAL GATE: this starts the GPU meter. Run only after a deliberate go.
set -euo pipefail

cd "$(dirname "$0")/../infra"

[ -f terraform.tfvars ] || { echo "No terraform.tfvars. Copy terraform.tfvars.example first, pin model_revision."; exit 1; }

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "AWS credentials not active. Run aws login / export credentials first."
  exit 1
fi

terraform init
terraform plan
echo
read -rp "APPLY and START PAYING for the GPU box? (yes/no): " answer
[ "$answer" = "yes" ] || { echo "Aborted, nothing created."; exit 1; }

terraform apply -auto-approve

ALB=$(terraform output -raw alb_dns_name)
echo
echo "Stack is up. vLLM boots in ~3-5 min (model pull + load)."
echo "  Watch boot:   aws ssm start-session --target \$(aws ec2 describe-instances --filters Name=tag:Name,Values=sova-serving-gpu Name=instance-state-name,Values=running --query 'Reservations[0].Instances[0].InstanceId' --output text) --document-name AWS-StartInteractiveCommand --command 'docker logs -f vllm'"
echo "  Smoke test:   curl http://$ALB/v1/models"
echo "  Gateway env:  SOVA_VLLM_BASE_URL=http://$ALB"

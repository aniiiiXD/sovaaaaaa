# HANDOFF — IAM fix only (for the next agent)

## Status — completed 2026-11-04

Created `arn:aws:iam::169970912263:policy/SovaServingDeploy` and attached it
directly to IAM user `PassKarwado` through the AWS console. The Permissions tab
confirms the attachment. No infrastructure was deployed and no credentials changed.

Corrected three invalid action names in `infra/deploy-policy.json` before creation:
`cloudwatch:DeleteMetricAlarms` became `cloudwatch:DeleteAlarms`; removed
`budgets:CreateBudget` and `budgets:DeleteBudget`, which are covered by the existing
`budgets:ModifyBudget`. AWS policy validation then showed zero errors.
The policy retains broad resource wildcards, including IAM PassRole and
CreateServiceLinkedRole warnings; it should not be described as least-privilege.

Read-only checks with `--profile passkarwado`:
- STS identity: `arn:aws:iam::169970912263:user/PassKarwado`.
- EC2 DescribeAvailabilityZones in us-east-2: `us-east-2a`.
- ELBv2 DescribeLoadBalancers in us-east-2: succeeded, zero load balancers.
- Budgets DescribeBudgets: succeeded (empty response).
- IAM GetRole for `sova-serving-instance-role`: `NoSuchEntity`, not AccessDenied;
  authorization works, but this role does not exist.

The original instructions below are retained for context; do not recreate the policy.

One job: give the IAM user `PassKarwado` permission to deploy the serving stack. Nothing else.

## Blocker

Terraform plan fails with:
`UnauthorizedOperation: User arn:aws:iam::169970912263:user/PassKarwado is not authorized to
perform: ec2:DescribeAvailabilityZones` (and it lacks EC2/IAM/autoscaling/ELB/budgets entirely).

Local creds are already active for this user — no key setup needed.

## The fix

Policy JSON already written and validated: **`backend/infra/deploy-policy.json`**

Two equivalent ways to attach (either one):

### A) CLI (needs an admin identity)
```bash
export AWS_PROFILE=<admin-profile>   # NOT passkarwado — it cannot edit itself
aws iam create-policy \
  --policy-name SovaServingDeploy \
  --policy-document file:///Users/anixd/Documents/Sova/HeavyWork/backend/infra/deploy-policy.json
aws iam attach-user-policy \
  --user-name PassKarwado \
  --policy-arn arn:aws:iam::169970912263:policy/SovaServingDeploy
```

### B) Console (admin/root login)
IAM → Users → `PassKarwado` → Add permissions → Attach policies directly →
Create policy → JSON tab → paste `backend/infra/deploy-policy.json` →
name `SovaServingDeploy` → Create → select it → Add permissions.

## Verify

```bash
export AWS_PROFILE=passkarwado
aws ec2 describe-availability-zones --region us-east-2 --query 'AvailabilityZones[0].ZoneName'
```
Returns a zone name (e.g. `us-east-2a`) instead of `UnauthorizedOperation` → done.

## Do NOT

- Do not run `deploy.sh` / create any resources — that is explicitly out of scope for this handoff
- Do not modify the policy contents; it is intentionally least-privilege for the stack in `backend/infra/`
- Do not touch `~/.aws/credentials`

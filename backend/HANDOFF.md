# HANDOFF — IAM fix only (for the next agent)

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

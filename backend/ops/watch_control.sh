#!/bin/bash
# Watch the control job; fetch the report when done.
export AWS_PROFILE=passkarwado
JOB=sova-control-20261106-204403
REGION=us-east-2
for i in $(seq 1 45); do
  STATUS=$(aws sagemaker describe-training-job --region $REGION --training-job-name $JOB \
    --query "[TrainingJobStatus,SecondaryStatus]" --output text 2>/dev/null)
  echo "[$i] $STATUS"
  S=$(echo "$STATUS" | awk '{print $1}')
  case "$S" in
    Completed|Failed|Stopped) break ;;
  esac
  sleep 60
done
aws sagemaker describe-training-job --region $REGION --training-job-name $JOB \
  --query "{status:TrainingJobStatus,reason:FailureReason,billable:BillableTimeInSeconds}" --output json
echo "── report ──"
aws s3 cp s3://sova-finance1-artifacts-use2-169970912263/outputs/$JOB/output/model.tar.gz /tmp/control-report.tgz --quiet 2>/dev/null \
  && mkdir -p /tmp/control-report && tar xzf /tmp/control-report.tgz -C /tmp/control-report \
  && cat /tmp/control-report/control/report.json 2>/dev/null | head -14

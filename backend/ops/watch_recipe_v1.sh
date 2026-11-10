#!/bin/bash
# Watch the recipe v1 SageMaker job; one report at the end.
export AWS_PROFILE=passkarwado
JOB=sova-recipe-v1-20261106-164824
REGION=us-east-2
for i in $(seq 1 90); do
  STATUS=$(aws sagemaker describe-training-job --region $REGION --training-job-name $JOB \
    --query "[TrainingJobStatus,SecondaryStatus]" --output text 2>/dev/null)
  echo "[$i] $STATUS"
  S=$(echo "$STATUS" | awk '{print $1}')
  case "$S" in
    Completed|Failed|Stopped) break ;;
  esac
  sleep 120
done
echo "── final ──"
aws sagemaker describe-training-job --region $REGION --training-job-name $JOB \
  --query "{status:TrainingJobStatus,secondary:SecondaryStatus,reason:FailureReason,started:TrainingStartTime,ended:TrainingEndTime,billable:BillableTimeInSeconds}" --output json
echo "── outputs ──"
aws s3 ls s3://sova-finance1-artifacts-169970912263/outputs/ --recursive 2>/dev/null | head -8

"""Submit the Finance-1 recipe v1 training job to SageMaker.

Worker-jobs pattern: no standing box. SageMaker boots the instance, runs the
launcher, uploads /opt/ml/model to S3, and terminates. One command, no ssh.

Usage: ./.venv-bench/bin/python backend/ops/submit_recipe_v1.py [--dry]
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

BUCKET = 'sova-finance1-artifacts-169970912263'
ROLE = 'arn:aws:iam::169970912263:role/sova-sagemaker-exec'
REGION = 'ap-south-1'
SRC = Path('/Users/anixd/Documents/Sova/HeavyWork/Lab/solva-fin-sys1/sagemaker_src')


def main() -> int:
    import boto3

    sagemaker = boto3.client('sagemaker', region_name=REGION)
    job_name = f'sova-recipe-v1-{time.strftime("%Y%m%d-%H%M%S")}'

    response = sagemaker.create_training_job(
        TrainingJobName=job_name,
        RoleArn=ROLE,
        AlgorithmSpecification={
            'TrainingImage': (
                '763104351884.dkr.ecr.ap-south-1.amazonaws.com/'
                'pytorch-training:2.4.1-gpu-py311-cu124-ubuntu22.04-ec2'
            ),
            'TrainingInputMode': 'File',
            'ContainerEntrypoint': [
                'bash', '-c',
                'cd /opt/ml/input/data/code '
                '&& tar xzf launcher.tgz '
                '&& pip install -q -r requirements.txt '
                '&& TORCHDYNAMO_DISABLE=1 PYTHONUNBUFFERED=1 python launcher.py',
            ],
        },
        ResourceConfig={
            'InstanceType': 'ml.g5.xlarge',
            'InstanceCount': 1,
            'VolumeSizeInGB': 100,
        },
        InputDataConfig=[
            {
                'ChannelName': 'code',
                'DataSource': {
                    'S3DataSource': {
                        'S3Uri': f's3://{BUCKET}/code/',
                        'S3DataType': 'S3Prefix',
                    }
                },
            },
            {
                'ChannelName': 'data',
                'DataSource': {
                    'S3DataSource': {
                        'S3Uri': f's3://{BUCKET}/data/',
                        'S3DataType': 'S3Prefix',
                    }
                },
            },
        ],
        OutputDataConfig={'S3OutputPath': f's3://{BUCKET}/outputs/'},
        StoppingCondition={'MaxRuntimeInSeconds': 14400},
        EnableManagedSpotTraining=False,
    )
    print('job:', response['TrainingJobArn'])
    print('watch: aws sagemaker describe-training-job --region', REGION,
          '--training-job-name', job_name)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

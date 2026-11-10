"""Exact student and hardware used for the finance transfer evaluation."""

from sova_eval.submit_sagemaker import BUCKET

SOURCE_JOB = "sova-mamba-student-20261109-143156-2935f5"
STUDENT_PREFIX = f"s3://{BUCKET}/sys1/legal-student/{SOURCE_JOB}/models/distilled/"
STUDENT_FILES = {
    "backbone-config.json": (302, "3b08fbe8c142a290108b85f9fb8787a046bfe5136c6421479ffaf4c1ff37f3cc"),
    "metadata.json": (1257, "81dab7db09ec3d7ff1fd978fa295ec47bb4564969cf0c58e984724aacbc8ecdb"),
    "student.safetensors": (1473445228, "2e5e05cddd2589d9fc11630e560c333a9a99b378997caec3c286296444e161a6"),
}
TOKENIZER_DIR = f"reports/{SOURCE_JOB}/tokenizer"
INSTANCE = "ml.g5.2xlarge"
MAX_RUNTIME_SECONDS = 1800
PRIOR_RATE_USD_PER_HOUR = 1.515

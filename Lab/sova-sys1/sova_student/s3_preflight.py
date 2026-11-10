"""Fail early if the job role cannot store and retrieve student artifacts."""

from __future__ import annotations

from contextlib import closing
import uuid


def verify_s3_artifact_access(client, *, bucket: str, prefix: str) -> dict:
    """Exercise multipart upload and read in each model's actual S3 prefix.

    Probe objects contain no dataset or model data. Their unique names prevent
    cleanup from touching anything created by another process or job.
    """
    if not bucket or not prefix.strip("/"):
        raise ValueError("A bucket and job-specific prefix are required")
    prefix = prefix.strip("/")
    payload = b"SOVA artifact storage preflight\n"
    variants = ("labels_only", "distilled")
    for variant in variants:
        key = f"{prefix}/models/{variant}/.sova-access-probe-{uuid.uuid4().hex}.safetensors"
        upload_id = None
        try:
            upload = client.create_multipart_upload(
                Bucket=bucket, Key=key, ContentType="application/octet-stream",
            )
            upload_id = upload["UploadId"]
            part = client.upload_part(
                Bucket=bucket, Key=key, UploadId=upload_id, PartNumber=1, Body=payload,
            )
            client.complete_multipart_upload(
                Bucket=bucket, Key=key, UploadId=upload_id,
                MultipartUpload={"Parts": [{"ETag": part["ETag"], "PartNumber": 1}]},
            )
            upload_id = None
            if client.head_object(Bucket=bucket, Key=key)["ContentLength"] != len(payload):
                raise RuntimeError(f"S3 {variant} preflight object length does not match")
            with closing(client.get_object(Bucket=bucket, Key=key)["Body"]) as body:
                if body.read() != payload:
                    raise RuntimeError(f"S3 {variant} preflight object content does not match")
        finally:
            if upload_id is not None:
                try:
                    client.abort_multipart_upload(Bucket=bucket, Key=key, UploadId=upload_id)
                except Exception as error:
                    print(f"Warning: could not abort an S3 preflight upload: {error}", flush=True)
            try:
                client.delete_object(Bucket=bucket, Key=key)
            except Exception as error:
                # Deletion is not required for model upload. Warn instead of
                # rejecting a role that can write and read but cannot delete.
                print(f"Warning: could not delete an S3 preflight object: {error}", flush=True)
    return {"variants": list(variants), "multipart_upload_and_read": True, "probe_bytes": len(payload)}

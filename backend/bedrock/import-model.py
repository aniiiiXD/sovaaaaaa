#!/usr/bin/env python3
"""Verify the pinned checkpoint and submit its Bedrock import only with --submit."""
import argparse
import json
import pathlib
import subprocess

BASE = pathlib.Path(__file__).resolve().parent
LOCAL = BASE.parents[2] / "models" / "Fin-o1-14B"
BUCKET = "passkarwado-useast1"
PREFIX = "sova/fin-o1-14b/bd4b97b8e5f6954c2c6d92da75b6ba4cb948b56d/"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check-only", action="store_true")
    mode.add_argument("--submit", action="store_true")
    args = parser.parse_args()

    def aws(*command):
        result = subprocess.run(["aws", *command, "--profile", "passkarwado", "--region", "us-east-1",
                                 "--output", "json", "--no-cli-pager"], capture_output=True, text=True, check=False)
        if result.returncode:
            raise SystemExit(result.stderr.strip())
        return json.loads(result.stdout)

    if aws("sts", "get-caller-identity")["Account"] != "169970912263":
        raise SystemExit("Wrong account; no import submitted.")
    expected = {file.name: file.stat().st_size for file in LOCAL.iterdir()
                if file.is_file() and file.name != ".gitattributes"}
    shards = [name for name in expected if name.endswith(".safetensors")]
    if len(shards) != 6 or not all(name in expected for name in ["config.json", "tokenizer.json", "tokenizer_config.json", "model.safetensors.index.json"]):
        raise SystemExit("Local checkpoint is incomplete; no import submitted.")
    objects = aws("s3api", "list-objects-v2", "--bucket", BUCKET, "--prefix", PREFIX)
    actual = {item["Key"][len(PREFIX):]: item["Size"] for item in objects.get("Contents", [])}
    if actual != expected:
        missing = [name for name, size in expected.items() if actual.get(name) != size]
        extra = sorted(set(actual) - set(expected))
        raise SystemExit(f"S3 checkpoint incomplete or different. Missing/different: {missing}; unexpected: {extra}. No import submitted.")
    role = aws("iam", "get-role", "--role-name", "SovaBedrockModelImport")["Role"]
    if role["AssumeRolePolicyDocument"] != json.loads((BASE / "trust.json").read_text()):
        raise SystemExit("Import role trust differs from reviewed configuration; no import submitted.")
    print(f"Verified {len(expected)} objects ({sum(expected.values())} bytes) and Bedrock trust.")
    if args.submit:
        job = aws("bedrock", "create-model-import-job", "--cli-input-json", "file://" + str(BASE / "import-job.json"))
        print(json.dumps(job, indent=2))
    else:
        print("Read-only preflight passed; no import submitted.")


if __name__ == "__main__":
    main()

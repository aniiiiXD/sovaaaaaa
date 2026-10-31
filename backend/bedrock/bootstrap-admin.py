#!/usr/bin/env python3
"""One-time IAM setup. Run with an administrator profile in account 169970912263.

Creates only the two named Sova roles and Vercel identity provider, and grants
PassKarwado permission to pass the import role and operate tagged Sova models.
Does not create model imports, launch GPUs, invoke inference, or store keys.
"""
import argparse
import json
import pathlib
import subprocess

BASE = pathlib.Path(__file__).resolve().parent
ACCOUNT = "169970912263"
ISSUER = "oidc.vercel.com/aniiiixds-projects"
AUDIENCE = "https://vercel.com/aniiiixds-projects"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", help="Administrator AWS CLI profile; omit in AWS CloudShell")
    parser.add_argument("--apply", action="store_true", help="Apply the reviewed IAM configuration")
    args = parser.parse_args()
    if not args.apply:
        print("Review the JSON policies next to this script. Add --apply to create the scoped IAM resources.")
        return

    def aws(*command, allow_missing=False):
        cmd = ["aws", *command, "--region", "us-east-1", "--output", "json", "--no-cli-pager"]
        if args.profile:
            cmd += ["--profile", args.profile]
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode:
            if allow_missing and "(NoSuchEntity)" in result.stderr:
                return None
            raise SystemExit(result.stderr.strip())
        return json.loads(result.stdout) if result.stdout.strip() else {}

    if aws("sts", "get-caller-identity")["Account"] != ACCOUNT:
        raise SystemExit("Wrong AWS account; no IAM changes made.")

    def role(name, trust_file, policy_file):
        trust = json.loads((BASE / trust_file).read_text())
        existing = aws("iam", "get-role", "--role-name", name, allow_missing=True)
        if existing:
            if existing["Role"]["AssumeRolePolicyDocument"] != trust:
                raise SystemExit(f"Existing {name} has a different trust policy; refusing to overwrite it.")
        else:
            aws("iam", "create-role", "--role-name", name,
                "--assume-role-policy-document", "file://" + str(BASE / trust_file),
                "--description", "Sova Fin-o1 serverless inference setup")
        aws("iam", "put-role-policy", "--role-name", name, "--policy-name", "SovaFinO1Access",
            "--policy-document", "file://" + str(BASE / policy_file))
        print(f"Configured {name}")

    role("SovaBedrockModelImport", "trust.json", "s3-read-policy.json")
    provider_arn = f"arn:aws:iam::{ACCOUNT}:oidc-provider/{ISSUER}"
    provider = aws("iam", "get-open-id-connect-provider", "--open-id-connect-provider-arn", provider_arn, allow_missing=True)
    if provider is None:
        aws("iam", "create-open-id-connect-provider", "--url", "https://" + ISSUER, "--client-id-list", AUDIENCE)
    elif AUDIENCE not in provider["ClientIDList"]:
        raise SystemExit("Existing Vercel provider is missing the expected audience; administrator review required.")
    role("SovaBedrockInvoke", "vercel-trust.json", "invoke-policy.json")
    # IAM users have a small aggregate inline-policy limit. Use a customer-managed
    # policy instead, preserving the exact reviewed permissions.
    policy_arn = f"arn:aws:iam::{ACCOUNT}:policy/SovaBedrockImport"
    policy = aws("iam", "get-policy", "--policy-arn", policy_arn, allow_missing=True)
    if policy is None:
        aws("iam", "create-policy", "--policy-name", "SovaBedrockImport",
            "--policy-document", "file://" + str(BASE / "operator-policy.json"),
            "--description", "Scoped Sova Bedrock import and invocation access")
    else:
        version = aws("iam", "get-policy-version", "--policy-arn", policy_arn,
                      "--version-id", policy["Policy"]["DefaultVersionId"])
        if version["PolicyVersion"]["Document"] != json.loads((BASE / "operator-policy.json").read_text()):
            raise SystemExit("Existing SovaBedrockImport policy differs; refusing to overwrite it.")
    aws("iam", "attach-user-policy", "--user-name", "PassKarwado", "--policy-arn", policy_arn)
    print("IAM setup complete. No model compute was launched.")


if __name__ == "__main__":
    main()

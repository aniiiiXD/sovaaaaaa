#!/usr/bin/env python3
"""Mint or verify Sova API keys (sk-sova-...).

The plaintext key is shown ONCE, at mint time. Only the SHA-256 fingerprint
is ever stored or shared: paste fingerprints into the website's
SOVA_API_KEY_HASHES env (comma-separated) via `vercel env add`.

Usage:
  python3 keys.py mint [--label customer-name]
  python3 keys.py verify sk-sova-...   # prints the fingerprint to compare
"""
import argparse
import hashlib
import secrets
import sys

PREFIX = "sk-sova-"


def fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["mint", "verify"])
    parser.add_argument("key", nargs="?")
    parser.add_argument("--label", default="unnamed")
    args = parser.parse_args()

    if args.command == "mint":
        key = PREFIX + secrets.token_hex(24)
        fp = fingerprint(key)
        print(f"label:       {args.label}")
        print(f"key:         {key}")
        print(f"fingerprint: {fp}")
        print("\nGive the key to the customer over a secure channel.")
        print("Add the fingerprint to the website env:")
        print(f'  SOVA_API_KEY_HASHES="<existing>,{fp}"')
        print("Never store the plaintext key on our side.")
        return

    if not args.key:
        sys.exit("verify needs a key argument")
    print(fingerprint(args.key))


if __name__ == "__main__":
    main()

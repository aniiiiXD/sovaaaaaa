# Air-gap / private-inference readiness runbook

Date: 2026-10-29. Design only; no instance launched. Companion:
`SERVING_PLAN_DEMOS.md` (model matrix), `API_DESIGN.md` (contract).

## The claim we can honestly make

We demonstrate **network-isolated, private inference**: model weights and
inference run inside a boundary with no outbound internet path, verified
at request time. We do **not** claim a certified air-gapped deployment.
The playbook says the same; the website copy must too.

## Three boundaries, cheapest and strongest first

### Option A — Offline host (M5 laptop). Cost: $0. Strongest literal gap

The triage LoRA already trains and serves on the M5 via MLX.

1. Download/pin weights + tokenizer (`models/` convention, outside git)
2. `export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`, serve via MLX
3. Turn off Wi-Fi/en0; verify `networksetup -getairportnetwork en0` and
   no default route; optionally record the screen during the demo
4. Run the demo prompt; capture output + latency
5. Attestation: commands run, timestamps, interface state, screenshot

This is the **fallback live-demo path** — it always works, costs nothing,
and is the most defensible sentence in a meeting: "the machine is not on
a network."

### Option B — VPC-isolated SageMaker endpoint. Cost: ~$1-3.4/hr while up

The AWS-native story, and the customer-shaped one ("runs inside *your*
VPC/account"):

1. VPC with two private subnets, **no NAT gateway, no IGW route** for the
   endpoint's route table
2. SageMaker model already uses **model network isolation** (set in
   `backend/aws/model.json`); add `VpcConfig` with the private subnets +
   a security group whose **egress is explicitly denied** (default SGs
   allow all egress — this is the step people miss)
3. Weights staged to S3 **before** isolation; VPC endpoints for
   `s3` (and `logs`, `monitoring`) via gateway/interface endpoints so AWS
   plumbing works without internet
4. Invoke from an authorized client (Vercel OIDC role or admin profile)
5. **Verification protocol** (all five, recorded in the attestation):
   - instance has no public IP; route table has no IGW/NAT route
   - SG egress rules: empty
   - in-VPC curl to a public IP times out
   - VPC Flow Logs for the window: zero outbound-accept records to
     non-VPC CIDRs
   - inference succeeds while all of the above hold

### Option C — Self-managed EC2 GPU (the playbook's g5+vLLM). Cost: ~$1/hr

**Precondition: EC2 G-family quota is currently 0 in every region we use.**
File the quota increase early or skip this option.

1. Deep Learning AMI, `g5.xlarge`, 100 GB gp3, **no public IP**, private
   subnet, SSM Session Manager for access (zero SSH ports open)
2. While an internet-connected *setup* window is open: pull weights to
   the instance NVMe; `pip install vllm`
3. Close the window: remove NAT route, set SG egress deny
4. `HF_HUB_OFFLINE=1 vllm serve /opt/sova/model --host 127.0.0.1 --port 8001`
5. Same five-check verification protocol as Option B, plus
   `curl --max-time 5 https://huggingface.co` failing from the instance

## Attestation record (what `/private` publishes)

```json
{
  "mode": "vpc-isolated | offline-host",
  "model": "pinned name + revision",
  "verified_at": "ISO-8601",
  "checks": [
    { "check": "no public IP", "result": "pass", "evidence": "…" },
    { "check": "no IGW/NAT route", "result": "pass", "evidence": "…" },
    { "check": "SG egress denied", "result": "pass", "evidence": "…" },
    { "check": "external curl timeout", "result": "pass", "evidence": "…" },
    { "check": "flow logs: 0 egress accepts", "result": "pass", "evidence": "flow-log id" },
    { "check": "inference succeeded", "result": "pass", "evidence": "latency_ms" }
  ],
  "claimer": "network-isolated demonstration; not a certified air gap"
}
```

## Demo-day choice

Present **A as the live demo** (zero cost, zero flake, strongest claim) and
**B as the enterprise architecture slide** ("here is the same thing shaped
like your VPC"). C only if the quota lands and someone specifically wants
vLLM specifics.

## Pre-flight checklist (do before any GPU session)

- [ ] Billing alarm $50 created
- [ ] Region + quota confirmed for the exact instance type
- [ ] Weights pinned + staged, sizes verified against the index
- [ ] Teardown command written down before the launch command
- [ ] Approval recorded: machine, window, est. cost (ask-before-compute)

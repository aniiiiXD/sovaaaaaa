import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { C, Facts, P, Section } from "../page-head";
import Callout from "../callout";

export const metadata: Metadata = {
  title: "Usage & Portal",
  description:
    "Sova meters every request per key. The portal at /portal shows totals, daily traffic, per-model success rate and latency, and self-serve key management at /portal/keys.",
};

const PORTAL_FACTS = [
  "Total requests, all time.",
  "Tokens in and tokens out, all time.",
  "Last used and key created, in UTC.",
  "Key status and the key id, the first 8 hex characters of the fingerprint, safe to share.",
  "A daily traffic chart for the last 14 days, requests and tokens.",
  "Per-model stats: requests, success rate, and latency (average and p50).",
];

const MANAGE_FACTS = [
  "Generate a new key at /portal/keys. Like every Sova key, it is shown exactly once, at issue.",
  "Revoke a key you no longer need. It stops authenticating; usage history stays with Sova.",
  "Request-level records are kept for 30 days, which is the deepest window the charts cover.",
];

export default function UsagePage() {
  return (
    <>
      <PageHead
        eyebrow="Resources"
        title="Usage & Portal"
        lead={
          <>
            Every request is metered against the API key that made it. The
            customer portal at <C>/portal</C> shows your numbers. Sign in by
            pasting the key itself; it is verified server side.
          </>
        }
      />

      <Section id="portal" title="What /portal shows">
        <Facts items={PORTAL_FACTS} />
        <Callout variant="info" title="Read-only by design">
          The portal reports usage. It cannot call models or spend tokens.
        </Callout>
      </Section>

      <Section id="manage" title="Manage your keys">
        <P>
          Key management is self-serve at{" "}
          <Link href="/portal/keys" className="ulink">
            /portal/keys
          </Link>
          : generate additional keys and revoke ones you no longer need. See{" "}
          <Link href="/docs/authentication" className="ulink">
            Authentication
          </Link>{" "}
          for the key format and the shown-once rule.
        </P>
        <Facts items={MANAGE_FACTS} />
      </Section>

      <Section id="metering" title="How metering works">
        <P>
          Usage is recorded per key id, the first 8 hex characters of the key
          fingerprint, with the model, token counts, and latency for each
          request. Requests are attributed to the key that made them, including
          failures, so the success rate you see reflects what your integration
          actually received.
        </P>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/portal" className="btn btn-primary">
            Open the usage portal
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link href="/docs/quickstart" className="btn btn-ghost">
            Back to the Quickstart
          </Link>
        </div>
      </Section>
    </>
  );
}

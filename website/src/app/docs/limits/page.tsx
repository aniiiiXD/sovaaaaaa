import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { P, Section } from "../page-head";
import DocsTable from "../docs-table";

export const metadata: Metadata = {
  title: "Limits",
  description:
    "Every limit the Sova inference API enforces, in one table: model, messages, tokens, sampling, body size, timeout, and concurrency.",
};

const LIMITS: [string, string][] = [
  ["Model", "qwen3-4b, the only accepted value"],
  ["Messages", "1 to 64 per request"],
  ["Message text", "Up to 16,000 UTF-8 bytes total, across all messages"],
  ["max_tokens", "Integer, 1 to 4096. Default 1024"],
  ["temperature", "0 to 2"],
  ["top_p", "0 to 1"],
  ["stop", "1 to 4 strings, each 1 to 256 characters"],
  ["seed", "Any safe integer"],
  ["n", "Must be 1"],
  ["stream", "Boolean, default false"],
  ["Request body", "Up to 128 KiB (131,072 bytes)"],
  ["Content-Type", "application/json"],
  ["Request timeout", "240 seconds, then 504"],
  ["Concurrency", "4 active requests per serving instance (admission control, not a published per-key quota)"],
  ["Response headers", "X-Request-Id on every response; Cache-Control: no-store"],
];

export default function LimitsPage() {
  return (
    <>
      <PageHead
        eyebrow="Resources"
        title="Limits"
        lead="All values below are enforced by the API. No others apply."
      />

      <Section id="numbers" title="The numbers">
        <DocsTable head={["Limit", "Value"]} rows={LIMITS} minWidth="560px" />
        <p className="mono mt-6 max-w-2xl text-xs leading-relaxed text-[var(--faint)]">
          Concurrency is per serving instance, enforced by admission control.
          Sova does not publish per-key rate limits, quotas, pricing, or SLAs in
          these docs.
        </p>
        <P>
          Streaming support differs by lane: the managed lane streams, the
          sovereign GPU lane is non-streaming at launch. See{" "}
          <Link href="/docs/streaming" className="ulink">
            Streaming
          </Link>
          .
        </P>
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING_URL } from "@/lib/site";
import PageHead, { C, P, Section } from "./page-head";
import CodeBlock from "./code-block";

export const metadata: Metadata = {
  title: "Introduction",
  description:
    "The Sova inference API: an OpenAI-compatible chat completions endpoint serving the Sova model catalog (sova-finance, sova-code, sova-reason, qwen3-4b) over HTTPS, metered per key, with server-side limits and streaming on the managed lane.",
};

const BASE_URL = "https://sova-native.vercel.app/api/v1";

// String.raw keeps the shell line continuations literal.
const CURL_QUICKSTART = String.raw`curl https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-4b",
    "messages": [
      { "role": "user", "content": "Why does a card payment take two days to settle?" }
    ],
    "max_tokens": 256
  }'`;

// [group, title, href, one-liner]
const CARDS: [string, string, string, string][] = [
  ["Getting started", "Quickstart", "/docs/quickstart", "From key to first response in three steps."],
  ["API reference", "Authentication", "/docs/authentication", "The sk-sova- key format, bearer headers, and safe key ids."],
  ["API reference", "Chat Completions", "/docs/api-reference/chat-completions", "POST /chat/completions: every field, limit, and the response shape."],
  ["API reference", "Models", "/docs/api-reference/models", "GET /models: confirm your key works before sending traffic."],
  ["API reference", "Streaming", "/docs/streaming", "Server-sent events, chunk by chunk, with usage totals."],
  ["Resources", "Errors", "/docs/errors", "One envelope, nine statuses, and when to retry."],
  ["Resources", "Limits", "/docs/limits", "Every number the API enforces, in one table."],
  ["Resources", "Usage & Portal", "/docs/usage", "Per-key metering and your numbers at /portal."],
  ["Resources", "Models", "/models", "The Sova model catalog: four ids, one OpenAI-compatible endpoint."],
];

const BASE_FACTS: [string, string][] = [
  ["Base URL", BASE_URL],
  ["Auth header", "Authorization: Bearer sk-sova-..."],
  ["Content-Type", "application/json"],
];

export default function DocsPage() {
  return (
    <>
      <PageHead
        eyebrow="Sova inference API · v1"
        title={
          <>
            One endpoint, <span className="text-[var(--signal)]">OpenAI-shaped.</span>
          </>
        }
        lead={
          <>
            The Sova inference API is an OpenAI-compatible chat completions
            endpoint serving the model catalog: <C>sova-finance</C>,{" "}
            <C>sova-code</C>, <C>sova-reason</C>, and the raw <C>qwen3-4b</C>{" "}
            base model. Every request is metered per key, every response
            carries a request id, and every limit in these docs is enforced
            server side.
          </>
        }
      />

      <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
        {BASE_FACTS.map(([caption, value]) => (
          <div key={caption} className="bg-[var(--paper-2)] p-5">
            <p className="mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
              {caption}
            </p>
            <p className="mono mt-2 break-all text-sm text-[var(--ink)]">{value}</p>
          </div>
        ))}
      </div>

      <Section id="quickstart" title="Sixty seconds to a first response">
        <P>
          Get a key from Sova, export it, and send one request. Store the key in
          an environment variable, never in code.
        </P>
        <CodeBlock lang="bash" label="set your key" code={`export SOVA_API_KEY="sk-sova-..."`} />
        <CodeBlock lang="bash" label="first request" code={CURL_QUICKSTART} />
        <P>
          A 200 response is OpenAI <C>chat.completion</C> JSON: the answer is{" "}
          <C>choices[0].message.content</C>, and <C>usage</C> carries the token
          counts. The full walkthrough is in the{" "}
          <Link href="/docs/quickstart" className="ulink">
            Quickstart
          </Link>
          .
        </P>
      </Section>

      <Section id="reference" title="Where to go next">
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
          {CARDS.map(([group, title, href, blurb]) => (
            <Link
              key={href}
              href={href}
              className="group bg-[var(--paper-2)] p-6 transition-colors hover:bg-[var(--paper-3)]"
            >
              <p className="mono text-[0.62rem] uppercase tracking-[0.18em] text-[var(--faint)]">
                {group}
              </p>
              <p className="mt-2 font-display text-lg text-[var(--ink)]">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{blurb}</p>
            </Link>
          ))}
        </div>
      </Section>

      <section className="mt-16">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--paper-2)] px-6 py-12 text-center sm:px-8">
          <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
          <div className="relative">
            <h2 className="display mx-auto max-w-xl text-[clamp(1.8rem,4vw,2.5rem)]">
              Need a key? That is a conversation, not a form.
            </h2>
            <p className="lead mx-auto mt-4 max-w-lg">
              Book a 30-minute call. Tell us the workload, and we mint a key
              sized for it.
            </p>
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
              <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-primary">
                Book a call
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <Link href="/portal" className="btn btn-ghost">
                View your usage
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { BOOKING_URL } from "@/lib/site";
import { MODEL_CATALOG } from "@/lib/model-catalog";
import CodeBlock from "./code-block";

// The public model catalog. The data lives in src/lib/model-catalog.ts, the
// same source the inference API validates against, so the page can never
// drift from what the endpoint actually accepts.
export const metadata: Metadata = {
  title: "Models | SOVA",
  description:
    "The Sova model catalog: sova-finance, sova-code, sova-reason, and qwen3-4b. Task-specialized models on the sovereign GPU lane, behind one OpenAI-compatible endpoint.",
};

const ENDPOINT = "https://sova-native.vercel.app/api/v1/chat/completions";

// One worked example prompt per catalog entry, keyed by model id.
const SAMPLE_PROMPTS: Record<string, string> = {
  "sova-finance": "Why does a card payment take two days to settle?",
  "sova-code": "What edge cases should a retry with exponential backoff handle?",
  "sova-reason": "A portfolio returns 8 percent, then loses 8 percent. What is the net return?",
  "qwen3-4b": "Draft a two-line follow-up for a late invoice.",
};

// String.raw keeps the shell line continuations literal.
function curlFor(model: string): string {
  const prompt = SAMPLE_PROMPTS[model] ?? "Introduce yourself in one sentence.";
  return String.raw`curl ${ENDPOINT} \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "${model}",
    "messages": [
      { "role": "user", "content": "${prompt}" }
    ],
    "max_tokens": 256
  }'`;
}

export default function ModelsPage() {
  return (
    <main id="top">
      <Nav />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
        <div className="container-x relative pt-28 pb-16 sm:pt-32">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
            Sova inference API · model catalog
          </p>
          <h1 className="display mt-6 max-w-[20ch] text-[clamp(2.6rem,6.5vw,4.6rem)]">
            The catalog.
          </h1>
          <p className="lead mt-5 max-w-2xl">
            Task-specialized models on Sova&apos;s sovereign GPU, one
            OpenAI-compatible endpoint.
          </p>
          <p className="mono mt-6 text-sm text-[var(--faint)]">
            POST /api/v1/chat/completions · OpenAI-compatible · metered per key
          </p>
        </div>
      </section>

      {/* ======================== CATALOG CARDS ======================== */}
      <section className="container-x pb-20">
        <div className="grid gap-5 lg:grid-cols-2">
          {MODEL_CATALOG.map((entry) => (
            <article
              key={entry.id}
              className="flex h-full flex-col rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="mono text-[0.95rem] text-[var(--ink)]">{entry.id}</p>
                <span className="tag">
                  {entry.systemPrompt ? "specialist preset" : "base model"}
                </span>
              </div>
              <h2 className="font-display mt-4 text-2xl font-semibold text-[var(--ink)]">
                {entry.label}
              </h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--muted)]">
                {entry.blurb}
              </p>
              <p className="mono mt-4 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                {entry.base} · {entry.lane} GPU lane
              </p>
              <div aria-hidden className="flex-1" />
              <CodeBlock lang="bash" label={`curl · ${entry.id}`} code={curlFor(entry.id)} />
            </article>
          ))}
        </div>
      </section>

      {/* ========================== ON DEMAND ========================== */}
      <section id="on-demand" className="border-t border-[var(--line)]">
        <div className="container-x section">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
            Beyond the catalog
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">On demand.</h2>
          <p className="lead mt-5 max-w-2xl">
            Bigger weights, same endpoint. The trillion-parameter class runs on
            the managed lane for committed workloads.
          </p>
          <div className="mt-10 flex flex-col gap-6 rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[0.98rem] leading-relaxed text-[var(--ink)]">
                Trillion-parameter class (GLM-4.x, Kimi K2) available on the
                managed lane for committed workloads.
              </p>
              <p className="mono mt-2 text-xs leading-relaxed text-[var(--faint)]">
                None of them are listed in the catalog until the lane can
                actually serve them.
              </p>
            </div>
            <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost flex-none">
              Book a call
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ========================== NOTE STRIP ========================== */}
      <div className="border-y border-[var(--line)] bg-[var(--paper-2)]">
        <div className="container-x flex flex-col gap-3 py-5 sm:flex-row sm:gap-10">
          <p className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]">
            <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[var(--signal)]" aria-hidden />
            <span>
              Every model is metered per key. Totals and per-model stats are at{" "}
              <Link href="/portal" className="ulink">
                /portal
              </Link>
              .
            </span>
          </p>
          <p className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]">
            <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-[var(--pine)]" aria-hidden />
            <span>
              The specialists are presets on the same base model, not separate
              weights: same qwen3-4b, curated behavior. Pick the id that matches
              the task; the preset ships with it.
            </span>
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}

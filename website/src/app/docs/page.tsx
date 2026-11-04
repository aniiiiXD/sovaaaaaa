import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { BOOKING_URL } from "@/lib/site";
import CopyButton from "./copy-button";

export const metadata: Metadata = {
  title: "Sova · API documentation",
  description:
    "The Sova inference API: an OpenAI-shaped chat completions endpoint for fin-o1-14b, with per-key usage metering, streaming on the managed lane, and limits enforced server side.",
};

const BASE_URL = "https://sova-native.vercel.app/api/v1";

/* ------------------------------ code samples ------------------------------ */

// String.raw keeps the shell line continuations literal.
const CURL_BASIC = String.raw`curl https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fin-o1-14b",
    "messages": [
      { "role": "system", "content": "Answer in one sentence." },
      { "role": "user", "content": "Why does a card payment take two days to settle?" }
    ],
    "max_tokens": 256
  }'`;

const BASIC_RESPONSE = `{
  "id": "cmpl-9f31a2c4",
  "object": "chat.completion",
  "created": 1793868200,
  "model": "fin-o1-14b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Card settlements run in batches: the networks net the day's transactions and release funds to acquirers on a fixed schedule, usually one to two business days."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 37, "completion_tokens": 48, "total_tokens": 85 }
}`;

const CURL_STREAM = String.raw`curl -N https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "fin-o1-14b",
    "messages": [
      { "role": "user", "content": "Draft a two-line follow-up for a late invoice." }
    ],
    "stream": true,
    "stream_options": { "include_usage": true },
    "max_tokens": 128
  }'`;

const SSE_SAMPLE = `data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","created":1793868200,"model":"fin-o1-14b","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Payment is"},"finish_reason":null}]}

data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":21,"completion_tokens":18,"total_tokens":39}}

data: [DONE]`;

const PYTHON_SDK = `import os
from openai import OpenAI

client = OpenAI(
    base_url="https://sova-native.vercel.app/api/v1",
    api_key=os.environ["SOVA_API_KEY"],
)

reply = client.chat.completions.create(
    model="fin-o1-14b",
    messages=[
        {"role": "system", "content": "Answer in one sentence."},
        {"role": "user", "content": "What does chargeback representment mean?"},
    ],
    max_tokens=256,
)
print(reply.choices[0].message.content)
print(reply.usage.prompt_tokens, reply.usage.completion_tokens)

# Streaming works on the managed lane:
stream = client.chat.completions.create(
    model="fin-o1-14b",
    messages=[{"role": "user", "content": "Draft a two-line payment follow-up."}],
    stream=True,
    stream_options={"include_usage": True},
    max_tokens=128,
)
for event in stream:
    if event.choices and event.choices[0].delta.content:
        print(event.choices[0].delta.content, end="")`;

const MODELS_CURL = String.raw`curl https://sova-native.vercel.app/api/v1/models \
  -H "Authorization: Bearer $SOVA_API_KEY"`;

const MODELS_RESPONSE = `{
  "object": "list",
  "data": [
    { "id": "fin-o1-14b", "object": "model", "created": 0, "owned_by": "sova" }
  ]
}`;

const ERROR_401 = `{
  "error": {
    "message": "Invalid API key.",
    "type": "authentication_error"
  }
}`;

/* ------------------------------ table data ------------------------------ */

const REQUEST_FIELDS: [string, string, string][] = [
  ["model", "string", `Must be "fin-o1-14b". Any other value is rejected with 400.`],
  [
    "messages",
    "array",
    "1 to 64 messages. Each message is an object with exactly two fields, role and content. Roles: system, user, assistant. Content must be a string; image or tool parts are not supported. Total text across all messages is capped at 16,000 UTF-8 bytes.",
  ],
  ["max_tokens", "integer", "1 to 4096. Default 1024."],
  ["temperature", "number", "0 to 2. Optional."],
  ["top_p", "number", "0 to 1. Optional."],
  ["stop", "string or array", "A single string, or 1 to 4 strings. Each 1 to 256 characters. Optional."],
  ["seed", "integer", "Any safe integer (within plus or minus 2 to the 53rd, minus 1). Optional."],
  ["n", "integer", "Must be 1 when present. Optional."],
  ["stream", "boolean", "Default false. See Streaming."],
  ["stream_options", "object", "Only accepted together with stream=true. Only include_usage (boolean) is supported."],
];

const ERROR_ROWS: [string, string, string][] = [
  ["400", "api_error", "The request failed validation: an unsupported field, a bad message shape, or a limit exceeded. The serving backend can also return 400 when it rejects a request that passed local validation."],
  ["401", "authentication_error", "The Authorization header is missing, malformed, or does not match an issued key."],
  ["413", "api_error", "The request body exceeds 128 KiB."],
  ["415", "api_error", "Content-Type is not application/json."],
  ["422", "api_error", "The serving backend rejected the request. Check message length and token limits."],
  ["429", "api_error", "Too many active requests. Admission control allows 4 concurrent inference requests per serving instance. This is per-instance admission control, not a published per-key rate limit."],
  ["502", "api_error", "The inference provider request failed or returned an invalid response."],
  ["503", "api_error", "Inference is not enabled, or the model is starting or unavailable. Retry shortly."],
  ["504", "api_error", "The request exceeded the 240 second limit and was aborted."],
];

const LIMITS: [string, string][] = [
  ["Model", "fin-o1-14b, the only accepted value"],
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

const AUTH_FACTS = [
  "Shown once. The full key is displayed a single time, at issue. Store it in your secret manager immediately.",
  "Fingerprint only. Sova stores a SHA-256 fingerprint of the key, never the plaintext. A lost key cannot be recovered, only replaced.",
  "Safe label. The key id Sova uses in support conversations is the first 8 hex characters of that fingerprint. Sharing it leaks nothing.",
  "Portal. Sign in at /portal with the key itself to see your usage. The portal is read-only: it reports usage and cannot call models.",
];

const RESPONSE_FACTS = [
  "X-Request-Id on every response, errors included. A UUID you can quote back to Sova when something looks wrong.",
  "Cache-Control: no-store on every response. Nothing is cached between calls.",
  "Provider diagnostics are never forwarded. Error messages describe what to fix, and never echo prompt text.",
];

const USAGE_FACTS = [
  "Total requests, all time.",
  "Tokens in and tokens out, all time.",
  "Last used, in UTC.",
  "A daily traffic chart for the last 14 days, requests and tokens.",
];

const SECTION_LINKS = [
  ["Authentication", "#authentication"],
  ["Chat completions", "#chat-completions"],
  ["Streaming", "#streaming"],
  ["Models", "#models"],
  ["Responses", "#responses"],
  ["Errors", "#errors"],
  ["Usage", "#usage"],
  ["Examples", "#examples"],
  ["Limits", "#limits"],
] as const;

/* ------------------------------ helpers ------------------------------ */

function C({ children }: { children: string }) {
  return <code className="mono text-[0.86em] text-[var(--ink)]">{children}</code>;
}

function Facts({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 max-w-2xl space-y-3">
      {items.map((fact, i) => (
        <li
          key={fact}
          className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]"
        >
          <span
            className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
            style={{ background: i === 0 ? "var(--signal)" : "var(--pine)" }}
            aria-hidden
          />
          {fact}
        </li>
      ))}
    </ul>
  );
}

function CodeBlock({ label, code, caption }: { label: string; code: string; caption?: string }) {
  return (
    <figure className="mt-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-3)]">
      <figcaption className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-3">
        <span className="mono min-w-0 truncate text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
          {label}
        </span>
        <CopyButton value={code} label={label} />
      </figcaption>
      <pre className="overflow-x-auto p-5">
        <code className="mono text-[0.84rem] leading-relaxed text-[var(--ink)]">{code}</code>
      </pre>
      {caption && (
        <p className="border-t border-[var(--line)] px-5 py-3 text-sm leading-relaxed text-[var(--muted)]">
          {caption}
        </p>
      )}
    </figure>
  );
}

function DocsTable({ head, rows }: { head: [string, string, string]; rows: [string, string, string][] }) {
  return (
    <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--line)]">
      <table className="w-full min-w-[680px] border-collapse bg-[var(--paper-2)] text-left">
        <thead>
          <tr className="mono text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
            {head.map((h) => (
              <th key={h} className="p-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, kind, rules]) => (
            <tr key={name} className="border-t border-[var(--line)]">
              <td className="p-4 align-top">
                <code className="mono text-[0.86rem] text-[var(--ink)]">{name}</code>
              </td>
              <td className="mono p-4 align-top text-[0.84rem] text-[var(--muted)]">{kind}</td>
              <td className="p-4 align-top text-sm leading-relaxed text-[var(--muted)]">{rules}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default function DocsPage() {
  return (
    <main id="top">
      <Nav />

      {/* hero */}
      <section className="relative overflow-hidden pt-32 pb-16 lg:pt-36">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="container-x relative max-w-3xl">
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden />
            Sova inference API · v1
          </p>
          <h1 className="display mt-6 text-[clamp(2.4rem,5vw,3.8rem)]">
            One endpoint, <span className="text-[var(--signal)]">OpenAI-shaped.</span>
          </h1>
          <p className="lead mt-7">
            Send OpenAI chat completions to <C>fin-o1-14b</C> over HTTPS. Every
            request is metered per key, every response carries a request id, and
            every limit on this page is enforced server side.
          </p>

          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
            <div className="bg-[var(--paper-2)] p-6">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                Base URL
              </p>
              <p className="mono mt-2 break-all text-sm text-[var(--ink)]">{BASE_URL}</p>
            </div>
            <div className="bg-[var(--paper-2)] p-6">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                Auth header
              </p>
              <p className="mono mt-2 break-all text-sm text-[var(--ink)]">
                Authorization: Bearer sk-sova-...
              </p>
            </div>
            <div className="bg-[var(--paper-2)] p-6">
              <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                Content-Type
              </p>
              <p className="mono mt-2 text-sm text-[var(--ink)]">application/json</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-primary">
              Book a call to get a key
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <Link href="/portal" className="btn btn-ghost">
              View your usage
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--line)] pt-5">
            {SECTION_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="mono text-[0.8rem] text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* authentication */}
      <section id="authentication" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Authentication
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            A key from Sova, sent as a bearer token.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Keys are issued by Sova. Book a call and we mint one for your
            workload. Every request carries the key in the Authorization header:
          </p>

          <CodeBlock label="Authorization header" code={`Authorization: Bearer sk-sova-<48 lowercase hex characters>`} />

          <Facts items={AUTH_FACTS} />

          <p className="mt-8 max-w-2xl text-[0.95rem] leading-relaxed text-[var(--muted)]">
            A request without a valid key gets a 401. The response body is the
            standard error envelope:
          </p>
          <CodeBlock label="401 response body" code={ERROR_401} />
        </div>
      </section>

      {/* chat completions */}
      <section id="chat-completions" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Endpoints
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            POST /chat/completions
          </h2>
          <p className="lead mt-5 max-w-2xl">
            An OpenAI-shaped chat completions endpoint. Send{" "}
            <C>application/json</C> with a body of at most 128 KiB. The field
            list below is the complete set: any other field, including vendor
            extensions, is rejected with 400 rather than ignored.
          </p>

          <DocsTable head={["Field", "Type", "Rules"]} rows={REQUEST_FIELDS} />

          <p className="mt-6 max-w-2xl text-[0.95rem] leading-relaxed text-[var(--muted)]">
            Message rules are strict: 1 to 64 messages, string content only, and
            16,000 UTF-8 bytes of total text across the conversation. The
            serving lane is chosen by Sova per deployment; you do not select it
            in the request.
          </p>

          <CodeBlock
            label="curl · chat completions"
            code={CURL_BASIC}
            caption="A minimal two-message request with a system instruction and a 256 token cap."
          />
          <CodeBlock
            label="200 response body · representative"
            code={BASIC_RESPONSE}
            caption="Responses follow the OpenAI chat.completion schema. The exact id, created, and model values come from the serving backend."
          />
        </div>
      </section>

      {/* streaming */}
      <section id="streaming" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Streaming
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            Server-sent events, per token.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Set <C>stream: true</C> to receive the answer as server-sent events
            instead of one JSON body. Chunks follow the OpenAI{" "}
            <C>chat.completion.chunk</C> schema, and the stream ends with{" "}
            <C>data: [DONE]</C>.
          </p>

          <Facts
            items={[
              "stream_options is only accepted together with stream=true, and only include_usage (boolean) is supported. It adds a final chunk with an empty choices array carrying the usage totals.",
              "Streaming runs on the managed lane. The sovereign GPU lane is non-streaming at launch: it rejects stream=true with 400. Non-streaming requests work on both lanes.",
              "Streaming responses set Content-Type: text/event-stream; charset=utf-8 and X-Accel-Buffering: no, so proxies do not buffer the stream.",
            ]}
          />

          <CodeBlock
            label="curl · streaming with include_usage"
            code={CURL_STREAM}
            caption="The -N flag disables curl output buffering so chunks print as they arrive."
          />
          <CodeBlock
            label="SSE stream · abridged"
            code={SSE_SAMPLE}
            caption="First chunk, a content chunk, the usage chunk emitted by include_usage, and the terminator."
          />
        </div>
      </section>

      {/* models */}
      <section id="models" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Endpoints
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            GET /models
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Lists the models currently served. Requires the same bearer token.
            Use it to confirm your key works and to see what your deployment
            serves before sending traffic.
          </p>

          <CodeBlock
            label="curl · list models"
            code={MODELS_CURL}
          />
          <CodeBlock
            label="200 response body · managed lane"
            code={MODELS_RESPONSE}
            caption="On the sovereign GPU lane the list is proxied from the serving backend, so it reflects exactly what that server reports."
          />
        </div>
      </section>

      {/* responses */}
      <section id="responses" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Responses
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            OpenAI shapes, plus a request id.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            A 200 from <C>/chat/completions</C> is OpenAI chat.completion JSON:
            a <C>choices</C> array and a <C>usage</C> block with{" "}
            <C>prompt_tokens</C> and <C>completion_tokens</C>. A 200 from{" "}
            <C>/models</C> is an OpenAI model list.
          </p>

          <Facts items={RESPONSE_FACTS} />
        </div>
      </section>

      {/* errors */}
      <section id="errors" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Errors
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            One envelope, nine statuses.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Every error uses the same envelope: an <C>error</C> object with{" "}
            <C>message</C> and <C>type</C>. The type is{" "}
            <C>authentication_error</C> for 401 and <C>api_error</C> for
            everything else.
          </p>

          <DocsTable head={["Status", "Type", "When"]} rows={ERROR_ROWS} />

          <p className="mt-6 max-w-2xl text-[0.95rem] leading-relaxed text-[var(--muted)]">
            On 429, back off and retry: the active request count drops as
            in-flight calls finish. On 503 and 504, retry shortly with the same
            body.
          </p>
        </div>
      </section>

      {/* usage */}
      <section id="usage" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden /> Usage
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            Metered per key. Visible to you.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Every request is metered against the API key that made it. The
            customer portal at <C>/portal</C> shows your numbers. Sign in by
            pasting the key itself; it is verified server side.
          </p>

          <Facts items={USAGE_FACTS} />

          <p className="mt-8 max-w-2xl text-[0.95rem] leading-relaxed text-[var(--muted)]">
            The portal is read-only by design: it reports usage and cannot call
            models or spend tokens.
          </p>

          <Link href="/portal" className="btn btn-ghost mt-8">
            Open the usage portal
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* examples */}
      <section id="examples" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Examples
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            Copy, paste, first token.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            Three ways to call the API. The Python example uses the official{" "}
            <C>openai</C> SDK pointed at the Sova base URL; no other client
            changes are needed.
          </p>

          <CodeBlock
            label="curl · non-streaming chat completion"
            code={CURL_BASIC}
            caption="Store the key in an environment variable, as shown by $SOVA_API_KEY. Never commit it."
          />
          <CodeBlock
            label="curl · streaming with usage"
            code={CURL_STREAM}
          />
          <CodeBlock
            label="Python · openai SDK"
            code={PYTHON_SDK}
            caption="pip install openai. The SDK only needs base_url and api_key; the rest is the standard chat completions call."
          />
        </div>
      </section>

      {/* limits */}
      <section id="limits" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Limits
          </p>
          <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
            The numbers, in one table.
          </h2>
          <p className="lead mt-5 max-w-2xl">
            All values below are enforced by the API. No others apply.
          </p>

          <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--line)]">
            <table className="w-full min-w-[560px] border-collapse bg-[var(--paper-2)] text-left">
              <thead>
                <tr className="mono text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
                  <th className="p-4 font-medium">Limit</th>
                  <th className="p-4 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {LIMITS.map(([name, value]) => (
                  <tr key={name} className="border-t border-[var(--line)]">
                    <td className="p-4 align-top">
                      <code className="mono text-[0.86rem] text-[var(--ink)]">{name}</code>
                    </td>
                    <td className="p-4 align-top text-sm leading-relaxed text-[var(--muted)]">
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mono mt-4 max-w-2xl text-xs leading-relaxed text-[var(--faint)]">
            Concurrency is per serving instance, enforced by admission control.
            Sova does not publish per-key rate limits, quotas, pricing, or SLAs
            on this page.
          </p>
        </div>
      </section>

      {/* cta */}
      <section className="section border-t border-[var(--line)]">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--line)] bg-[var(--paper-2)] px-6 py-14 text-center sm:px-8">
            <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
            <div className="relative">
              <h2 className="display mx-auto max-w-2xl text-[clamp(1.9rem,4vw,2.8rem)]">
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
        </div>
      </section>

      <Footer />
    </main>
  );
}

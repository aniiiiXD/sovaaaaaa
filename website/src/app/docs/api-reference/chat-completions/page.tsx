import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { C, P, Section } from "../../page-head";
import CodeBlock from "../../code-block";
import DocsTable from "../../docs-table";
import Callout from "../../callout";

export const metadata: Metadata = {
  title: "Chat Completions",
  description:
    "POST /chat/completions: the complete request field set for the Sova model catalog, the 128 KiB body limit, curl and Python examples, and the 200 response shape.",
};

// String.raw keeps the shell line continuations literal.
const CURL_BASIC = String.raw`curl https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-4b",
    "messages": [
      { "role": "system", "content": "Answer in one sentence." },
      { "role": "user", "content": "What does chargeback representment mean?" }
    ],
    "max_tokens": 256
  }'`;

const BASIC_RESPONSE = `{
  "id": "cmpl-9f31a2c4",
  "object": "chat.completion",
  "created": 1793868200,
  "model": "qwen3-4b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "A chargeback representment is the merchant's evidence-based response to a disputed charge, submitted to the issuing bank to reverse the chargeback."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 33, "completion_tokens": 41, "total_tokens": 74 }
}`;

const PYTHON_SDK = `import os
from openai import OpenAI

client = OpenAI(
    base_url="https://sova-native.vercel.app/api/v1",
    api_key=os.environ["SOVA_API_KEY"],
)

reply = client.chat.completions.create(
    model="qwen3-4b",
    messages=[
        {"role": "system", "content": "Answer in one sentence."},
        {"role": "user", "content": "What does chargeback representment mean?"},
    ],
    max_tokens=256,
)
print(reply.choices[0].message.content)
print(reply.usage.prompt_tokens, reply.usage.completion_tokens)`;

const REQUEST_FIELDS: [string, string, string][] = [
  [
    "model",
    "string",
    `One of sova-finance, sova-code, sova-reason, qwen3-4b. Any other value is rejected with 400 and the message "model must be one of: sova-finance, sova-code, sova-reason, qwen3-4b."`,
  ],
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

export default function ChatCompletionsPage() {
  return (
    <>
      <PageHead
        eyebrow="API reference · endpoint"
        title="Chat Completions"
        lead={
          <>
            An OpenAI-shaped chat completions endpoint. Send{" "}
            <C>application/json</C> with a body of at most 128 KiB. The field
            list below is the complete set: any other field, including vendor
            extensions, is rejected with 400 rather than ignored.
          </>
        }
      />

      <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-2)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
          <span className="mono rounded-md bg-[var(--signal)] px-2 py-1 text-[0.72rem] font-medium tracking-[0.08em] text-[#0a0a0c]">
            POST
          </span>
          <code className="mono text-sm text-[var(--ink)]">/chat/completions</code>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--line)] px-5 py-3">
          <span className="mono text-xs text-[var(--muted)]">Content-Type: application/json</span>
          <span className="mono text-xs text-[var(--muted)]">Body limit: 128 KiB</span>
          <span className="mono text-xs text-[var(--muted)]">Auth: Bearer sk-sova-...</span>
        </div>
      </div>

      <Section id="request" title="Request fields">
        <DocsTable head={["Field", "Type", "Rules"]} rows={REQUEST_FIELDS} />
        <Callout variant="info" title="Unknown fields are errors, not defaults">
          This table is the complete set of accepted fields. Anything else,
          including vendor extensions such as <C>logit_bias</C> or{" "}
          <C>tools</C>, returns 400 with the message &quot;Unsupported request
          field.&quot;
        </Callout>
        <Callout variant="info" title="Specialists are server-side presets">
          The specialist ids (<C>sova-finance</C>, <C>sova-code</C>,{" "}
          <C>sova-reason</C>) prepend a curated system prompt on the server,
          ahead of any system message you send. It cannot be removed or
          weakened, and it does not count against the 16,000-byte message
          budget. Responses echo the catalog id you requested. The full catalog
          is at{" "}
          <Link href="/models" className="ulink">
            /models
          </Link>
          .
        </Callout>
        <P>
          Message rules are strict: 1 to 64 messages, string content only, and
          16,000 UTF-8 bytes of total text across the conversation. The serving
          lane is chosen by Sova per deployment; you do not select it in the
          request.
        </P>
      </Section>

      <Section id="examples" title="Examples">
        <CodeBlock
          lang="bash"
          label="curl · chat completions"
          code={CURL_BASIC}
          caption="Store the key in an environment variable, as shown by $SOVA_API_KEY. Never commit it."
        />
        <CodeBlock
          lang="python"
          label="Python · openai SDK"
          code={PYTHON_SDK}
          caption="pip install openai. The SDK only needs base_url and api_key; the rest is the standard chat completions call."
        />
      </Section>

      <Section id="response" title="Response">
        <P>
          A 200 is OpenAI <C>chat.completion</C> JSON: a <C>choices</C> array
          and a <C>usage</C> block with <C>prompt_tokens</C> and{" "}
          <C>completion_tokens</C>. To receive server-sent events instead, set{" "}
          <C>stream: true</C>; see{" "}
          <Link href="/docs/streaming" className="ulink">
            Streaming
          </Link>
          .
        </P>
        <CodeBlock
          lang="json"
          label="200 response body · representative"
          code={BASIC_RESPONSE}
          caption="The id and created values come from the serving backend; model echoes the catalog id you requested."
        />
        <P>
          Headers on every response: <C>X-Request-Id</C>, a UUID you can quote
          back to Sova when something looks wrong, and <C>Cache-Control: no-store</C>{" "}
          so nothing is cached between calls. Error messages describe what to
          fix and never echo prompt text; provider diagnostics are not
          forwarded.
        </P>
      </Section>
    </>
  );
}

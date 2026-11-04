import type { Metadata } from "next";
import Link from "next/link";
import PageHead, { C, P, Section } from "../../page-head";
import CodeBlock from "../../code-block";
import Callout from "../../callout";

export const metadata: Metadata = {
  title: "Models",
  description:
    "GET /models lists the models your Sova deployment serves. Requires the same bearer token as chat completions.",
};

// String.raw keeps the shell line continuations literal.
const MODELS_CURL = String.raw`curl https://sova-native.vercel.app/api/v1/models \
  -H "Authorization: Bearer $SOVA_API_KEY"`;

const MODELS_RESPONSE = `{
  "object": "list",
  "data": [
    { "id": "qwen3-4b", "object": "model", "created": 0, "owned_by": "sova" }
  ]
}`;

export default function ModelsPage() {
  return (
    <>
      <PageHead
        eyebrow="API reference · endpoint"
        title="Models"
        lead={
          <>
            Lists the models currently served. Requires the same bearer token as{" "}
            <C>/chat/completions</C>. Use it to confirm your key works and to
            see what your deployment serves before sending traffic.
          </>
        }
      />

      <div className="mt-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-2)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5">
          <span className="mono rounded-md border border-[var(--line-3)] px-2 py-1 text-[0.72rem] font-medium tracking-[0.08em] text-[var(--ink)]">
            GET
          </span>
          <code className="mono text-sm text-[var(--ink)]">/models</code>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--line)] px-5 py-3">
          <span className="mono text-xs text-[var(--muted)]">Auth: Bearer sk-sova-...</span>
          <span className="mono text-xs text-[var(--muted)]">Body: none</span>
        </div>
      </div>

      <Section id="example" title="Example">
        <CodeBlock lang="bash" label="curl · list models" code={MODELS_CURL} />
        <CodeBlock
          lang="json"
          label="200 response body · managed lane"
          code={MODELS_RESPONSE}
          caption="On the sovereign GPU lane the list is proxied from the serving backend, so it reflects exactly what that server reports."
        />
        <P>
          A 200 is an OpenAI model list: an <C>object: &quot;list&quot;</C>{" "}
          envelope with one entry per served model. An unauthenticated call
          returns 401; see{" "}
          <Link href="/docs/authentication" className="ulink">
            Authentication
          </Link>
          .
        </P>
        <Callout variant="info" title="The list is discovery, not routing">
          Chat requests name the model explicitly, and <C>qwen3-4b</C> is the
          only accepted value today. See{" "}
          <Link href="/docs/api-reference/chat-completions" className="ulink">
            Chat Completions
          </Link>
          .
        </Callout>
      </Section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING_URL } from "@/lib/site";
import PageHead, { C, P, Section } from "../page-head";
import CodeBlock from "../code-block";
import Callout from "../callout";

export const metadata: Metadata = {
  title: "Quickstart",
  description:
    "Get a Sova API key, send your first chat completion to qwen3-4b, read the response, and watch your usage at /portal.",
};

// String.raw keeps the shell line continuations literal.
const CURL_FIRST = String.raw`curl https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-4b",
    "messages": [
      { "role": "system", "content": "Answer in one sentence." },
      { "role": "user", "content": "Why does a card payment take two days to settle?" }
    ],
    "max_tokens": 256
  }'`;

const FIRST_RESPONSE = `{
  "id": "cmpl-9f31a2c4",
  "object": "chat.completion",
  "created": 1793868200,
  "model": "qwen3-4b",
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

export default function QuickstartPage() {
  return (
    <>
      <PageHead
        eyebrow="Getting started"
        title="Quickstart"
        lead={
          <>
            From key to first response in three steps: get a key, send one
            request to <C>/chat/completions</C>, read the answer.
          </>
        }
      />

      <ol className="mt-10 space-y-12">
        <li className="flex gap-4 sm:gap-6">
          <span className="num mt-1.5 flex-none">01</span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[1.5rem]">Get a key</h2>
            <P>
              Keys are issued by Sova. Book a call and tell us the workload; we
              mint a key sized for it. The full key is shown exactly once, at
              issue, so have a secret manager ready.
            </P>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener"
              className="btn btn-primary mt-6"
            >
              Book a call to get a key
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
            <Callout variant="info" title="The portal is for usage, not for calling models">
              Sign in at{" "}
              <Link href="/portal" className="ulink">
                /portal
              </Link>{" "}
              with the key itself to see your numbers. The portal is read-only:
              it reports usage and cannot spend tokens.
            </Callout>
          </div>
        </li>

        <li className="flex gap-4 sm:gap-6">
          <span className="num mt-1.5 flex-none">02</span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[1.5rem]">Send your first request</h2>
            <P>
              Export the key, then POST an OpenAI-shaped body to{" "}
              <C>/chat/completions</C>. The <C>model</C> must be{" "}
              <C>qwen3-4b</C>, the Content-Type must be <C>application/json</C>,
              and the body is capped at 128 KiB.
            </P>
            <CodeBlock
              lang="bash"
              label="set your key"
              code={`export SOVA_API_KEY="sk-sova-..."`}
            />
            <CodeBlock
              lang="bash"
              label="first request"
              code={CURL_FIRST}
              caption="A minimal two-message request with a system instruction and a 256 token cap."
            />
          </div>
        </li>

        <li className="flex gap-4 sm:gap-6">
          <span className="num mt-1.5 flex-none">03</span>
          <div className="min-w-0 flex-1">
            <h2 className="display text-[1.5rem]">Read the response</h2>
            <CodeBlock
              lang="json"
              label="200 response body · representative"
              code={FIRST_RESPONSE}
              caption="The exact id, created, and model values come from the serving backend."
            />
            <P>
              The answer is <C>choices[0].message.content</C>.{" "}
              <C>finish_reason: &quot;stop&quot;</C> means the model finished on
              its own; <C>usage</C> reports prompt, completion, and total tokens
              for the call. Every response also carries an{" "}
              <C>X-Request-Id</C> header you can quote back to Sova.
            </P>
          </div>
        </li>
      </ol>

      <Section id="usage" title="Watch your usage">
        <P>
          Every request is metered against the key that made it. The portal at{" "}
          <Link href="/portal" className="ulink">
            /portal
          </Link>{" "}
          shows totals (requests, tokens in and out, all time), the last used
          time in UTC, and a daily traffic chart for the last 14 days.
        </P>
        <P>
          Next:{" "}
          <Link href="/docs/authentication" className="ulink">
            how authentication works
          </Link>
          , or straight to the{" "}
          <Link href="/docs/api-reference/chat-completions" className="ulink">
            Chat Completions reference
          </Link>
          .
        </P>
      </Section>
    </>
  );
}

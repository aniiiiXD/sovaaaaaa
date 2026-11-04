import type { Metadata } from "next";
import PageHead, { C, Facts, P, Section } from "../page-head";
import CodeBlock from "../code-block";
import Callout from "../callout";

export const metadata: Metadata = {
  title: "Streaming",
  description:
    "Stream chat completions as server-sent events: the chat.completion.chunk shape, stream_options rules, and lane support at launch.",
};

// String.raw keeps the shell line continuations literal.
const CURL_STREAM = String.raw`curl -N https://sova-native.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-4b",
    "messages": [
      { "role": "user", "content": "Draft a two-line follow-up for a late invoice." }
    ],
    "stream": true,
    "stream_options": { "include_usage": true },
    "max_tokens": 128
  }'`;

const SSE_SAMPLE = `data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","created":1793868200,"model":"qwen3-4b","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Payment is"},"finish_reason":null}]}

data: {"id":"cmpl-8f31a2c4","object":"chat.completion.chunk","choices":[],"usage":{"prompt_tokens":21,"completion_tokens":18,"total_tokens":39}}

data: [DONE]`;

const STREAM_FACTS = [
  "stream_options is only accepted together with stream=true, and only include_usage (boolean) is supported. It adds a final chunk with an empty choices array carrying the usage totals.",
  "Streaming responses set Content-Type: text/event-stream; charset=utf-8 and X-Accel-Buffering: no, so proxies do not buffer the stream.",
  "The stream ends with data: [DONE]. Every response, streamed or not, carries the X-Request-Id header.",
];

export default function StreamingPage() {
  return (
    <>
      <PageHead
        eyebrow="API reference"
        title="Streaming"
        lead={
          <>
            Set <C>stream: true</C> to receive the answer as server-sent events
            instead of one JSON body. Chunks follow the OpenAI{" "}
            <C>chat.completion.chunk</C> schema.
          </>
        }
      />

      <Section id="shape" title="Shape of the stream">
        <Facts items={STREAM_FACTS} />
        <Callout variant="warning" title="The sovereign GPU lane is non-streaming at launch">
          Streaming runs on the managed lane. The sovereign GPU lane rejects{" "}
          <C>stream=true</C> with 400. Non-streaming requests work on both
          lanes.
        </Callout>
      </Section>

      <Section id="example" title="Example">
        <CodeBlock
          lang="bash"
          label="curl · streaming with include_usage"
          code={CURL_STREAM}
          caption="The -N flag disables curl output buffering so chunks print as they arrive."
        />
        <CodeBlock
          lang="text"
          label="SSE stream · abridged"
          code={SSE_SAMPLE}
          caption="First chunk, a content chunk, the usage chunk emitted by include_usage, and the terminator."
        />
        <P>
          The Python openai SDK handles the stream for you: pass{" "}
          <C>stream=True</C> and iterate the events. Reading{" "}
          <C>event.choices[0].delta.content</C> per chunk covers most clients;
          usage arrives on the final chunk when <C>include_usage</C> is set.
        </P>
      </Section>
    </>
  );
}

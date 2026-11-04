import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  type ResponseStream,
} from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

const MODEL = "qwen3-4b";

// Bedrock sends JSON payloads inside AWS EventStream events. Convert each payload
// to an OpenAI SSE event; never forward AWS exception details to API clients.
export function bedrockBody(events: AsyncIterable<ResponseStream>) {
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let completed = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (done) {
            if (!completed) throw new Error("Bedrock stream ended before completion.");
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          if (!value.chunk?.bytes) throw new Error("Invalid Bedrock event.");
          const chunk = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value.chunk.bytes));
          if (!Array.isArray(chunk.choices)) {
            if (chunk["amazon-bedrock-invocationMetrics"]) continue;
            throw new Error("Invalid Bedrock chat chunk.");
          }
          if (chunk.choices.some((choice: { finish_reason?: unknown }) => typeof choice.finish_reason === "string")) completed = true;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...chunk, model: MODEL })}\n\n`));
          return;
        }
      } catch {
        await iterator.return?.().catch(() => {});
        controller.error(new Error("Bedrock inference stream failed."));
      }
    },
    async cancel() { await iterator.return?.(); },
  });
}

// Factory keeps transport tests independent of AWS credentials and paid inference.
export function createBedrockInvoker(
  makeClient = (region: string, env: Record<string, string | undefined>) => new BedrockRuntimeClient({
    region, maxAttempts: 1,
    // Production exchanges Vercel's request token for scoped, temporary AWS
    // credentials. Local development can use the existing AWS_PROFILE instead.
    ...(env.AWS_ROLE_ARN ? { credentials: awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN, clientConfig: { region }, durationSeconds: 900,
    }) } : {}),
  }),
) {
  return async function invoke(
    body: Record<string, unknown>, signal: AbortSignal, env: Record<string, string | undefined>,
  ): Promise<Response> {
    const client = makeClient(env.AWS_REGION!, env);
    const abort = () => client.destroy();
    signal.addEventListener("abort", abort, { once: true });
    let streaming = false;
    // The ARN is chosen by the server; model routing is not a payload parameter.
    const payload = { ...body };
    delete payload.model;
    delete payload.stream;
    const input = {
      modelId: env.BEDROCK_MODEL_ARN!,
      contentType: "application/json",
      accept: "application/json",
      body: Buffer.from(JSON.stringify(payload)),
    };
    try {
      signal.throwIfAborted();
      if (body.stream) {
        const output = await client.send(new InvokeModelWithResponseStreamCommand(input), { abortSignal: signal });
        if (!output.body) throw new Error("Missing Bedrock stream.");
        const events = output.body;
        const wrapped = (async function* () {
          try { yield* events; }
          finally { signal.removeEventListener("abort", abort); client.destroy(); }
        })();
        streaming = true;
        return new Response(bedrockBody(wrapped), { headers: { "Content-Type": "text/event-stream" } });
      }
      const output = await client.send(new InvokeModelCommand(input), { abortSignal: signal });
      const result = JSON.parse(new TextDecoder().decode(output.body));
      if (!Array.isArray(result.choices)) throw new Error("Invalid Bedrock chat response.");
      return Response.json({ ...result, model: MODEL });
    } catch (cause) {
      if (signal.aborted) throw cause;
      const name = (cause as { name?: string }).name;
      const status = name === "ModelNotReadyException" || name === "ServiceUnavailableException" ? 503
        : name === "ThrottlingException" ? 429 : name === "ModelTimeoutException" ? 504
        : name === "ValidationException" ? 400 : 502;
      return new Response(null, { status });
    } finally {
      if (!streaming) { signal.removeEventListener("abort", abort); client.destroy(); }
    }
  };
}

export const invokeBedrock = createBedrockInvoker();

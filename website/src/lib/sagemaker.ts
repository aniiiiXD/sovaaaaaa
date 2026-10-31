import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
  type ResponseStream,
} from "@aws-sdk/client-sagemaker-runtime";

// PayloadPart boundaries need not align with SSE events. Preserve every byte.
export function sageMakerBody(events: AsyncIterable<ResponseStream>) {
  const iterator = events[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await iterator.next();
          if (done) { controller.close(); return; }
          if (value.ModelStreamError || value.InternalStreamFailure) {
            throw new Error("SageMaker inference stream failed.");
          }
          if (value.PayloadPart?.Bytes) { controller.enqueue(value.PayloadPart.Bytes); return; }
        }
      } catch {
        await iterator.return?.().catch(() => {});
        controller.error(new Error("SageMaker inference stream failed."));
      }
    },
    async cancel() { await iterator.return?.(); },
  });
}

export async function invokeSageMaker(
  body: Record<string, unknown>,
  signal: AbortSignal,
  env: Record<string, string | undefined>,
): Promise<Response> {
  // Use the SDK credential chain: a local AWS_PROFILE or server-only temporary
  // AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN on Vercel.
  const client = new SageMakerRuntimeClient({ region: env.AWS_REGION, maxAttempts: 1 });
  const abort = () => client.destroy();
  signal.addEventListener("abort", abort, { once: true });
  let streaming = false;
  const input = {
    EndpointName: env.SAGEMAKER_ENDPOINT!,
    ContentType: "application/json",
    CustomAttributes: "route=/v1/chat/completions",
    Body: Buffer.from(JSON.stringify(body)),
  };
  try {
    signal.throwIfAborted();
    if (body.stream) {
      const output = await client.send(new InvokeEndpointWithResponseStreamCommand(input), { abortSignal: signal });
      if (!output.Body) throw new Error("Missing SageMaker response stream.");
      const events = output.Body;
      // Clean up both the SDK socket and listener when the caller consumes or cancels.
      const wrapped = (async function* () {
        try { yield* events; }
        finally { signal.removeEventListener("abort", abort); client.destroy(); }
      })();
      streaming = true;
      return new Response(sageMakerBody(wrapped), { headers: { "Content-Type": output.ContentType ?? "text/event-stream" } });
    }
    const output = await client.send(new InvokeEndpointCommand(input), { abortSignal: signal });
    return new Response(new Uint8Array(output.Body ?? []), { headers: { "Content-Type": output.ContentType ?? "application/json" } });
  } catch (cause) {
    if (signal.aborted) throw cause;
    const metadata = (cause as { $metadata?: { httpStatusCode?: number } }).$metadata;
    const status = metadata?.httpStatusCode;
    return new Response(null, { status: status === 429 ? 429 : status === 503 ? 503 : status === 400 ? 400 : 502 });
  } finally {
    if (!streaming) { signal.removeEventListener("abort", abort); client.destroy(); }
  }
}

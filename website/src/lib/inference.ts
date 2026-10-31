import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

const MODEL = "fin-o1-14b";
const UPSTREAM = "https://api.fireworks.ai/inference/v1/chat/completions";
const MAX_BODY = 128 * 1024;
const MAX_ACTIVE = 4;

type Environment = Record<string, string | undefined>;
type Dependencies = {
  env?: () => Environment;
  fetch?: typeof fetch;
  timeoutMs?: number;
  log?: (entry: Record<string, unknown>) => void;
  sagemaker?: (body: Record<string, unknown>, signal: AbortSignal, env: Environment) => Promise<Response>;
  bedrock?: (body: Record<string, unknown>, signal: AbortSignal, env: Environment) => Promise<Response>;
};

class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function error(message: string, status: number, id: string) {
  return Response.json(
    { error: { message, type: status === 401 ? "authentication_error" : "api_error" } },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": id } },
  );
}

function authorized(request: Request, env: Environment) {
  if (!env.SOVA_API_KEY || env.SOVA_API_KEY.length < 32) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`Bearer ${env.SOVA_API_KEY}`));
}

async function readBody(request: Request, signal: AbortSignal) {
  if (Number(request.headers.get("content-length")) > MAX_BODY) {
    throw new InputError("Request body exceeds 128 KiB.", 413);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new InputError("Content-Type must be application/json.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("A JSON request body is required.");
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new InputError("Request body exceeds 128 KiB.", 413);
      }
      parts.push(value);
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; }
  catch { throw new InputError("Invalid JSON request body."); }
}

function validate(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("Request body must be an object.");
  }
  const body = value as Record<string, unknown>;
  const allowed = new Set(["model", "messages", "stream", "stream_options", "max_tokens", "temperature", "top_p", "stop", "seed", "n"]);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw new InputError("Unsupported request field. See the Sova inference API documentation.");
  }
  if (body.model !== MODEL) throw new InputError(`model must be ${MODEL}.`);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 64) {
    throw new InputError("messages must contain 1–64 text messages.");
  }
  let textBytes = 0;
  const messages = body.messages.map((message: unknown) => {
    if (!message || typeof message !== "object") throw new InputError("Invalid message.");
    const m = message as Record<string, unknown>;
    if (typeof m.role !== "string" || !new Set(["system", "user", "assistant"]).has(m.role) || typeof m.content !== "string") {
      throw new InputError("Each message needs a system, user, or assistant role and text content.");
    }
    if (Object.keys(m).some((key) => key !== "role" && key !== "content")) {
      throw new InputError("Only role and content are supported in messages.");
    }
    textBytes += Buffer.byteLength(m.content);
    return { role: m.role, content: m.content };
  });
  if (textBytes > 16000) throw new InputError("Message text exceeds 16,000 UTF-8 bytes.");
  if (body.stream !== undefined && typeof body.stream !== "boolean") throw new InputError("stream must be a boolean.");
  if (body.n !== undefined && body.n !== 1) throw new InputError("Only n=1 is supported.");
  const maxTokens = body.max_tokens ?? 1024;
  if (!Number.isInteger(maxTokens) || Number(maxTokens) < 1 || Number(maxTokens) > 4096) {
    throw new InputError("max_tokens must be an integer from 1 to 4096.");
  }
  for (const [key, max] of [["temperature", 2], ["top_p", 1]] as const) {
    const v = body[key];
    if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max)) {
      throw new InputError(`${key} must be a number from 0 to ${max}.`);
    }
  }
  if (body.seed !== undefined && !Number.isSafeInteger(body.seed)) throw new InputError("seed must be a safe integer.");
  if (body.stop !== undefined) {
    const stops = Array.isArray(body.stop) ? body.stop : [body.stop];
    if (!stops.length || stops.length > 4 || stops.some((s) => typeof s !== "string" || !s.length || s.length > 256)) {
      throw new InputError("stop must be a string or 1–4 strings of at most 256 characters.");
    }
  }
  if (body.stream_options !== undefined) {
    const options = body.stream_options as Record<string, unknown> | null;
    if (!body.stream || !options || typeof options !== "object" || Array.isArray(options)
      || Object.keys(options).some((key) => key !== "include_usage")
      || typeof options.include_usage !== "boolean") {
      throw new InputError("stream_options supports only include_usage (boolean), with stream=true.");
    }
  }
  return { ...body, messages, max_tokens: maxTokens, stream: body.stream ?? false };
}

export function createInferenceHandlers(deps: Dependencies = {}) {
  const environment = deps.env ?? (() => process.env);
  const upstreamFetch = deps.fetch ?? fetch;
  const log = deps.log ?? ((entry) => console.info(JSON.stringify(entry)));
  let active = 0; // Per-process admission control; not a distributed account quota.

  function models(request: Request) {
    const id = randomUUID();
    if (!authorized(request, environment())) return error("Invalid API key.", 401, id);
    return Response.json({ object: "list", data: [{ id: MODEL, object: "model", created: 0, owned_by: "sova" }] },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": id } });
  }

  async function chat(request: Request): Promise<Response> {
    const id = randomUUID();
    const env = environment();
    if (!authorized(request, env)) return error("Invalid API key.", 401, id);
    const provider = env.SOVA_INFERENCE_PROVIDER ?? "fireworks";
    const configured = provider === "fireworks"
      ? Boolean(env.FIREWORKS_API_KEY && /^accounts\/[^/]+\/deployments\/[^/]+$/.test(env.FIREWORKS_DEPLOYMENT ?? ""))
      : provider === "sagemaker" ? Boolean(deps.sagemaker && env.AWS_REGION
        && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(env.SAGEMAKER_ENDPOINT ?? ""))
      : provider === "bedrock" && Boolean(deps.bedrock && env.AWS_REGION
        && /^arn:aws:bedrock:[a-z0-9-]+:\d{12}:imported-model\/[a-zA-Z0-9]+$/.test(env.BEDROCK_MODEL_ARN ?? "")
        && env.BEDROCK_MODEL_ARN?.split(":")[3] === env.AWS_REGION);
    if (env.SOVA_INFERENCE_ENABLED !== "true" || !configured) {
      return error("Inference is not enabled. Contact the Sova administrator.", 503, id);
    }
    if (active >= MAX_ACTIVE) return error("Too many active requests. Retry shortly.", 429, id);
    active++;
    const started = Date.now();
    const controller = new AbortController();
    const signal = AbortSignal.any([request.signal, controller.signal]);
    const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), deps.timeoutMs ?? 240000);
    let finished = false;
    let status = 500;
    let firstByteMs: number | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      active--;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      log({ event: "inference", requestId: id, status, durationMs: Date.now() - started, firstByteMs });
    };
    const onAbort = () => { status = request.signal.aborted ? 499 : 504; finish(); };
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      const body = validate(await readBody(request, signal));
      const upstream = provider === "bedrock"
        ? await deps.bedrock!(body, signal, env)
        : provider === "sagemaker"
        ? await deps.sagemaker!(body, signal, env)
        : await upstreamFetch(UPSTREAM, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.FIREWORKS_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: env.FIREWORKS_DEPLOYMENT }),
        signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!upstream.ok) {
        // Never forward provider diagnostics, which may include prompt text or account details.
        await upstream.body?.cancel();
        status = [400, 413, 422, 429, 503, 504].includes(upstream.status) ? upstream.status : 502;
        const message = status === 400 || status === 422 ? "Provider rejected the request. Check message length and token limits."
          : status === 429 ? "Provider capacity exceeded. Retry shortly."
          : status === 503 ? "Model is starting or unavailable. Retry shortly." : "Inference provider request failed.";
        finish();
        return error(message, status, id);
      }
      const expectedType = body.stream ? "text/event-stream" : "application/json";
      if (!upstream.body || !upstream.headers.get("content-type")?.includes(expectedType)) {
        await upstream.body?.cancel();
        status = 502;
        finish();
        return error("Invalid inference provider response.", 502, id);
      }
      status = 200;
      const reader = upstream.body.getReader();
      const stream = new ReadableStream<Uint8Array>({
        async pull(output) {
          try {
            signal.throwIfAborted();
            const { value, done } = await reader.read();
            signal.throwIfAborted();
            if (done) { finish(); output.close(); }
            else { firstByteMs ??= Date.now() - started; output.enqueue(value); }
          } catch (cause) {
            status = signal.aborted ? (request.signal.aborted ? 499 : 504) : 502;
            finish();
            controller.abort();
            await reader.cancel().catch(() => {});
            output.error(cause);
          }
        },
        async cancel() {
          status = 499;
          finish();
          controller.abort();
          await reader.cancel().catch(() => {});
        },
      });
      return new Response(stream, { headers: {
        "Content-Type": body.stream ? "text/event-stream; charset=utf-8" : "application/json",
        "Cache-Control": "no-store", "X-Accel-Buffering": "no", "X-Request-Id": id,
      } });
    } catch (cause) {
      status = cause instanceof InputError ? cause.status : signal.aborted ? (request.signal.aborted ? 499 : 504) : 502;
      finish();
      return error(cause instanceof InputError ? cause.message : status === 504 ? "Inference request timed out." : "Inference request failed.", status, id);
    }
  }
  return { chat, models };
}


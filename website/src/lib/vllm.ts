type Environment = Record<string, string | undefined>;

const MODEL = "qwen3-4b";

// vLLM speaks the OpenAI API. The base URL is operator-provided via
// SOVA_VLLM_BASE_URL and OpenAI endpoint paths are appended to it. Timeouts
// come from the caller's abort signal, matching the AWS adapters, and each
// request is a single attempt with no provider-error retries.
function baseUrl(env: Environment) {
  const base = env.SOVA_VLLM_BASE_URL ?? "";
  // inferenceConfigured gates this before dispatch; fail closed anyway.
  if (!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(base)) throw new Error("vLLM base URL is not configured.");
  return base.replace(/\/+$/, "");
}

function authHeaders(env: Environment): Record<string, string> {
  // vLLM expects Authorization only when launched with --api-key.
  return env.SOVA_VLLM_API_KEY ? { Authorization: `Bearer ${env.SOVA_VLLM_API_KEY}` } : {};
}

export function createVllmBackend(fetchImpl: typeof fetch = fetch) {
  async function invoke(
    body: Record<string, unknown>, signal: AbortSignal, env: Environment,
  ): Promise<Response> {
    // Non-streaming only for now. Streaming requests are rejected upstream of
    // this adapter; this guard keeps the contract if called directly.
    if (body.stream) return new Response(null, { status: 400 });
    try {
      signal.throwIfAborted();
      // The served model name is chosen by the server; model routing is not a payload parameter.
      // Qwen3 emits chain-of-thought by default, which burns the customer's
      // max_tokens budget on hidden reasoning. Answers only, unless an
      // operator flips SOVA_VLLM_THINKING on.
      const payload = {
        ...body,
        model: env.SOVA_VLLM_MODEL ?? MODEL,
        chat_template_kwargs: { enable_thinking: env.SOVA_VLLM_THINKING === "1" },
      };
      const response = await fetchImpl(`${baseUrl(env)}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(env) },
        body: JSON.stringify(payload),
        signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) {
        // Never forward vLLM diagnostics, which may include prompt text or account details.
        await response.body?.cancel();
        const status = [400, 413, 422, 429, 503, 504].includes(response.status) ? response.status : 502;
        return new Response(null, { status });
      }
      const result = JSON.parse(await response.text()) as Record<string, unknown>;
      if (!Array.isArray(result.choices)) throw new Error("Invalid vLLM chat response.");
      // Echo the customer-requested catalog id, not the served model name.
      const requested = typeof body.model === "string" ? body.model : MODEL;
      return Response.json({ ...result, model: requested });
    } catch (cause) {
      if (signal.aborted) throw cause;
      return new Response(null, { status: 502 });
    }
  }

  async function models(signal: AbortSignal, env: Environment): Promise<Response> {
    try {
      signal.throwIfAborted();
      const response = await fetchImpl(`${baseUrl(env)}/v1/models`, {
        headers: authHeaders(env), signal, cache: "no-store", redirect: "error",
      });
      if (!response.ok) {
        await response.body?.cancel();
        const status = [400, 429, 503, 504].includes(response.status) ? response.status : 502;
        return new Response(null, { status });
      }
      const result = JSON.parse(await response.text()) as Record<string, unknown>;
      if (!Array.isArray(result.data)) throw new Error("Invalid vLLM model list.");
      return Response.json(result);
    } catch (cause) {
      if (signal.aborted) throw cause;
      return new Response(null, { status: 502 });
    }
  }

  return { chat: invoke, models };
}

export type VllmBackend = ReturnType<typeof createVllmBackend>;

export const vllm = createVllmBackend();

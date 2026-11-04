import { test } from "node:test";
import assert from "node:assert/strict";
import { createInferenceHandlers } from "../src/lib/inference.ts";
import { sageMakerBody } from "../src/lib/sagemaker.ts";
import { bedrockBody, createBedrockInvoker } from "../src/lib/bedrock.ts";

const key = "test-client-key-123456789012345678901234567890";
const config = {
  SOVA_API_KEY: key,
  SOVA_INFERENCE_ENABLED: "true",
  FIREWORKS_API_KEY: "test-provider-secret",
  FIREWORKS_DEPLOYMENT: "accounts/test/deployments/private-model",
};
const payload = { model: "fin-o1-14b", messages: [{ role: "user", content: "Hello" }] };
const bedrockConfig = {
  SOVA_API_KEY: key, SOVA_INFERENCE_ENABLED: "true", SOVA_INFERENCE_PROVIDER: "bedrock",
  AWS_REGION: "us-east-1", BEDROCK_MODEL_ARN: "arn:aws:bedrock:us-east-1:123456789012:imported-model/abcdefgh1234",
};
function request(body = payload, options = {}) {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body), ...options,
  });
}
function make(overrides = {}) {
  return createInferenceHandlers({ env: () => config, log() {}, fetch: async () => { throw Error("Unexpected upstream call"); }, ...overrides });
}

test("missing auth and disabled service never call upstream", async () => {
  assert.equal((await make().chat(request(payload, { headers: {} }))).status, 401);
  assert.equal((await make({ env: () => ({ ...config, SOVA_INFERENCE_ENABLED: "false" }) }).chat(request())).status, 503);
  assert.equal((await make({ env: () => ({ ...config, SOVA_API_KEY: "" }) }).chat(request())).status, 401);
});

test("rejects arbitrary models, tools, invalid sampling, and malformed JSON", async () => {
  const api = make();
  for (const invalid of [
    { ...payload, model: "other-model" }, { ...payload, tools: [] },
    { ...payload, messages: [{ role: "user", content: [{ type: "image_url" }] }] },
    { ...payload, messages: [{ role: ["user"], content: "Hello" }] },
    { ...payload, max_tokens: 999999 }, { ...payload, temperature: -1 },
    { ...payload, n: 2 }, { ...payload, stream_options: { include_usage: true } },
  ]) assert.equal((await api.chat(request(invalid))).status, 400);
  assert.equal((await api.chat(request(payload, { body: "{" }))).status, 400);
});

test("bounds chunked request bodies without relying on content-length", async () => {
  const body = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(131073)); c.close(); } });
  const response = await make().chat(request(payload, { body, duplex: "half" }));
  assert.equal(response.status, 413);
});

test("pins upstream destination/model and preserves JSON reasoning and usage", async () => {
  const result = { model: config.FIREWORKS_DEPLOYMENT, choices: [{ message: { content: "Hello", reasoning_content: "Reason" } }], usage: { completion_tokens: 5 } };
  const api = make({ fetch: async (url, options) => {
    assert.equal(url, "https://api.fireworks.ai/inference/v1/chat/completions");
    assert.equal(options.headers.Authorization, `Bearer ${config.FIREWORKS_API_KEY}`);
    assert.equal(options.redirect, "error");
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, config.FIREWORKS_DEPLOYMENT);
    assert.equal(sent.max_tokens, 1024);
    assert.deepEqual(sent.messages, payload.messages);
    return Response.json(result);
  } });
  const response = await api.chat(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), result);
});

test("streams chunks before completion and retains SSE framing", async () => {
  let source;
  const upstream = new ReadableStream({ start(c) { source = c; } });
  const api = make({ fetch: async () => new Response(upstream, { headers: { "content-type": "text/event-stream" } }) });
  const response = await api.chat(request({ ...payload, stream: true, stream_options: { include_usage: true } }));
  const reader = response.body.getReader();
  const chunk = 'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n';
  source.enqueue(new TextEncoder().encode(chunk));
  assert.equal(new TextDecoder().decode((await reader.read()).value), chunk);
  source.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); source.close();
  assert.equal(new TextDecoder().decode((await reader.read()).value), "data: [DONE]\n\n");
  assert.equal((await reader.read()).done, true);
});

test("cancelling a client stream aborts provider work and releases capacity", async () => {
  const signals = [];
  const api = make({ fetch: async (_url, options) => {
    signals.push(options.signal);
    return new Response(new ReadableStream(), { headers: { "content-type": "text/event-stream" } });
  } });
  const responses = [];
  for (let i = 0; i < 4; i++) responses.push(await api.chat(request({ ...payload, stream: true })));
  assert.equal((await api.chat(request())).status, 429);
  await responses[0].body.cancel();
  assert.equal(signals[0].aborted, true);
  const next = await api.chat(request({ ...payload, stream: true }));
  assert.equal(next.status, 200);
  await Promise.all([...responses.slice(1), next].map((r) => r.body.cancel()));
});

test("provider errors are sanitized and capacity is released", async () => {
  const api = make({ fetch: async () => new Response("SECRET provider diagnostics", { status: 401 }) });
  for (let i = 0; i < 6; i++) {
    const response = await api.chat(request());
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes("SECRET"), false);
  }
});

test("provider timeout aborts fetch and returns 504", async () => {
  const api = make({ timeoutMs: 15, fetch: async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }) });
  assert.equal((await api.chat(request())).status, 504);
});

test("request disconnect aborts an in-flight provider response", async () => {
  let providerSignal;
  const api = make({ fetch: async (_url, options) => {
    providerSignal = options.signal;
    return new Response(new ReadableStream({ start(c) {
      options.signal.addEventListener("abort", () => c.error(options.signal.reason), { once: true });
    } }), { headers: { "content-type": "text/event-stream" } });
  } });
  const client = new AbortController();
  const response = await api.chat(request({ ...payload, stream: true }, { signal: client.signal }));
  client.abort();
  await assert.rejects(response.text());
  assert.equal(providerSignal.aborted, true);
});

test("model discovery is authenticated", async () => {
  const api = make();
  assert.equal(api.models(new Request("http://localhost/api/v1/models")).status, 401);
  const response = api.models(new Request("http://localhost/api/v1/models", { headers: { authorization: `Bearer ${key}` } }));
  assert.equal((await response.json()).data[0].id, "fin-o1-14b");
});

test("SageMaker selection uses its endpoint configuration without Fireworks credentials", async () => {
  let called = false;
  const api = make({
    env: () => ({ SOVA_API_KEY: key, SOVA_INFERENCE_ENABLED: "true", SOVA_INFERENCE_PROVIDER: "sagemaker", AWS_REGION: "ap-south-1", SAGEMAKER_ENDPOINT: "sova-fin-o1-14b" }),
    sagemaker: async (body, signal, env) => {
      called = true;
      assert.equal(body.model, "fin-o1-14b");
      assert.equal(env.SAGEMAKER_ENDPOINT, "sova-fin-o1-14b");
      assert.equal(signal.aborted, false);
      return Response.json({ choices: [{ message: { content: "25%" } }] });
    },
  });
  const response = await api.chat(request());
  assert.equal((await response.json()).choices[0].message.content, "25%");
  assert.equal(called, true);
});

test("SageMaker transport preserves fragmented SSE payload bytes", async () => {
  const raw = 'data: {"choices":[{"delta":{"content":"₹25"}}]}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(raw);
  async function* events() {
    for (let i = 0; i < bytes.length; i += 2) yield { PayloadPart: { Bytes: bytes.slice(i, i + 2) } };
  }
  assert.equal(await new Response(sageMakerBody(events())).text(), raw);
});

test("SageMaker in-stream errors fail the response without exposing diagnostics", async () => {
  async function* events() { yield { ModelStreamError: { Message: "SECRET", ErrorCode: "ModelInvocationTimeExceeded" } }; }
  await assert.rejects(new Response(sageMakerBody(events())).text(), { message: "SageMaker inference stream failed." });
});

test("Bedrock selects the server-configured imported model without Fireworks credentials", async () => {
  let calls = 0;
  const api = make({ env: () => bedrockConfig, bedrock: async (body, _signal, env) => {
    calls++;
    assert.equal(body.model, "fin-o1-14b");
    assert.equal(env.BEDROCK_MODEL_ARN, bedrockConfig.BEDROCK_MODEL_ARN);
    return Response.json({ choices: [] });
  } });
  const result = await api.chat(request());
  assert.equal(result.status, 200);
  await result.json();
  assert.equal(calls, 1);
  for (const arn of ["anthropic.other-model", bedrockConfig.BEDROCK_MODEL_ARN.replace("us-east-1", "us-west-2")]) {
    const invalid = make({ env: () => ({ ...bedrockConfig, BEDROCK_MODEL_ARN: arn }), bedrock: async () => { throw Error("must not invoke"); } });
    assert.equal((await invalid.chat(request())).status, 503);
  }
});

test("Bedrock JSON transport pins ARN, strips routing parameters, preserves reasoning and usage", async () => {
  let destroyed = 0;
  const result = { choices: [{ message: { content: "25%", reasoning_content: "30/120" } }], usage: { total_tokens: 15 } };
  const invoke = createBedrockInvoker((region) => {
    assert.equal(region, "us-east-1");
    return { destroy() { destroyed++; }, async send(command, options) {
      assert.equal(command.constructor.name, "InvokeModelCommand");
      assert.equal(command.input.modelId, bedrockConfig.BEDROCK_MODEL_ARN);
      const sent = JSON.parse(Buffer.from(command.input.body).toString());
      assert.equal(sent.model, undefined);
      assert.equal(sent.stream, undefined);
      assert.deepEqual(sent.messages, payload.messages);
      assert.ok(options.abortSignal);
      return { body: Buffer.from(JSON.stringify(result)) };
    } };
  });
  const response = await invoke({ ...payload, stream: false }, new AbortController().signal, bedrockConfig);
  assert.deepEqual(await response.json(), { ...result, model: "fin-o1-14b" });
  assert.equal(destroyed, 1);
});

test("Bedrock event stream becomes SSE preserving Unicode, reasoning, usage and completion", async () => {
  const chunks = [
    { choices: [{ delta: { reasoning_content: "₹ arithmetic" } }] },
    { choices: [{ delta: { content: "25%" }, finish_reason: "stop" }] },
    { choices: [], usage: { total_tokens: 15 } },
  ];
  async function* events() {
    for (const chunk of chunks) yield { chunk: { bytes: Buffer.from(JSON.stringify(chunk)) } };
    yield { chunk: { bytes: Buffer.from(JSON.stringify({ "amazon-bedrock-invocationMetrics": { outputTokenCount: 10 } })) } };
  }
  const reader = bedrockBody(events()).getReader();
  for (const chunk of chunks) {
    assert.equal(new TextDecoder().decode((await reader.read()).value), `data: ${JSON.stringify({ ...chunk, model: "fin-o1-14b" })}\n\n`);
  }
  assert.equal(new TextDecoder().decode((await reader.read()).value), "data: [DONE]\n\n");
  assert.equal((await reader.read()).done, true);
});

test("Bedrock streaming transport uses stream API and cancellation releases the client", async () => {
  let destroyed = 0, closed = false;
  async function* events() {
    try {
      yield { chunk: { bytes: Buffer.from('{"choices":[{"delta":{"content":"hello"}}]}') } };
      yield { chunk: { bytes: Buffer.from('{"choices":[]}') } };
    } finally { closed = true; }
  }
  const invoke = createBedrockInvoker(() => ({ destroy() { destroyed++; }, async send(command) {
    assert.equal(command.constructor.name, "InvokeModelWithResponseStreamCommand");
    assert.equal(command.input.modelId, bedrockConfig.BEDROCK_MODEL_ARN);
    return { body: events() };
  } }));
  const response = await invoke({ ...payload, stream: true }, new AbortController().signal, bedrockConfig);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /hello/);
  await reader.cancel();
  assert.equal(closed, true);
  assert.equal(destroyed, 1);
});

test("Bedrock stream failures terminate without DONE or provider diagnostics", async () => {
  for (const value of [{ modelStreamErrorException: { message: "SECRET" } }, { chunk: { bytes: Buffer.from("SECRET invalid JSON") } }]) {
    async function* events() { yield value; }
    await assert.rejects(new Response(bedrockBody(events())).text(), (error) => {
      assert.equal(error.message, "Bedrock inference stream failed.");
      return true;
    });
  }
  async function* truncated() { yield { chunk: { bytes: Buffer.from('{"choices":[{"delta":{"content":"partial"}}]}') } }; }
  await assert.rejects(new Response(bedrockBody(truncated())).text(), /Bedrock inference stream failed/);
});

test("Bedrock cold starts and errors are sanitized and no implicit inference retries occur", async () => {
  for (const [name, status] of [["ModelNotReadyException", 503], ["ThrottlingException", 429], ["ModelTimeoutException", 504], ["AccessDeniedException", 502]]) {
    let calls = 0, destroyed = 0;
    const invoke = createBedrockInvoker(() => ({ destroy() { destroyed++; }, async send() {
      calls++; throw Object.assign(new Error("SECRET"), { name });
    } }));
    const response = await invoke(payload, new AbortController().signal, bedrockConfig);
    assert.equal(response.status, status);
    assert.equal(await response.text(), "");
    assert.equal(calls, 1);
    assert.equal(destroyed, 1);
  }
});

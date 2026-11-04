import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryKeyStore, mintSecretKey, fingerprintOf } from "../src/lib/keys-store.ts";
import { createInferenceHandlers } from "../src/lib/inference.ts";

const LEGACY_KEY = "test-client-key-123456789012345678901234567890";
const config = {
  SOVA_API_KEY: LEGACY_KEY,
  SOVA_INFERENCE_ENABLED: "true",
  SOVA_INFERENCE_PROVIDER: "vllm",
  SOVA_VLLM_BASE_URL: "http://localhost:9",
  SOVA_VLLM_MODEL: "qwen3-4b",
};
const payload = { model: "fin-o1-14b", messages: [{ role: "user", content: "Hello" }] };

function request(body = payload, headers = {}) {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const vllmResponse = () => new Response(JSON.stringify({
  choices: [{ message: { role: "assistant", content: "Hi" } }],
  usage: { prompt_tokens: 11, completion_tokens: 7 },
}), { status: 200, headers: { "content-type": "application/json" } });

function make(store, overrides = {}) {
  return createInferenceHandlers({
    env: () => config, log() {}, store,
    vllm: { chat: async () => vllmResponse(), models: async () => vllmResponse() },
    ...overrides,
  });
}

test("mint produces the documented key shape and fingerprint contract", () => {
  const { key, keyId, fingerprint } = mintSecretKey();
  assert.match(key, /^sk-sova-[0-9a-f]{48}$/);
  assert.equal(fingerprint, fingerprintOf(key));
  assert.equal(keyId, fingerprint.slice(0, 8));
});

test("minted key authenticates through the store and gains usage accounting", async () => {
  const store = new InMemoryKeyStore();
  const { key, keyId, fingerprint } = mintSecretKey();
  await store.insertKey(keyId, fingerprint, "acme");

  const handler = make(store);
  const response = await handler.chat(request(payload, { authorization: `Bearer ${key}` }));
  assert.equal(response.status, 200);
  await response.text();

  const rows = await store.listKeys();
  const row = rows.find((r) => r.keyId === keyId);
  assert.equal(row.label, "acme");
  assert.equal(row.totalRequests, 1);
  assert.equal(row.totalPromptTokens, 11);
  assert.equal(row.totalCompletionTokens, 7);
});

test("revoked key stops authenticating after the store update", async () => {
  const store = new InMemoryKeyStore();
  const { key, keyId, fingerprint } = mintSecretKey();
  await store.insertKey(keyId, fingerprint, "acme");
  const handler = make(store);
  assert.equal((await handler.chat(request(payload, { authorization: `Bearer ${key}` }))).status, 200);

  await store.revokeKey(keyId);
  const denied = await handler.chat(request(payload, { authorization: `Bearer ${key}` }));
  assert.equal(denied.status, 401);
  await denied.text();
  const row = (await store.listKeys()).find((r) => r.keyId === keyId);
  assert.ok(row.revokedAt);
});

test("unknown key is rejected even when env fallback is absent", async () => {
  const store = new InMemoryKeyStore();
  const handler = make(store);
  const { key } = mintSecretKey();
  assert.equal((await handler.chat(request(payload, { authorization: `Bearer ${key}` }))).status, 401);
});

test("legacy shared key keeps working alongside store keys", async () => {
  const store = new InMemoryKeyStore();
  const handler = make(store);
  const response = await handler.chat(request(payload, { authorization: `Bearer ${LEGACY_KEY}` }));
  assert.equal(response.status, 200);
  await response.text();
});

test("store outage fails open to env fingerprints, never blocks auth", async () => {
  const broken = {
    listKeys: async () => { throw Error("db down"); },
    insertKey: async () => { throw Error("db down"); },
    revokeKey: async () => { throw Error("db down"); },
    activeFingerprints: async () => { throw Error("db down"); },
    recordUsage: async () => { throw Error("db down"); },
  };
  const handler = make(broken);
  const response = await handler.chat(request(payload, { authorization: `Bearer ${LEGACY_KEY}` }));
  assert.equal(response.status, 200);
  await response.text();
});

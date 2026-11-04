import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryPortalStore, fingerprintOf } from "../src/lib/portal-store.ts";

const KEY = "sk-sova-" + "a".repeat(48);

function seedStore() {
  const store = new InMemoryPortalStore();
  // Seed a deterministic key by registering its fingerprint directly through
  // the public surface: generate, then swap in our known key's fingerprint.
  return store;
}

test("generateKey issues a shown-once secret and findByKey resolves it", async () => {
  const store = new InMemoryPortalStore();
  const { key, keyId } = await store.generateKey("acme");
  assert.match(key, /^sk-sova-[0-9a-f]{48}$/);
  assert.equal(keyId, fingerprintOf(key).slice(0, 8));

  const row = await store.findByKey(key);
  assert.ok(row);
  assert.equal(row.label, "acme");
  assert.equal(row.keyId, keyId);
  assert.equal(row.revokedAt, null);

  assert.equal(await store.findByKey("sk-sova-" + "b".repeat(48)), null);
});

test("recordUsage feeds overview, dailySeries and modelStats", async () => {
  const store = seedStore();
  const { key, keyId } = await store.generateKey("acme");

  await store.recordUsage({ keyId, model: "qwen3-4b", ok: true, promptTokens: 10, completionTokens: 5, latencyMs: 200, ttftMs: 120 });
  await store.recordUsage({ keyId, model: "qwen3-4b", ok: true, promptTokens: 4, completionTokens: 2, latencyMs: 400, ttftMs: 180 });
  await store.recordUsage({ keyId, model: "qwen3-4b", ok: false, promptTokens: 1, completionTokens: 0, latencyMs: 50, ttftMs: null });

  const after = await store.findByKey(key);
  assert.ok(after?.lastUsedAt);

  const summary = await store.overview(keyId, 14);
  assert.equal(summary.requests, 3);
  assert.equal(summary.ok, 2);
  assert.equal(summary.fail, 1);
  assert.equal(summary.promptTokens, 15);
  assert.equal(summary.completionTokens, 7);

  const days = await store.dailySeries(keyId, 14, null);
  assert.equal(days.length, 1);
  assert.equal(days[0].requests, 3);
  assert.equal(days[0].ok, 2);
  assert.equal(days[0].promptTokens, 15);
  assert.equal(days[0].completionTokens, 7);

  const filtered = await store.dailySeries(keyId, 14, "other-model");
  assert.deepEqual(filtered, []);

  const models = await store.modelStats(keyId, 14);
  assert.equal(models.length, 1);
  assert.equal(models[0].model, "qwen3-4b");
  assert.equal(models[0].requests, 3);
  assert.equal(models[0].ok, 2);
  assert.equal(models[0].avgLatencyMs, 217); // (200+400+50)/3 rounded
  assert.equal(models[0].p50LatencyMs, 200); // sorted [50,200,400]
});

test("revokeKey deactivates the key but keeps its history queryable", async () => {
  const store = seedStore();
  const { key, keyId } = await store.generateKey("acme");
  await store.recordUsage({ keyId, model: "qwen3-4b", ok: true, promptTokens: 8, completionTokens: 4, latencyMs: 100, ttftMs: 60 });
  await store.revokeKey(keyId);

  assert.equal(await store.findByKey(key), null);

  const summary = await store.overview(keyId, 14);
  assert.equal(summary.requests, 1);

  const keys = await store.listKeys();
  assert.equal(keys.length, 1);
  assert.ok(keys[0].revokedAt);
});

test("usage for an unknown key returns zeros without throwing", async () => {
  const store = seedStore();
  const summary = await store.overview("zzzzzzzz", 14);
  assert.deepEqual(summary, { requests: 0, ok: 0, fail: 0, promptTokens: 0, completionTokens: 0 });
  assert.deepEqual(await store.dailySeries("zzzzzzzz", 14, null), []);
  assert.deepEqual(await store.modelStats("zzzzzzzz", 14), []);
});

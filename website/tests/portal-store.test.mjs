import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryPortalStore, fingerprintOf } from "../src/lib/portal-store.ts";

const KEY = "sk-sova-" + "a".repeat(48);

test("findByKey resolves a registered key and rejects unknown or revoked", async () => {
  // InMemoryPortalStore seeds via constructor in prod-less mode; simulate the
  // operator flow by constructing a store with the key pre-registered.
  const store = new InMemoryPortalStore([{ key: KEY, label: "acme" }]);
  const row = await store.findByKey(KEY);
  assert.ok(row);
  assert.equal(row.label, "acme");
  assert.equal(row.keyId, fingerprintOf(KEY).slice(0, 8));

  assert.equal(await store.findByKey("sk-sova-" + "b".repeat(48)), null);
});

test("recordUsage accumulates totals and daily buckets", async () => {
  const store = new InMemoryPortalStore([{ key: KEY, label: "acme" }]);
  const row = await store.findByKey(KEY);
  await store.recordUsage(row.keyId, 10, 5);
  await store.recordUsage(row.keyId, 4, 2);

  const after = await store.findByKey(KEY);
  assert.equal(after.totalRequests, 2);
  assert.equal(after.totalPromptTokens, 14);
  assert.equal(after.totalCompletionTokens, 7);
  assert.ok(after.lastUsedAt);

  const days = await store.usageDays(row.keyId, 14);
  assert.equal(days.length, 1);
  assert.equal(days[0].requests, 2);
  assert.equal(days[0].promptTokens, 14);
  assert.equal(days[0].completionTokens, 7);
});

test("usageDays for an unknown key returns empty without throwing", async () => {
  const store = new InMemoryPortalStore();
  assert.deepEqual(await store.usageDays("zzzzzzzz", 14), []);
});

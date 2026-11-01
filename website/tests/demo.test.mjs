import test from "node:test";
import assert from "node:assert/strict";
import { demoCases, demoInstruction, parseBrief, evaluateBrief } from "../src/lib/demo.ts";
import { demoAvailability, inferenceConfigured, baselineConfigured } from "../src/lib/serving-config.ts";
import { demoAuthorized, readDemoBody, readDemoQuestion } from "../src/lib/demo-server.ts";
import { readFileSync } from "node:fs";

test("published recordings match the exact sample source and pass independently recomputed checks", () => {
  const recordings = JSON.parse(readFileSync(new URL("../src/lib/demo-recordings.json", import.meta.url), "utf8"));
  for (const sample of demoCases) {
    const recording = recordings[sample.id];
    assert.equal(recording.document, sample.document);
    assert.equal(recording.instruction, demoInstruction);
    assert.equal(recording.result.complete, true);
    assert.equal(recording.result.warmup, false);
    assert.ok(recording.result.durationMs > 0);
    assert.ok(recording.result.outputTokens > 0);
    const parsed = parseBrief(recording.result.text);
    assert.deepEqual(parsed, recording.result.brief);
    assert.equal(evaluateBrief(parsed, sample.expected, sample.document).checks.filter(c => c.passed).length, 4);
  }
});

test("live controls stay unavailable for disabled, incomplete or mismatched serving configurations", () => {
  const env = {
    SOVA_DEMO_ACCESS_CODE: "d".repeat(32), SOVA_API_KEY: "a".repeat(32),
    SOVA_INFERENCE_ENABLED: "true", SOVA_INFERENCE_PROVIDER: "bedrock", AWS_REGION: "us-east-1",
    BEDROCK_MODEL_ARN: "arn:aws:bedrock:us-east-1:123456789012:imported-model/example123",
  };
  assert.equal(demoAvailability(env).liveEnabled, true);
  for (const change of [
    { SOVA_DEMO_ACCESS_CODE: "short" }, { SOVA_API_KEY: undefined },
    { SOVA_INFERENCE_ENABLED: "false" }, { BEDROCK_MODEL_ARN: undefined },
    { AWS_REGION: "us-west-2" }, { SOVA_INFERENCE_PROVIDER: "unknown" },
  ]) assert.equal(demoAvailability({ ...env, ...change }).liveEnabled, false);
  assert.deepEqual(Object.keys(demoAvailability(env)).sort(), ["baselineConnected", "baselineLabel", "liveEnabled"]);
});

test("comparison controls use the same allowlist as the API and identify the configured provider", () => {
  for (const model of [undefined, "", "gpt", "us.openai.unapproved", "us.anthropic.unapproved"]) {
    assert.equal(baselineConfigured(model), false);
    assert.equal(demoAvailability({ BEDROCK_DEMO_BASELINE_ID: model }).baselineConnected, false);
  }
  for (const prefix of ["us", "global"]) {
    const gpt = demoAvailability({ BEDROCK_DEMO_BASELINE_ID: `${prefix}.openai.gpt-6.1-sol` });
    assert.equal(gpt.baselineConnected, true);
    assert.equal(gpt.baselineLabel, "GPT");
    const claude = demoAvailability({ BEDROCK_DEMO_BASELINE_ID: `${prefix}.anthropic.claude-opus-5-5` });
    assert.equal(claude.baselineConnected, true);
    assert.equal(claude.baselineLabel, "Claude");
  }
});

test("configuration checks preserve Fireworks and SageMaker deployment validation", () => {
  assert.equal(inferenceConfigured({ FIREWORKS_API_KEY: "test", FIREWORKS_DEPLOYMENT: "accounts/test/deployments/test" }), true);
  assert.equal(inferenceConfigured({ FIREWORKS_API_KEY: "test", FIREWORKS_DEPLOYMENT: "accounts/test/models/test" }), false);
  assert.equal(inferenceConfigured({ SOVA_INFERENCE_PROVIDER: "sagemaker", AWS_REGION: "us-east-1", SAGEMAKER_ENDPOINT: "sova-test" }), true);
  assert.equal(inferenceConfigured({ SOVA_INFERENCE_PROVIDER: "sagemaker", AWS_REGION: "us-east-1", SAGEMAKER_ENDPOINT: "bad/endpoint" }), false);
});

test("extracts the final structured brief without treating reasoning as the answer", () => {
  const expected = demoCases[0].expected;
  assert.deepEqual(parseBrief(`<think>Compute {x: 2}. A \"quote\".</think>\n\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``), expected);
  assert.deepEqual(parseBrief(`${JSON.stringify({ ...expected, revenue_growth_pct: 99 })}\n${JSON.stringify(expected)}`), expected);
  assert.equal(parseBrief('{"summary":"no financial fields"}'), null);
  assert.equal(parseBrief(JSON.stringify({ ...expected, revenue_growth_pct: "20%" })), null);
  assert.equal(parseBrief(JSON.stringify(expected).slice(0, -2)), null);
});

test("checks negative cash flow and rejects missing, wrong or fabricated evidence", () => {
  const sample = demoCases[1];
  const good = evaluateBrief(sample.expected, sample.expected, sample.document);
  assert.equal(good.checks.filter(c => c.passed).length, 4);
  assert.equal(good.citationIdsValid, true);
  const bad = evaluateBrief({ ...sample.expected, free_cash_flow_m: 9, net_debt_m: null, citations: ["S99"] }, sample.expected, sample.document);
  assert.equal(bad.checks.filter(c => c.passed).length, 2);
  assert.equal(bad.citationIdsValid, false);
  assert.equal(evaluateBrief(sample.expected, null, sample.document).checks.length, 0);
  assert.equal(evaluateBrief(null, sample.expected, sample.document).checks.some(c => c.passed), false);
});

test("live demo fails closed without a distinct strong presenter credential", () => {
  const secret = "x".repeat(32);
  assert.equal(demoAuthorized(new Request("https://sova.test"), secret), false);
  const request = new Request("https://sova.test", { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(demoAuthorized(request, undefined), false);
  assert.equal(demoAuthorized(request, "short"), false);
  assert.equal(demoAuthorized(request, "y".repeat(32)), false);
  assert.equal(demoAuthorized(request, secret), true);
});

test("bounds request bodies even when content-length is absent", async () => {
  const request = text => new Request("https://sova.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
  assert.deepEqual(await readDemoBody(request('{"kind":"specialist"}')), { kind: "specialist" });
  await assert.rejects(readDemoBody(request(" ".repeat(24001))));
  await assert.rejects(readDemoBody(request("invalid")));
});

test("optional comparison questions preserve existing requests and reject invalid input", () => {
  assert.equal(readDemoQuestion(undefined), undefined);
  assert.equal(readDemoQuestion("  What is the main risk?  "), "What is the main risk?");
  for (const invalid of [null, {}, 42, "", "   ", "x".repeat(1001)]) {
    assert.throws(() => readDemoQuestion(invalid));
  }
  assert.equal(readDemoQuestion("x".repeat(1000)).length, 1000);
});

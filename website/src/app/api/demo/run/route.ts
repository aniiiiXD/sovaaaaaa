import { randomUUID } from "node:crypto";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { inference } from "@/lib/inference-runtime";
import { demoCases, demoInstruction, evaluateBrief, parseBrief, type DemoResult } from "@/lib/demo";
import { demoAuthorized, readDemoBody, readDemoQuestion } from "@/lib/demo-server";

export const runtime = "nodejs";
export const maxDuration = 300;
let active = 0;
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!demoAuthorized(request, process.env.SOVA_DEMO_ACCESS_CODE)) return reply({ error: "Enter the presenter access code to run a live model." }, 401);
  if (active >= 2) return reply({ error: "Two demo runs are already active. Wait for them to finish." }, 429);
  let body: Record<string, unknown>;
  try { body = await readDemoBody(request); }
  catch { return reply({ error: "Use a valid document of at most 10,000 UTF-8 bytes." }, 400); }
  if (!body || !["specialist", "baseline"].includes(String(body.kind)) || (body.warmup !== undefined && typeof body.warmup !== "boolean")) return reply({ error: "Invalid demo request." }, 400);
  const kind = body.kind as "specialist" | "baseline";
  const warmup = body.warmup === true;
  let question: string | undefined;
  try { question = readDemoQuestion(body.question); }
  catch { return reply({ error: "Use a question between 1 and 1,000 characters." }, 400); }
  const sample = demoCases.find(item => item.id === body.caseId);
  const document = sample?.document ?? (typeof body.document === "string" ? body.document.trim() : "");
  if (!warmup && (document.length < 40 || Buffer.byteLength(document) > 10000)) return reply({ error: "Use a financial excerpt between 40 characters and 10,000 UTF-8 bytes." }, 400);
  const baseline = process.env.BEDROCK_DEMO_BASELINE_ID;
  if (kind === "baseline" && (!baseline || !/^(us|global)\.(openai\.gpt-6\.1-sol|anthropic\.claude-opus-5-5)$/.test(baseline))) return reply({ error: "The frontier baseline is not connected for this demo yet." }, 503);
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(240000)]);
  const prompt = warmup ? "Reply with the word ready." : question ? `User question: ${question}\n\nFinancial source:\n${document}` : document;
  const system = warmup ? "Respond briefly." : question ? `${demoInstruction}\nAddress the user's question in the summary while retaining all required financial fields. Use only the financial source as factual evidence.` : demoInstruction;
  const started = Date.now();
  // Body reads yield; check again immediately before reserving capacity.
  if (active >= 2) return reply({ error: "Two demo runs are already active. Wait for them to finish." }, 429);
  active++;
  let client: BedrockRuntimeClient | undefined;
  try {
    let text = "", inputTokens: number | null = null, outputTokens: number | null = null, finishReason = "unknown";
    if (kind === "specialist") {
      const response = await inference.chat(new Request("https://sova.internal/api/v1/chat/completions", {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SOVA_API_KEY}` },
        body: JSON.stringify({ model: "fin-o1-14b", messages: [{ role: "system", content: system }, { role: "user", content: prompt }], stream: false, max_tokens: warmup ? 32 : 2048, temperature: 0.2 }),
      }));
      if (!response.ok) {
        await response.body?.cancel();
        return reply({ error: response.status === 503 ? "The specialist is starting. Wait 20–30 seconds, then prepare it again. Cold starts can take a few minutes." : response.status === 429 ? "Model capacity is busy. Retry shortly." : "The specialist could not complete this request. Retry or check the serving connection." }, response.status);
      }
      const value = await response.json();
      text = value.choices?.[0]?.message?.content ?? "";
      finishReason = value.choices?.[0]?.finish_reason ?? "unknown";
      inputTokens = typeof value.usage?.prompt_tokens === "number" ? value.usage.prompt_tokens : null;
      outputTokens = typeof value.usage?.completion_tokens === "number" ? value.usage.completion_tokens : null;
    } else {
      const region = process.env.AWS_REGION ?? "us-east-1";
      const roleArn = process.env.BEDROCK_DEMO_BASELINE_ROLE_ARN ?? process.env.AWS_ROLE_ARN;
      client = new BedrockRuntimeClient({ region, maxAttempts: 1, ...(roleArn ? { credentials: awsCredentialsProvider({ roleArn, clientConfig: { region }, durationSeconds: 900 }) } : {}) });
      const value = await client.send(new ConverseCommand({ modelId: baseline!, system: [{ text: system }], messages: [{ role: "user", content: [{ text: prompt }] }], inferenceConfig: { maxTokens: warmup ? 32 : 2048 } }), { abortSignal: signal });
      text = value.output?.message?.content?.map(block => block.text ?? "").join("") ?? "";
      inputTokens = value.usage?.inputTokens ?? null;
      outputTokens = value.usage?.outputTokens ?? null;
      finishReason = value.stopReason ?? "unknown";
    }
    const durationMs = Date.now() - started;
    const complete = ["stop", "end_turn", "stop_sequence"].includes(finishReason);
    const brief = warmup ? null : parseBrief(text);
    const result: DemoResult = {
      kind, model: kind === "specialist" ? "Fin-o1-14B" : baseline!.replace(/^(us|global)\./, ""),
      text, brief, durationMs, inputTokens, outputTokens, finishReason, complete, warmup,
      createdAt: new Date().toISOString(), requestId: randomUUID(),
      billing: kind === "specialist" ? "$0.5718 / active 5-minute window per model copy. Shared capacity; not a per-request price." : "Token-billed. Dollar cost is not calculated until this model's rates are configured and verified.",
      ...evaluateBrief(complete ? brief : null, warmup ? null : sample?.expected ?? null, document),
    };
    return reply(result);
  } catch (error) {
    const denied = (error as { name?: string }).name === "AccessDeniedException";
    return reply({ error: denied ? "AWS has not enabled this baseline for the current account or serving role." : signal.aborted ? "The run was stopped or timed out. Try a shorter excerpt." : "The model request failed. Check the provider connection and try again." }, denied ? 503 : signal.aborted ? 504 : 502);
  } finally { active--; client?.destroy(); }
}

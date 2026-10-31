import { createHash, timingSafeEqual } from "node:crypto";

export function demoAuthorized(request: Request, secret: string | undefined) {
  if (!secret || secret.length < 32) return false;
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

export function readDemoQuestion(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > 1000 || Buffer.byteLength(value) > 4000) {
    throw new Error("Use a question between 1 and 1,000 characters.");
  }
  return value.trim();
}

export async function readDemoBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Use a JSON request.");
  if (Number(request.headers.get("content-length")) > 24000) throw new Error("The document is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("A request body is required.");
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 24000) { await reader.cancel(); throw new Error("The document is too large."); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(parts).toString("utf8")) as Record<string, unknown>;
}

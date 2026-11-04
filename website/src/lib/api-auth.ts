import { createHash, timingSafeEqual } from "node:crypto";

type Environment = Record<string, string | undefined>;

// Caller keys are minted by backend/ops/keys.py as sk-sova-<48 hex>. Only the
// SHA-256 fingerprint is ever stored, in SOVA_API_KEY_HASHES (comma-separated
// hex digests); plaintext keys never live on the server.
const KEY_PATTERN = /^sk-sova-[0-9a-f]{48}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export type ApiKeyAuth = { keyId: string };

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// Compare the presented digest against every stored fingerprint in constant
// time, without short-circuiting on a match.
function matchesFingerprint(digest: string, stored: string[]) {
  const presented = Buffer.from(digest, "hex");
  let matched = false;
  for (const expected of stored) {
    const candidate = Buffer.from(expected, "hex");
    if (candidate.length === presented.length && timingSafeEqual(candidate, presented)) matched = true;
  }
  return matched;
}

// Returns a metering label (first 8 hex chars of the key fingerprint) or null
// when unauthenticated. Fingerprint sources, in order: the database store
// (passed in by the caller from a 60s cache), the SOVA_API_KEY_HASHES env
// fallback, and the legacy single shared key (SOVA_API_KEY), which keeps
// working unchanged alongside them.
export function authenticate(request: Request, env: Environment, storeFingerprints?: string[]): ApiKeyAuth | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  const digest = fingerprint(token);
  const stored = [...(storeFingerprints ?? []),
    ...(env.SOVA_API_KEY_HASHES ?? "").split(",")]
    .map((value) => value.trim().toLowerCase()).filter((value) => DIGEST_PATTERN.test(value));
  if (KEY_PATTERN.test(token) && matchesFingerprint(digest, stored)) {
    return { keyId: digest.slice(0, 8) };
  }
  if (env.SOVA_API_KEY && env.SOVA_API_KEY.length >= 32
    && timingSafeEqual(Buffer.from(fingerprint(header), "hex"), Buffer.from(fingerprint(`Bearer ${env.SOVA_API_KEY}`), "hex"))) {
    return { keyId: digest.slice(0, 8) };
  }
  return null;
}

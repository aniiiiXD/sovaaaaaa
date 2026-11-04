/**
 * Admin gate primitives. Plain server module, not "use server": it exports
 * constants and sync helpers, which "use server" files cannot do. Imported
 * only by page.tsx and actions.ts, never by client components.
 *
 * Contract: ADMIN_PASSWORD is the single shared admin secret. The session
 * cookie holds sha256(ADMIN_PASSWORD + "sova-admin-v1"), so the cookie value
 * never contains the password, and the password never appears client-side.
 * Every action and page render re-verifies the cookie the same way the login
 * action sets it: timingSafeEqual over sha256 digests.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sova_admin";

// 7 days, matching the cookie maxAge set at login.
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// The exact cookie value a valid session must carry, or null when the
// deployment has no ADMIN_PASSWORD and the gate stays shut.
function cookieToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return sha256Hex(password + "sova-admin-v1");
}

export function adminCookie(): { name: string; value: string; maxAge: number } | null {
  const value = cookieToken();
  return value ? { name: ADMIN_COOKIE, value, maxAge: COOKIE_MAX_AGE_S } : null;
}

// Login check per the gate contract: compare sha256(provided) against
// sha256(ADMIN_PASSWORD) in constant time.
export function verifyAdminPassword(provided: string): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const a = Buffer.from(sha256Hex(provided), "hex");
  const b = Buffer.from(sha256Hex(password), "hex");
  return timingSafeEqual(a, b);
}

// Re-verified on every action and page render. Both sides are hashed again
// before the compare so it always runs over two fixed-length 32-byte digests.
export async function isAdminAuthed(): Promise<boolean> {
  const expected = cookieToken();
  if (!expected) return false;
  const provided = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!provided) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(provided).digest();
  return timingSafeEqual(a, b);
}

/**
 * Shared shape and constants for the portal. Kept out of the "use server"
 * module because every export there must be an async function.
 * Mirrors src/lib/inquiry.ts.
 */

export const PORTAL_COOKIE = "sova_portal";

// The cookie carries the customer's own plaintext key so the server can look
// it up by fingerprint on every render: httpOnly, secure in production,
// sameSite lax, 7 days. It only travels back to our server over HTTPS, and
// the database stores only its SHA-256 fingerprint, never the plaintext.
export const PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type PortalLoginState = {
  ok: boolean;
  error: string;
};

export const initialPortalLoginState: PortalLoginState = {
  ok: false,
  error: "",
};

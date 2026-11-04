"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPortalStore } from "@/lib/portal-store";
import {
  PORTAL_COOKIE,
  PORTAL_COOKIE_MAX_AGE,
  type GenerateKeyState,
  type PortalLoginState,
} from "./state";

// Self-serve and ops-minted keys share one shape: sk-sova- plus 48 hex
// characters, the same shape the inference API authenticates against.
const KEY_PATTERN = /^sk-sova-[0-9a-f]{48}$/;

function revalidateConsole(): void {
  revalidatePath("/portal");
  revalidatePath("/portal/usage");
  revalidatePath("/portal/keys");
}

export async function portalLoginAction(
  _prev: PortalLoginState,
  formData: FormData,
): Promise<PortalLoginState> {
  const key = String(formData.get("key") ?? "").trim();

  if (!KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error:
        "That key doesn't look right. SOVA keys read sk-sova- plus 48 hex characters.",
    };
  }

  const row = await getPortalStore(process.env).findByKey(key);
  if (!row) {
    return { ok: false, error: "That key is not active. Contact Sova to get one." };
  }

  const jar = await cookies();
  jar.set(PORTAL_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_COOKIE_MAX_AGE,
  });
  revalidateConsole();
  return { ok: true, error: "" };
}

export async function portalSignOutAction(): Promise<void> {
  (await cookies()).delete(PORTAL_COOKIE);
  revalidateConsole();
}

// The caller must hold an active key. The new key is minted alongside it and
// its plaintext is returned exactly once, in this response only; the store
// keeps just the fingerprint.
export async function generateKeyAction(formData: FormData): Promise<GenerateKeyState> {
  const jar = await cookies();
  const current = jar.get(PORTAL_COOKIE)?.value ?? "";
  const row = current ? await getPortalStore(process.env).findByKey(current) : null;
  if (!row) {
    return {
      status: "error",
      key: "",
      keyId: "",
      error: "Your session ended. Sign in again to generate keys.",
    };
  }

  const alias = String(formData.get("alias") ?? "").trim().slice(0, 80) || "unnamed";
  const { key, keyId } = await getPortalStore(process.env).generateKey(alias);
  revalidateConsole();
  return { status: "ok", key, keyId, error: "" };
}

export async function revokeKeyAction(formData: FormData): Promise<void> {
  const jar = await cookies();
  const current = jar.get(PORTAL_COOKIE)?.value ?? "";
  const row = current ? await getPortalStore(process.env).findByKey(current) : null;
  if (!row) return;

  const keyId = String(formData.get("keyId") ?? "").trim();
  if (!keyId) return;

  await getPortalStore(process.env).revokeKey(keyId);
  revalidateConsole();
}

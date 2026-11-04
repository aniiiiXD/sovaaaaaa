"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getPortalStore } from "@/lib/portal-store";
import {
  PORTAL_COOKIE,
  PORTAL_COOKIE_MAX_AGE,
  type PortalLoginState,
} from "./state";

// Minted by backend/ops/keys.py as sk-sova-<48 hex>, the same shape the
// inference API authenticates against (src/lib/api-auth.ts).
const KEY_PATTERN = /^sk-sova-[0-9a-f]{48}$/;

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
  revalidatePath("/portal");
  return { ok: true, error: "" };
}

export async function portalSignOutAction(): Promise<void> {
  (await cookies()).delete(PORTAL_COOKIE);
  revalidatePath("/portal");
}

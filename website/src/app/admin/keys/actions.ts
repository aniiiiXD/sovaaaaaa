"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getKeyStore, mintSecretKey } from "@/lib/keys-store";
import {
  ADMIN_COOKIE,
  adminConfigured,
  adminCookie,
  isAdminAuthed,
  verifyAdminPassword,
} from "./gate";
import type { LoginState, MintState } from "./state";

// Keeps free-typed labels from turning into table-busting strings.
const LABEL_MAX = 80;
const KEY_ID_PATTERN = /^[0-9a-f]{8}$/;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!adminConfigured()) {
    return {
      status: "error",
      message: "ADMIN_PASSWORD is not set on this deployment. Add it first.",
    };
  }
  const password = String(formData.get("password") ?? "");
  const cookie = adminCookie();
  if (!cookie || !verifyAdminPassword(password)) {
    return { status: "error", message: "Wrong password." };
  }
  (await cookies()).set(ADMIN_COOKIE, cookie.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: cookie.maxAge,
  });
  redirect("/admin/keys");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/keys");
}

export async function mintKeyAction(
  _prev: MintState,
  formData: FormData,
): Promise<MintState> {
  if (!adminConfigured()) {
    return { status: "error", message: "ADMIN_PASSWORD is not set. Minting is disabled." };
  }
  if (!(await isAdminAuthed())) {
    return { status: "error", message: "Session expired. Sign in again." };
  }

  const label = String(formData.get("label") ?? "").trim().slice(0, LABEL_MAX) || "unnamed";
  const { key, keyId, fingerprint } = mintSecretKey();

  try {
    await getKeyStore(process.env).insertKey(keyId, fingerprint, label);
  } catch (cause) {
    console.error("admin/keys: insert failed.", cause);
    return {
      status: "error",
      message: "Could not save the key. Nothing was minted; check the database and try again.",
    };
  }

  revalidatePath("/admin/keys");
  return { status: "ok", key, keyId };
}

export async function revokeKeyAction(formData: FormData): Promise<void> {
  if (!adminConfigured()) return;
  if (!(await isAdminAuthed())) return;

  const keyId = String(formData.get("keyId") ?? "").trim();
  if (!KEY_ID_PATTERN.test(keyId)) return;

  try {
    await getKeyStore(process.env).revokeKey(keyId);
  } catch (cause) {
    console.error("admin/keys: revoke failed.", cause);
  }

  revalidatePath("/admin/keys");
}

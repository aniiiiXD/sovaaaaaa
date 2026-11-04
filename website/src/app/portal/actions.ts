"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalStore } from "@/lib/portal-store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import {
  KEY_PATTERN,
  type GenerateKeyState,
  type LinkKeyState,
  type PortalAuthState,
} from "./state";

function revalidateConsole(): void {
  revalidatePath("/portal");
  revalidatePath("/portal/usage");
  revalidatePath("/portal/keys");
}

// Maps Supabase's raw error strings to inline copy the console already
// speaks: short, concrete, no em dashes. Unknown messages pass through.
function authErrorMessage(message: string): string {
  const raw = message.toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return "Wrong email or password. Try again.";
  }
  if (raw.includes("email not confirmed")) {
    return "Check your inbox to confirm your email first.";
  }
  if (raw.includes("over_request_rate_limit") || raw.includes("rate limit") || raw.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (raw.includes("already registered") || raw.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (raw.includes("password should be at least")) {
    return "That password is too short. Use at least 6 characters.";
  }
  if (raw.includes("unable to validate email") || raw.includes("invalid email") || raw.includes("is invalid")) {
    return "That email address doesn't look valid.";
  }
  if (raw.includes("failed to fetch") || raw.includes("fetch failed")) {
    return "Could not reach the account service. Try again in a moment.";
  }
  return message || "Something went wrong. Try again.";
}

function readCredentials(formData: FormData): { email: string; password: string; problem: string } {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !email.includes("@")) {
    return { email, password, problem: "Enter a valid email address." };
  }
  if (!password) {
    return { email, password, problem: "Enter your password." };
  }
  return { email, password, problem: "" };
}

export async function portalSignInAction(
  _prev: PortalAuthState,
  formData: FormData,
): Promise<PortalAuthState> {
  const { email, password, problem } = readCredentials(formData);
  if (problem) return { ok: false, error: problem, notice: "" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Accounts are not configured yet.", notice: "" };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: authErrorMessage(error.message), notice: "" };

  revalidateConsole();
  redirect("/portal");
}

export async function portalSignUpAction(
  _prev: PortalAuthState,
  formData: FormData,
): Promise<PortalAuthState> {
  const { email, password, problem } = readCredentials(formData);
  if (problem) return { ok: false, error: problem, notice: "" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Accounts are not configured yet.", notice: "" };
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: authErrorMessage(error.message), notice: "" };

  // Email confirmation is on server side: no session comes back until the
  // confirmation link is clicked. Say so instead of pretending success.
  if (!data.session) {
    return { ok: false, error: "", notice: "Check your inbox to confirm your email first." };
  }

  revalidateConsole();
  redirect("/portal");
}

export async function portalSignOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  revalidateConsole();
  redirect("/portal/login");
}

// The caller must hold a live session. The new key is minted under the
// signed-in account and its plaintext is returned exactly once, in this
// response only; the store keeps just the fingerprint.
export async function generateKeyAction(formData: FormData): Promise<GenerateKeyState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      key: "",
      keyId: "",
      error: "Your session ended. Sign in again to generate keys.",
    };
  }

  const alias = String(formData.get("alias") ?? "").trim().slice(0, 80) || "unnamed";
  const { key, keyId } = await getPortalStore(process.env).generateKey(alias, user.id);
  revalidateConsole();
  return { status: "ok", key, keyId, error: "" };
}

// Claims an operator-issued key into the signed-in account. The store only
// accepts keys that are active and still unowned, so a wrong or already
// linked key lands here as a plain error line.
export async function linkKeyAction(
  _prev: LinkKeyState,
  formData: FormData,
): Promise<LinkKeyState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Your session ended. Sign in again." };
  }

  const key = String(formData.get("key") ?? "").trim();
  if (!KEY_PATTERN.test(key)) {
    return {
      status: "error",
      message: "That key doesn't look right. SOVA keys read sk-sova- plus 48 hex characters.",
    };
  }

  const row = await getPortalStore(process.env).linkKey(key, user.id);
  if (!row) {
    return { status: "error", message: "Key not found or already linked." };
  }

  revalidateConsole();
  return { status: "ok", message: "Key linked." };
}

export async function revokeKeyAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const keyId = String(formData.get("keyId") ?? "").trim();
  if (!keyId) return;

  await getPortalStore(process.env).revokeKey(keyId, user.id);
  revalidateConsole();
}

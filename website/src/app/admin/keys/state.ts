/**
 * Shared shapes for the admin server actions. Kept out of the "use server"
 * module because every export there must be an async function. No server-only
 * imports: client components read these types and initial values directly.
 */

export type LoginState = {
  status: "idle" | "error";
  message: string;
};

export const initialLoginState: LoginState = { status: "idle", message: "" };

export type MintState =
  | { status: "idle" }
  | { status: "error"; message: string }
  // ok carries the plaintext key. It exists exactly once, in this state,
  // until the user dismisses it or navigates away.
  | { status: "ok"; key: string; keyId: string };

export const initialMintState: MintState = { status: "idle" };

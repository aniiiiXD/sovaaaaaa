/**
 * Browser-side Supabase client for client components that need direct auth
 * access (the current console flows all run through server actions, so this
 * factory is a spare). Returns null when the env vars are unset, mirroring
 * the server factory's "not configured" contract.
 */

import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseConfig } from "./config";

export type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>;

export function createSupabaseBrowserClient(): SupabaseBrowserClient | null {
  const config = readSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}

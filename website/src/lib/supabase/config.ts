/**
 * Supabase environment guard. Accounts stay optional: when the env vars are
 * missing the portal falls back to friendly "not configured" states instead
 * of throwing, and nothing else on the site is affected.
 */

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export const SUPABASE_URL_ENV = "SUPABASE_URL";
export const SUPABASE_ANON_KEY_ENV = "SUPABASE_ANON_KEY";

/**
 * Returns the Supabase project settings, or null when either variable is
 * unset. Trims whitespace so a stray space in a paste does not break auth.
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  const url = process.env[SUPABASE_URL_ENV]?.trim();
  const anonKey = process.env[SUPABASE_ANON_KEY_ENV]?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Synchronous "are accounts live?" check for gates and banners. */
export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== null;
}

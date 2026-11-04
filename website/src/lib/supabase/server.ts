/**
 * Cookie-bound Supabase client for the server: works in Server Components
 * (read-only cookies) and Server Actions / Route Handlers (cookies writable),
 * so @supabase/ssr can persist refreshed session tokens. Returns null when
 * SUPABASE_URL / SUPABASE_ANON_KEY are unset; callers must handle that as
 * "accounts are not configured", never as an exception.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfig } from "./config";

export type SupabaseServerClient = ReturnType<typeof createServerClient>;

export async function createSupabaseServerClient(): Promise<SupabaseServerClient | null> {
  const config = readSupabaseConfig();
  if (!config) return null;

  const jar = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            jar.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The session-refresh
          // middleware is the one that persists rotated tokens; a failed
          // write here only means the render stays on the old token.
        }
      },
    },
  });
}

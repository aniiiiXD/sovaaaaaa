/**
 * Supabase session refresh for the portal only. The matcher is deliberately
 * narrow: the marketing site, /docs, and /api/* never pass through here.
 * The job is token rotation: when the access token is expired, this call
 * refreshes it and copies the new cookies onto the response. Gate and
 * redirect logic live in the portal layout, not here.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY_ENV, SUPABASE_URL_ENV } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env[SUPABASE_URL_ENV]?.trim();
  const anonKey = process.env[SUPABASE_ANON_KEY_ENV]?.trim();
  // Accounts not configured: nothing to refresh, let the request pass.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not run anything between the client setup and this call: it is what
  // triggers the refresh when the stored access token has gone stale.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/portal/:path*"],
};

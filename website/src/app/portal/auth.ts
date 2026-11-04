import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PortalUser = {
  id: string;
  email: string;
};

/**
 * Reads the Supabase session on the server and returns the signed-in user,
 * or null when signed out or when accounts are not configured. cache()
 * dedupes the auth call so the layout, the active page, and any server
 * action in the same request share one lookup.
 */
export const getCurrentUser = cache(async (): Promise<PortalUser | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  return { id: user.id, email: user.email ?? "" };
});

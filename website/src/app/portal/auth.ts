import { cache } from "react";
import { cookies } from "next/headers";
import { getPortalStore, type PortalKeyRow } from "@/lib/portal-store";
import { PORTAL_COOKIE } from "./state";

/**
 * Reads the portal cookie and verifies it against the store on every render.
 * cache() dedupes the lookup so the layout and the active page share one
 * store query per request.
 */
export const getPortalAuth = cache(
  async (): Promise<{ key: string; row: PortalKeyRow | null }> => {
    const jar = await cookies();
    const key = jar.get(PORTAL_COOKIE)?.value ?? "";
    if (!key) return { key: "", row: null };
    const row = await getPortalStore(process.env).findByKey(key);
    return { key, row };
  },
);

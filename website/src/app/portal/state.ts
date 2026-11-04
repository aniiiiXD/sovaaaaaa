/**
 * Shared shapes, constants, and pure helpers for the customer console.
 * Kept out of the "use server" module because every export there must be
 * an async function. Mirrors src/lib/inquiry.ts.
 */

import type { UsagePoint } from "@/lib/portal-store";

export const PORTAL_COOKIE = "sova_portal";

// The cookie carries the customer's own plaintext key so the server can look
// it up by fingerprint on every render: httpOnly, secure in production,
// sameSite lax, 7 days. It only travels back to our server over HTTPS, and
// the database stores only its SHA-256 fingerprint, never the plaintext.
export const PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

// Console feedback goes straight to the founder's inbox.
export const FEEDBACK_MAILTO = "mailto:aniruddh302004@gmail.com";

/* --------------------------- server-action states --------------------------- */

export type PortalLoginState = {
  ok: boolean;
  error: string;
};

export const initialPortalLoginState: PortalLoginState = {
  ok: false,
  error: "",
};

export type GenerateKeyState = {
  status: "idle" | "ok" | "error";
  key: string;
  keyId: string;
  error: string;
};

export const initialGenerateKeyState: GenerateKeyState = {
  status: "idle",
  key: "",
  keyId: "",
  error: "",
};

/* ----------------------------- range + model params ----------------------------- */

// Time ranges the console offers; the store keeps 30 days of history.
export const RANGE_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_RANGE: number = 14;

export function parseRange(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return (RANGE_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_RANGE;
}

export function parseModel(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

/* --------------------------------- formatting --------------------------------- */

// Only a prefix and the last 4 hex characters render: enough to recognise
// the key, not to reuse it.
export function maskKey(key: string): string {
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

// Compact numbers for chart axes and stat sub-lines: 940, 12.3k, 4.2M.
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${trimOne(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `${trimOne(n / 1_000)}k`;
  return String(Math.round(n));
}

function trimOne(n: number): string {
  const s = Math.abs(n) >= 100 ? Math.round(n).toString() : n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

// Share of ok requests, one decimal ("99.4%"). Callers handle the empty case.
export function successRate(ok: number, requests: number): string {
  return `${((ok / requests) * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

// All timestamps render as UTC strings so the page is identical no matter
// which region serves it.
const DATE_UTC = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME_UTC = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateUTC(date: Date): string {
  return `${DATE_UTC.format(date)} UTC`;
}

export function formatDateTimeUTC(date: Date): string {
  return `${DATETIME_UTC.format(date)} UTC`;
}

/* ------------------------------ series helpers ------------------------------ */

export type UsageRow = {
  day: string; // YYYY-MM-DD UTC
  requests: number;
  ok: number;
  fail: number;
  promptTokens: number;
  completionTokens: number;
};

// "2026-11-04" → "04", the day number used as the chart x-axis label.
export function dayLabel(day: string): string {
  return day.slice(8);
}

// dailySeries() only returns days that saw traffic, so every chart and table
// zero-fills the gaps and keeps all columns aligned to real UTC dates,
// oldest first.
export function zeroFillDays(rows: UsagePoint[], days: number): UsageRow[] {
  const byDay = new Map(rows.map((row) => [row.day, row] as const));
  const now = new Date();
  const filled: UsageRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    const day = date.toISOString().slice(0, 10);
    const row = byDay.get(day);
    filled.push({
      day,
      requests: row?.requests ?? 0,
      ok: row?.ok ?? 0,
      fail: row?.fail ?? 0,
      promptTokens: row?.promptTokens ?? 0,
      completionTokens: row?.completionTokens ?? 0,
    });
  }
  return filled;
}

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { BOOKING_URL } from "@/lib/site";
import {
  getPortalStore,
  type PortalKeyRow,
  type UsageDay,
} from "@/lib/portal-store";
import PortalLoginForm from "./login-form";
import CopyKeyButton from "./copy-key-button";
import { portalSignOutAction } from "./actions";
import { PORTAL_COOKIE } from "./state";

export const metadata: Metadata = {
  title: "SOVA · API usage portal",
  description:
    "Your SOVA API usage: total requests, tokens in and out, and daily traffic for the last 14 days.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* ------------------------------ helpers ------------------------------ */

const USAGE_WINDOW = 14;

// The key lives in the customer's own cookie; only a prefix and the last 4
// hex characters are rendered, enough to recognise the key, not to reuse it.
function maskKey(key: string): string {
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}

// All timestamps render as UTC strings so the page is identical no matter
// which region serves it.
const DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const DATETIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(date: Date): string {
  return `${DATE.format(date)} UTC`;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

type SeriesDay = {
  day: string; // YYYY-MM-DD
  label: string; // day of month, for the axis row
  requests: number;
  tokens: number;
};

// usageDays() only returns days that saw traffic, so the chart fills the
// gaps with zero days and keeps all 14 columns aligned to real dates.
function buildSeries(rows: UsageDay[], days: number): SeriesDay[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const now = new Date();
  const series: SeriesDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    const day = date.toISOString().slice(0, 10);
    const row = byDay.get(day);
    series.push({
      day,
      label: String(date.getUTCDate()).padStart(2, "0"),
      requests: row?.requests ?? 0,
      tokens: (row?.promptTokens ?? 0) + (row?.completionTokens ?? 0),
    });
  }
  return series;
}

/* ------------------------------ sections ------------------------------ */

const FACTS = [
  "Keys are issued by Sova. Book a call and we mint one for your workload.",
  "Verified server side. Our database stores only a SHA-256 fingerprint of your key.",
  "Read-only by design. This portal reports usage. It cannot call models or spend tokens.",
];

function LoggedOut() {
  return (
    <section className="relative overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
      <div className="container-x relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-16">
        <div>
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden /> Customer portal
          </p>
          <h1 className="display mt-5 max-w-[16ch] text-[clamp(2.4rem,5.2vw,3.8rem)] text-[var(--ink)]">
            Your usage, measured.
          </h1>
          <p className="lead mt-6 max-w-lg">
            Paste your SOVA API key to see your live numbers: total requests,
            tokens in and out, and daily traffic for the last {USAGE_WINDOW}{" "}
            days.
          </p>
          <ul className="mt-9 max-w-lg space-y-3">
            {FACTS.map((fact, i) => (
              <li
                key={fact}
                className="mono flex items-start gap-2.5 text-sm leading-relaxed text-[var(--muted)]"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full"
                  style={{ background: i === 0 ? "var(--signal)" : "var(--pine)" }}
                  aria-hidden
                />
                {fact}
              </li>
            ))}
          </ul>
          <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost mt-10">
            Book a call to get a key
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="max-w-xl">
          <PortalLoginForm />
        </div>
      </div>
    </section>
  );
}

// The cookie names a key the store no longer knows: revoked, replaced, or
// from a database that has since been reset. Never render stats for it.
function InactiveKey() {
  return (
    <section>
      <div className="container-x max-w-2xl py-12 sm:py-20">
        <p className="eyebrow">
          <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
          Customer portal
        </p>
        <h1 className="display mt-5 text-[clamp(2.2rem,4.6vw,3.2rem)] text-[var(--ink)]">
          This key is no longer active.
        </h1>
        <p className="lead mt-6">
          The key saved in this browser was revoked or replaced. Your usage
          history stays with Sova. Sign out, then sign in with a current key.
        </p>
        <form action={portalSignOutAction} className="mt-9">
          <button type="submit" className="btn btn-primary">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}

function StatCell({
  value,
  caption,
  small = false,
}: {
  value: string;
  caption: string;
  small?: boolean;
}) {
  return (
    <div className="bg-[var(--paper-2)] p-6 lg:p-7">
      <p
        className={`display text-[var(--ink)] ${
          small ? "text-[clamp(1.25rem,1.9vw,1.8rem)]" : "text-[clamp(1.9rem,3vw,2.6rem)]"
        }`}
      >
        {value}
      </p>
      <p className="mono mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
        {caption}
      </p>
    </div>
  );
}

// CSS-only bars. Requests are the primary series in ink; tokens are the
// muted second series above them, each scaled to its own daily maximum.
function UsageChart({ series }: { series: SeriesDay[] }) {
  const totalRequests = series.reduce((sum, d) => sum + d.requests, 0);
  const totalTokens = series.reduce((sum, d) => sum + d.tokens, 0);
  const maxRequests = Math.max(...series.map((d) => d.requests), 1);
  const maxTokens = Math.max(...series.map((d) => d.tokens), 1);
  const peak = series.reduce((best, d) => (d.requests > best.requests ? d : best), series[0]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-[var(--ink)]">Last {USAGE_WINDOW} days</h2>
        <span className="mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--faint)]">
          requests per day · UTC
        </span>
      </div>

      {totalRequests === 0 ? (
        <p className="mono mt-8 text-sm text-[var(--muted)]">
          No traffic in the last {USAGE_WINDOW} days.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Daily requests for the last ${USAGE_WINDOW} days: ${totalRequests.toLocaleString("en-US")} total, peak of ${peak.requests.toLocaleString("en-US")} on ${peak.day}.`}
            className="mt-6 flex items-end gap-1 sm:gap-2"
          >
            {series.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.requests.toLocaleString("en-US")} requests, ${compact(d.tokens)} tokens in + out`}
                className="flex min-w-0 flex-1 flex-col justify-end gap-1"
              >
                {d.tokens > 0 && (
                  <div
                    className="rounded-t-[3px] bg-[var(--line-3)]"
                    style={{ height: Math.max(4, Math.round((d.tokens / maxTokens) * 40)) }}
                  />
                )}
                {d.requests > 0 && (
                  <div
                    className="rounded-t-[3px] bg-[var(--ink)]"
                    style={{ height: Math.max(6, Math.round((d.requests / maxRequests) * 72)) }}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1 sm:gap-2" aria-hidden>
            {series.map((d) => (
              <span
                key={d.day}
                className="mono min-w-0 flex-1 text-center text-[0.6rem] leading-none text-[var(--faint)]"
              >
                {d.label}
              </span>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--line)] pt-4">
            <span className="mono inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-sm bg-[var(--ink)]" aria-hidden /> requests
            </span>
            <span className="mono inline-flex items-center gap-2 text-xs text-[var(--muted)]">
              <span className="h-1.5 w-1.5 rounded-sm bg-[var(--line-3)]" aria-hidden /> tokens in + out
            </span>
            <span className="mono ml-auto text-xs text-[var(--muted)]">
              {totalRequests.toLocaleString("en-US")} requests · {compact(totalTokens)} tokens over{" "}
              {USAGE_WINDOW} days
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Dashboard({
  row,
  apiKey,
  series,
}: {
  row: PortalKeyRow;
  apiKey: string;
  series: SeriesDay[];
}) {
  return (
    <section className="container-x pb-16 pt-12 sm:pb-20 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
        <div>
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden /> Customer portal
          </p>
          <h1 className="display mt-5 text-[clamp(2.2rem,4.6vw,3.2rem)] text-[var(--ink)]">
            API usage
          </h1>
          <p className="mono mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
            <span className="text-[var(--ink)]">{row.label}</span>
            <span className="text-[var(--faint)]" aria-hidden>
              ·
            </span>
            <span>{maskKey(apiKey)}</span>
          </p>
        </div>
        <form action={portalSignOutAction}>
          <button type="submit" className="btn btn-ghost">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        <StatCell
          value={row.totalRequests.toLocaleString("en-US")}
          caption="Total requests · all time"
        />
        <StatCell
          value={row.totalPromptTokens.toLocaleString("en-US")}
          caption="Tokens in · all time"
        />
        <StatCell
          value={row.totalCompletionTokens.toLocaleString("en-US")}
          caption="Tokens out · all time"
        />
        <StatCell
          small
          value={row.lastUsedAt ? DATETIME.format(row.lastUsedAt) : "Never"}
          caption="Last used · UTC"
        />
      </div>

      <div className="mt-6">
        <UsageChart series={series} />
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
        <div className="bg-[var(--paper-2)] p-6">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
            Created · UTC
          </p>
          <p className="mt-2 font-display text-lg text-[var(--ink)]">{formatDate(row.createdAt)}</p>
        </div>
        <div className="bg-[var(--paper-2)] p-6">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
            Status
          </p>
          <p className="mt-2">
            {row.revokedAt ? (
              <span className="tag">revoked</span>
            ) : (
              <span className="tag tag--live">
                <span className="signal-dot" aria-hidden /> active
              </span>
            )}
          </p>
        </div>
        <div className="bg-[var(--paper-2)] p-6">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
            Key id · safe to share
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3">
            <span className="mono text-sm text-[var(--ink)]">{row.keyId}</span>
            <CopyKeyButton value={row.keyId} />
          </p>
        </div>
      </div>
    </section>
  );
}

// No DATABASE_URL: the in-memory store answers, and the numbers reset on
// every restart or cold start. Say so instead of implying durability.
function EphemeralBanner() {
  return (
    <div className="border-b border-[var(--line)] bg-[var(--paper-2)]">
      <div className="container-x flex items-center gap-3 py-3">
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--signal)]" aria-hidden />
        <p className="mono text-sm text-[var(--muted)]">
          Usage tracking is running in ephemeral mode.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

export default async function PortalPage() {
  const jar = await cookies();
  const apiKey = jar.get(PORTAL_COOKIE)?.value ?? "";

  const ephemeral = !process.env.DATABASE_URL;
  const store = getPortalStore(process.env);

  const row = apiKey ? await store.findByKey(apiKey) : null;
  const series = row
    ? buildSeries(await store.usageDays(row.keyId, USAGE_WINDOW), USAGE_WINDOW)
    : [];

  return (
    <main id="top">
      <Nav />
      <div className="pt-16">
        {ephemeral && <EphemeralBanner />}
        {row ? (
          <Dashboard row={row} apiKey={apiKey} series={series} />
        ) : apiKey ? (
          <InactiveKey />
        ) : (
          <LoggedOut />
        )}
      </div>
      <Footer />
    </main>
  );
}

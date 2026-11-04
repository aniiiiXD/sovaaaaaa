"use client";

import type { ApiKeyRow } from "@/lib/keys-store";
import { revokeKeyAction } from "./actions";
import CopyButton from "./copy-button";

const nf = new Intl.NumberFormat("en-US");

// Fixed UTC dates and a fixed locale for numbers, so server and client
// renders agree and hydration never mismatches.
function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "never";
}

function StatusTag({ row }: { row: ApiKeyRow }) {
  if (row.revokedAt) {
    return <span className="tag">revoked</span>;
  }
  return (
    <span className="tag tag--live">
      <span className="signal-dot" aria-hidden /> active
    </span>
  );
}

function RevokeButton({ row }: { row: ApiKeyRow }) {
  return (
    <form
      action={revokeKeyAction}
      onSubmit={(e) => {
        const ok = window.confirm(
          `Revoke key ${row.keyId} (${row.label})? Requests signed with it stop working within 60 seconds.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="keyId" value={row.keyId} />
      <button
        type="submit"
        className="mono text-xs uppercase tracking-[0.1em] text-[var(--signal)] underline-offset-4 transition-colors hover:underline"
      >
        Revoke
      </button>
    </form>
  );
}

export default function KeysTable({ rows }: { rows: ApiKeyRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
      <table className="w-full min-w-[880px] border-collapse bg-[var(--paper-2)] text-left">
        <thead>
          <tr className="mono text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            <th className="p-4 font-medium">Label</th>
            <th className="p-4 font-medium">Key ID</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Created</th>
            <th className="p-4 font-medium">Last used</th>
            <th className="p-4 text-right font-medium">Requests</th>
            <th className="p-4 text-right font-medium">Tokens (in+out)</th>
            <th className="p-4 font-medium" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-[var(--line)]">
              <td colSpan={8} className="mono p-8 text-center text-sm text-[var(--muted)]">
                No keys yet. Mint the first one below.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.keyId}
              className={`border-t border-[var(--line)] ${row.revokedAt ? "text-[var(--faint)]" : "text-[var(--ink)]"}`}
            >
              <td className="p-4">
                <span className={`text-sm ${row.revokedAt ? "" : "font-medium"}`}>{row.label}</span>
              </td>
              <td className="p-4">
                <span className="mono inline-flex items-center gap-2 text-sm">
                  {row.keyId}
                  <CopyButton
                    value={row.keyId}
                    variant="ghost-compact"
                    ariaLabel={`Copy key ID ${row.keyId}`}
                  />
                </span>
              </td>
              <td className="p-4">
                <StatusTag row={row} />
              </td>
              <td className="mono p-4 text-sm tabular-nums">{fmtDate(row.createdAt)}</td>
              <td className="mono p-4 text-sm tabular-nums">{fmtDate(row.lastUsedAt)}</td>
              <td className="mono p-4 text-right text-sm tabular-nums">{nf.format(row.totalRequests)}</td>
              <td className="mono p-4 text-right text-sm tabular-nums">
                {nf.format(row.totalPromptTokens + row.totalCompletionTokens)}
              </td>
              <td className="p-4">{row.revokedAt ? null : <RevokeButton row={row} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

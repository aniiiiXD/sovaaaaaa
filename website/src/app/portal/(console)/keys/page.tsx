import type { Metadata } from "next";
import { getPortalStore } from "@/lib/portal-store";
import { getCurrentUser } from "../../auth";
import CopyKeyButton from "../../copy-key-button";
import GenerateKey from "../../generate-key";
import LinkKeyForm from "../../link-key-form";
import RevokeButton from "../../revoke-button";
import { PageHeader } from "../../ui";
import { formatDateUTC, formatDateTimeUTC } from "../../state";

export const metadata: Metadata = {
  title: "SOVA · API keys",
  description: "Generate, link, and revoke SOVA API keys on your account.",
};

export default async function PortalKeysPage() {
  const user = await getCurrentUser();
  if (!user) return null; // the layout already rendered the auth gate

  const keys = await getPortalStore(process.env).listKeys(user.id);
  const activeCount = keys.filter((k) => !k.revokedAt).length;

  return (
    <div>
      <PageHeader title="API keys">
        <p className="mono text-sm text-[var(--muted)]">
          Keys belong to your account. Secret is shown once.
        </p>
      </PageHeader>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:items-stretch">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
          <p className="mono text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
            My keys
          </p>
          <p className="display mt-3 text-[clamp(1.7rem,2.8vw,2.4rem)] text-[var(--ink)]">
            {keys.length}
          </p>
          <p className="mono mt-2 min-h-[1.1rem] text-xs text-[var(--muted)]">
            {activeCount} active · {keys.length - activeCount} revoked
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <GenerateKey />
          <LinkKeyForm />
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="well mt-6 p-8">
          <p className="mono text-sm text-[var(--muted)]">
            No keys yet. Generate your first key above.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full min-w-[760px] border-collapse bg-[var(--paper-2)] text-left">
            <thead>
              <tr className="mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                <th scope="col" className="px-5 py-3.5 font-medium">Alias</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Key id</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Status</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Created</th>
                <th scope="col" className="px-5 py-3.5 font-medium">Last used</th>
                <th scope="col" className="px-5 py-3.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.keyId} className="border-t border-[var(--line)]">
                  <td className="px-5 py-4">
                    <span
                      className={`text-sm ${k.revokedAt ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}
                    >
                      {k.label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {/* The key id is not secret: it is the first 8 hex chars
                        of the key's fingerprint, safe to quote in support. */}
                    <span className="flex items-center gap-2.5">
                      <span className="mono text-sm text-[var(--muted)]">{k.keyId}</span>
                      <CopyKeyButton value={k.keyId} />
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {k.revokedAt ? (
                      <span className="tag">revoked</span>
                    ) : (
                      <span className="tag tag--live">
                        <span className="signal-dot" aria-hidden /> active
                      </span>
                    )}
                  </td>
                  <td className="mono px-5 py-4 text-sm text-[var(--muted)]">
                    {formatDateUTC(k.createdAt)}
                  </td>
                  <td className="mono px-5 py-4 text-sm text-[var(--muted)]">
                    {k.lastUsedAt ? formatDateTimeUTC(k.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {k.revokedAt ? null : <RevokeButton keyId={k.keyId} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mono mt-4 text-xs text-[var(--faint)]">
        Secrets are stored only as SHA-256 fingerprints. A revoked key stops working immediately.
      </p>
    </div>
  );
}

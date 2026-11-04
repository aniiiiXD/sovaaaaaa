import type { Metadata } from "next";
import { getPortalStore } from "@/lib/portal-store";
import { getCurrentUser } from "../../auth";
import ModelFilter from "../../model-filter";
import { EmptyState, PageHeader, RangeLinks } from "../../ui";
import { parseModel, parseRange, zeroFillDays, type UsageRow } from "../../state";

export const metadata: Metadata = {
  title: "SOVA · Usage",
  description: "Day-by-day SOVA API usage: requests, successes, failures, and tokens.",
};

export default async function PortalUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[]; model?: string | string[] }>;
}) {
  const params = await searchParams;
  const days = parseRange(params.days);
  const requestedModel = parseModel(params.model);

  const user = await getCurrentUser();
  if (!user) return null; // the layout already rendered the auth gate

  const store = getPortalStore(process.env);

  // Account-scoped: every key on the account contributes to this table.
  const keys = await store.listKeys(user.id);

  if (keys.length === 0) {
    return (
      <div>
        <PageHeader title="Usage">
          <p className="mono text-sm text-[var(--muted)]">{user.email}</p>
        </PageHeader>
        <div className="mt-8">
          <EmptyState
            title="No keys yet. Generate your first key."
            body="Requests land here day by day once your integration runs. Generate a key first, then point the docs' quickstart at it."
            linkHref="/portal/keys"
            linkLabel="Go to API keys"
          />
        </div>
      </div>
    );
  }

  const models = await store.modelStats(user.id, days);
  const model =
    requestedModel && models.some((m) => m.model === requestedModel) ? requestedModel : null;

  const series = await store.dailySeries(user.id, days, model);

  // Every day in the window appears, even the quiet ones; newest first so
  // the recent days are the ones you never scroll for.
  const rows: UsageRow[] = [...zeroFillDays(series, days)].reverse();
  const totals = rows.reduce(
    (acc, r) => ({
      requests: acc.requests + r.requests,
      ok: acc.ok + r.ok,
      fail: acc.fail + r.fail,
      promptTokens: acc.promptTokens + r.promptTokens,
      completionTokens: acc.completionTokens + r.completionTokens,
    }),
    { requests: 0, ok: 0, fail: 0, promptTokens: 0, completionTokens: 0 },
  );

  return (
    <div>
      <PageHeader title="Usage">
        <p className="mono text-sm text-[var(--muted)]">
          Day-by-day traffic for the last {days} days{model ? `, ${model} only` : ""}, across all
          of your keys.
        </p>
      </PageHeader>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <RangeLinks basePath="/portal/usage" days={days} model={model} />
        <ModelFilter
          models={models.map((m) => m.model)}
          value={model}
          days={days}
          basePath="/portal/usage"
        />
      </div>

      {totals.requests === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No traffic yet."
            body="Requests land here day by day once your integration runs. The docs walk through your first call."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--line)]">
            <table className="w-full min-w-[680px] border-collapse bg-[var(--paper-2)] text-left">
              <thead>
                <tr className="mono text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                  <th scope="col" className="px-5 py-3.5 font-medium">Day</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Requests</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Ok</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Failed</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Tokens in</th>
                  <th scope="col" className="px-5 py-3.5 text-right font-medium">Tokens out</th>
                </tr>
              </thead>
              <tbody className="mono text-sm">
                {rows.map((r) => (
                  <tr key={r.day} className="border-t border-[var(--line)]">
                    <td className="px-5 py-3 text-[var(--ink)]">{r.day}</td>
                    <td className="px-5 py-3 text-right text-[var(--ink)]">
                      {r.requests.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--muted)]">
                      {r.ok.toLocaleString("en-US")}
                    </td>
                    <td
                      className={`px-5 py-3 text-right ${
                        r.fail > 0 ? "text-[var(--signal)]" : "text-[var(--faint)]"
                      }`}
                    >
                      {r.fail.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--muted)]">
                      {r.promptTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--muted)]">
                      {r.completionTokens.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--line-2)]">
                  <td className="mono px-5 py-3 text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                    Total
                  </td>
                  <td className="mono px-5 py-3 text-right text-sm text-[var(--ink)]">
                    {totals.requests.toLocaleString("en-US")}
                  </td>
                  <td className="mono px-5 py-3 text-right text-sm text-[var(--muted)]">
                    {totals.ok.toLocaleString("en-US")}
                  </td>
                  <td className="mono px-5 py-3 text-right text-sm text-[var(--muted)]">
                    {totals.fail.toLocaleString("en-US")}
                  </td>
                  <td className="mono px-5 py-3 text-right text-sm text-[var(--muted)]">
                    {totals.promptTokens.toLocaleString("en-US")}
                  </td>
                  <td className="mono px-5 py-3 text-right text-sm text-[var(--muted)]">
                    {totals.completionTokens.toLocaleString("en-US")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mono mt-4 text-xs text-[var(--faint)]">
            Days are UTC, newest first. Request history is kept for 30 days.
          </p>
        </>
      )}
    </div>
  );
}

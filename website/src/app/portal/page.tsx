import type { Metadata } from "next";
import { getPortalStore, type ModelStat } from "@/lib/portal-store";
import { getPortalAuth } from "./auth";
import LineChart from "./line-chart";
import ModelFilter from "./model-filter";
import { EmptyState, PageHeader, RangeLinks, StatCard } from "./ui";
import {
  compact,
  dayLabel,
  formatDateTimeUTC,
  maskKey,
  parseModel,
  parseRange,
  successRate,
  zeroFillDays,
} from "./state";

export const metadata: Metadata = {
  title: "SOVA · Overview",
  description: "Your SOVA API usage at a glance: tokens, requests, and latency.",
};

function ChartCard({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-[var(--ink)]">{title}</h2>
        <span className="mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--faint)]">
          {caption}
        </span>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

// p50 per model, slowest first: the card reads as "what should I optimize".
function LatencyCard({ models }: { models: ModelStat[] }) {
  const sorted = [...models].sort((a, b) => b.p50LatencyMs - a.p50LatencyMs);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-[var(--ink)]">Latency by model</h2>
        <span className="mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--faint)]">
          p50 · slowest first
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="mono mt-6 text-sm text-[var(--muted)]">
          No models with traffic in this range.
        </p>
      ) : (
        <ul className="mt-3">
          {sorted.map((m) => (
            <li
              key={m.model}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-[var(--line)] py-4"
            >
              <div className="min-w-0">
                <p className="mono truncate text-sm text-[var(--ink)]">{m.model}</p>
                <p className="mono mt-1 text-xs text-[var(--faint)]">
                  {m.requests.toLocaleString("en-US")} req
                </p>
              </div>
              <p className="display text-[clamp(1.5rem,2.4vw,2rem)] text-[var(--ink)]">
                {m.p50LatencyMs.toLocaleString("en-US")}
                <span className="mono ml-1.5 text-sm font-normal text-[var(--muted)]">ms</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function PortalOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[]; model?: string | string[] }>;
}) {
  const params = await searchParams;
  const days = parseRange(params.days);
  const requestedModel = parseModel(params.model);

  const { key, row } = await getPortalAuth();
  if (!row) return null; // the layout already rendered the auth gate

  const store = getPortalStore(process.env);

  // modelStats also decides which models exist, so it resolves first and the
  // filter is normalized against it: a stale ?model= falls back to all models.
  const models = await store.modelStats(row.keyId, days);
  const model = requestedModel && models.some((m) => m.model === requestedModel)
    ? requestedModel
    : null;

  const [overview, series] = await Promise.all([
    store.overview(row.keyId, days),
    store.dailySeries(row.keyId, days, model),
  ]);

  const filled = zeroFillDays(series, days);
  const tokenPoints = filled.map((r) => ({
    label: dayLabel(r.day),
    value: r.promptTokens + r.completionTokens,
  }));
  const requestPoints = filled.map((r) => ({ label: dayLabel(r.day), value: r.requests }));

  const tokensTotal = overview.promptTokens + overview.completionTokens;

  // Overall latency numbers aggregate the per-model stats, weighted by how
  // much traffic each model actually saw.
  const modelReqs = models.reduce((sum, m) => sum + m.requests, 0);
  const weightedAvg = modelReqs
    ? Math.round(models.reduce((sum, m) => sum + m.avgLatencyMs * m.requests, 0) / modelReqs)
    : 0;
  const weightedP50 = modelReqs
    ? Math.round(models.reduce((sum, m) => sum + m.p50LatencyMs * m.requests, 0) / modelReqs)
    : 0;

  const peakTokenIndex = tokenPoints.reduce(
    (best, p, i) => (p.value > tokenPoints[best].value ? i : best),
    0,
  );
  const peakRequestIndex = requestPoints.reduce(
    (best, p, i) => (p.value > requestPoints[best].value ? i : best),
    0,
  );

  return (
    <div>
      <PageHeader title="Overview">
        <p className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--muted)]">
          <span className="text-[var(--ink)]">{row.label}</span>
          <span className="text-[var(--faint)]" aria-hidden>
            ·
          </span>
          <span>{maskKey(key)}</span>
          <span className="text-[var(--faint)]" aria-hidden>
            ·
          </span>
          <span>last used {row.lastUsedAt ? formatDateTimeUTC(row.lastUsedAt) : "never"}</span>
        </p>
      </PageHeader>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <RangeLinks basePath="/portal" days={days} model={model} />
        <ModelFilter
          models={models.map((m) => m.model)}
          value={model}
          days={days}
          basePath="/portal"
        />
      </div>

      <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tokens"
          value={tokensTotal.toLocaleString("en-US")}
          sub={`${compact(overview.promptTokens)} prompt · ${compact(overview.completionTokens)} completion`}
        />
        <StatCard
          label="Requests"
          value={overview.requests.toLocaleString("en-US")}
          sub={
            overview.requests
              ? `${successRate(overview.ok, overview.requests)} success`
              : "no traffic in range"
          }
        />
        <StatCard
          label="Avg latency"
          value={`${weightedAvg.toLocaleString("en-US")} ms`}
          sub={modelReqs ? "request-weighted · all models" : "no traffic in range"}
        />
        <StatCard
          label="P50 latency"
          value={`${weightedP50.toLocaleString("en-US")} ms`}
          sub={modelReqs ? "request-weighted across models" : "no traffic in range"}
        />
      </div>

      {overview.requests === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No traffic yet."
            body="Once your integration sends requests, tokens, success rate, and per-model latency show up here. The docs walk through your first call."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <ChartCard title="Tokens / day" caption={`${model ?? "all models"} · UTC`}>
              <LineChart
                points={tokenPoints}
                gradientId="chart-tokens"
                ariaLabel={`Daily tokens for the last ${days} days: ${tokensTotal.toLocaleString("en-US")} total, peak of ${tokenPoints[peakTokenIndex].value.toLocaleString("en-US")} on ${filled[peakTokenIndex].day} UTC.`}
              />
            </ChartCard>
            <ChartCard title="Requests / day" caption={`${model ?? "all models"} · UTC`}>
              <LineChart
                points={requestPoints}
                gradientId="chart-requests"
                ariaLabel={`Daily requests for the last ${days} days: ${overview.requests.toLocaleString("en-US")} total, peak of ${requestPoints[peakRequestIndex].value.toLocaleString("en-US")} on ${filled[peakRequestIndex].day} UTC.`}
              />
            </ChartCard>
          </div>

          <div className="mt-5">
            <LatencyCard models={models} />
          </div>
        </>
      )}
    </div>
  );
}

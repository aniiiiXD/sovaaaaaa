import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

type Environment = Record<string, string | undefined>;

export type PortalKeyRow = {
  keyId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
};

export type UsageSummary = {
  requests: number;
  ok: number;
  fail: number;
  promptTokens: number;
  completionTokens: number;
};

export type UsagePoint = UsageSummary & { day: string }; // YYYY-MM-DD UTC

export type ModelStat = {
  model: string;
  requests: number;
  ok: number;
  fail: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
};

export type UsageRecordInput = {
  keyId: string;
  model: string;
  ok: boolean;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  ttftMs: number | null;
};

export type PortalStore = {
  findByKey(key: string): Promise<PortalKeyRow | null>;
  // Self-serve: generates a new key for an authenticated customer. The
  // plaintext is returned exactly once; only the fingerprint is stored.
  generateKey(label: string): Promise<{ key: string; keyId: string }>;
  listKeys(): Promise<PortalKeyRow[]>;
  revokeKey(keyId: string): Promise<void>;
  recordUsage(record: UsageRecordInput): Promise<void>;
  overview(keyId: string, days: number): Promise<UsageSummary>;
  dailySeries(keyId: string, days: number, model: string | null): Promise<UsagePoint[]>;
  modelStats(keyId: string, days: number): Promise<ModelStat[]>;
};

const SCHEMA = `
create table if not exists portal_keys (
  key_id text primary key,
  fingerprint text unique not null,
  label text not null default 'unnamed',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create table if not exists portal_requests (
  id bigint generated always as identity primary key,
  key_id text not null,
  ts timestamptz not null default now(),
  model text not null,
  ok boolean not null,
  latency_ms int not null default 0,
  ttft_ms int,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0
);
create index if not exists portal_requests_key_ts on portal_requests (key_id, ts desc);
`;

export function fingerprintOf(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

type PostgresSql = ReturnType<typeof postgres>;

export class PostgresPortalStore implements PortalStore {
  private sql: PostgresSql;
  private schemaReady = false;

  constructor(sql: PostgresSql) {
    this.sql = sql;
  }

  static fromEnv(env: Environment): PostgresPortalStore | null {
    const url = env.DATABASE_URL;
    if (!url) return null;
    // prepare: false keeps this compatible with transaction poolers
    // (Supabase/pgbouncer), which reject named prepared statements.
    return new PostgresPortalStore(
      postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false }),
    );
  }

  private async ready(): Promise<void> {
    if (this.schemaReady) return;
    this.schemaReady = true;
    try {
      await this.sql.unsafe(SCHEMA);
    } catch (cause) {
      this.schemaReady = false;
      throw cause;
    }
  }

  async findByKey(key: string): Promise<PortalKeyRow | null> {
    await this.ready();
    const fingerprint = fingerprintOf(key);
    const rows = await this.sql`
      select key_id, label, created_at, revoked_at, last_used_at
      from portal_keys where fingerprint = ${fingerprint} and revoked_at is null`;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      keyId: r.key_id,
      label: r.label,
      createdAt: new Date(r.created_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
    };
  }

  async generateKey(label: string): Promise<{ key: string; keyId: string }> {
    await this.ready();
    const key = "sk-sova-" + randomBytes(24).toString("hex");
    const fingerprint = fingerprintOf(key);
    const keyId = fingerprint.slice(0, 8);
    await this.sql`
      insert into portal_keys (key_id, fingerprint, label) values (${keyId}, ${fingerprint}, ${label})`;
    return { key, keyId };
  }

  async listKeys(): Promise<PortalKeyRow[]> {
    await this.ready();
    const rows = await this.sql`
      select key_id, label, created_at, revoked_at, last_used_at
      from portal_keys order by created_at desc`;
    return rows.map((r) => ({
      keyId: r.key_id,
      label: r.label,
      createdAt: new Date(r.created_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
    }));
  }

  async revokeKey(keyId: string): Promise<void> {
    await this.ready();
    await this.sql`update portal_keys set revoked_at = now() where key_id = ${keyId} and revoked_at is null`;
  }

  // Fire-and-forget by contract: callers must not await it on the hot path.
  async recordUsage(record: UsageRecordInput): Promise<void> {
    await this.ready();
    await this.sql`
      insert into portal_requests
        (key_id, model, ok, latency_ms, ttft_ms, prompt_tokens, completion_tokens)
      values (${record.keyId}, ${record.model}, ${record.ok}, ${Math.round(record.latencyMs)},
              ${record.ttftMs === null ? null : Math.round(record.ttftMs)},
              ${record.promptTokens}, ${record.completionTokens})`;
    await this.sql`
      update portal_keys set last_used_at = now() where key_id = ${record.keyId}`;
    // Retention: requests older than 30 days carry no dashboard value.
    await this.sql`
      delete from portal_requests where ts < now() - interval '30 days'`;
  }

  private windowFilter(keyId: string, days: number, model: string | null) {
    if (model) {
      return this.sql`
        from portal_requests
        where key_id = ${keyId} and ts > now() - (${days} || ' days')::interval
          and model = ${model}`;
    }
    return this.sql`
      from portal_requests
      where key_id = ${keyId} and ts > now() - (${days} || ' days')::interval`;
  }

  async overview(keyId: string, days: number): Promise<UsageSummary> {
    await this.ready();
    const rows = await this.sql`
      select count(*)::int as requests,
             count(*) filter (where ok)::int as ok,
             count(*) filter (where not ok)::int as fail,
             coalesce(sum(prompt_tokens), 0)::bigint as prompt_tokens,
             coalesce(sum(completion_tokens), 0)::bigint as completion_tokens
      ${this.windowFilter(keyId, days, null)}`;
    const r = rows[0];
    return {
      requests: Number(r.requests),
      ok: Number(r.ok),
      fail: Number(r.fail),
      promptTokens: Number(r.prompt_tokens),
      completionTokens: Number(r.completion_tokens),
    };
  }

  async dailySeries(keyId: string, days: number, model: string | null): Promise<UsagePoint[]> {
    await this.ready();
    const rows = await this.sql`
      select date_trunc('day', ts at time zone 'UTC')::date::text as day,
             count(*)::int as requests,
             count(*) filter (where ok)::int as ok,
             count(*) filter (where not ok)::int as fail,
             coalesce(sum(prompt_tokens), 0)::bigint as prompt_tokens,
             coalesce(sum(completion_tokens), 0)::bigint as completion_tokens
      ${this.windowFilter(keyId, days, model)}
      group by 1 order by 1 asc`;
    return rows.map((r) => ({
      day: r.day,
      requests: Number(r.requests),
      ok: Number(r.ok),
      fail: Number(r.fail),
      promptTokens: Number(r.prompt_tokens),
      completionTokens: Number(r.completion_tokens),
    }));
  }

  async modelStats(keyId: string, days: number): Promise<ModelStat[]> {
    await this.ready();
    const rows = await this.sql`
      select model,
             count(*)::int as requests,
             count(*) filter (where ok)::int as ok,
             count(*) filter (where not ok)::int as fail,
             coalesce(avg(latency_ms), 0) as avg_latency,
             coalesce(percentile_cont(0.5) within group (order by latency_ms), 0) as p50_latency
      ${this.windowFilter(keyId, days, null)}
      group by model order by requests desc`;
    return rows.map((r) => ({
      model: r.model,
      requests: Number(r.requests),
      ok: Number(r.ok),
      fail: Number(r.fail),
      avgLatencyMs: Math.round(Number(r.avg_latency)),
      p50LatencyMs: Math.round(Number(r.p50_latency)),
    }));
  }
}

// In-memory fallback for running without a database: same behavior, process
// lifetime only. Records are kept individually so percentiles still work.
export class InMemoryPortalStore implements PortalStore {
  private keys = new Map<string, PortalKeyRow & { fingerprint: string }>();
  private requests: (UsageRecordInput & { ts: Date })[] = [];

  async findByKey(key: string): Promise<PortalKeyRow | null> {
    const row = this.keys.get(fingerprintOf(key).slice(0, 8));
    if (!row || row.revokedAt) return null;
    const { fingerprint: _f, ...rest } = row;
    return rest;
  }

  async generateKey(label: string): Promise<{ key: string; keyId: string }> {
    const key = "sk-sova-" + randomBytes(24).toString("hex");
    const fingerprint = fingerprintOf(key);
    const keyId = fingerprint.slice(0, 8);
    this.keys.set(keyId, {
      keyId, label, fingerprint, createdAt: new Date(), revokedAt: null, lastUsedAt: null,
    });
    return { key, keyId };
  }

  async listKeys(): Promise<PortalKeyRow[]> {
    return [...this.keys.values()].map(({ fingerprint: _f, ...row }) => row);
  }

  async revokeKey(keyId: string): Promise<void> {
    const row = this.keys.get(keyId);
    if (row) row.revokedAt = new Date();
  }

  async recordUsage(record: UsageRecordInput): Promise<void> {
    const row = this.keys.get(record.keyId);
    if (!row) return;
    row.lastUsedAt = new Date();
    this.requests.push({ ...record, ts: new Date() });
  }

  private inWindow(keyId: string, days: number, model: string | null) {
    const cutoff = Date.now() - days * 86_400_000;
    return this.requests.filter((r) =>
      r.keyId === keyId && r.ts.getTime() > cutoff && (!model || r.model === model));
  }

  async overview(keyId: string, days: number): Promise<UsageSummary> {
    const rows = this.inWindow(keyId, days, null);
    return {
      requests: rows.length,
      ok: rows.filter((r) => r.ok).length,
      fail: rows.filter((r) => !r.ok).length,
      promptTokens: rows.reduce((s, r) => s + r.promptTokens, 0),
      completionTokens: rows.reduce((s, r) => s + r.completionTokens, 0),
    };
  }

  async dailySeries(keyId: string, days: number, model: string | null): Promise<UsagePoint[]> {
    const rows = this.inWindow(keyId, days, model);
    const byDay = new Map<string, UsagePoint>();
    for (const r of rows) {
      const day = r.ts.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? {
        day, requests: 0, ok: 0, fail: 0, promptTokens: 0, completionTokens: 0,
      };
      bucket.requests += 1;
      if (r.ok) bucket.ok += 1; else bucket.fail += 1;
      bucket.promptTokens += r.promptTokens;
      bucket.completionTokens += r.completionTokens;
      byDay.set(day, bucket);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }

  async modelStats(keyId: string, days: number): Promise<ModelStat[]> {
    const rows = this.inWindow(keyId, days, null);
    const byModel = new Map<string, ModelStat>();
    for (const r of rows) {
      const bucket = byModel.get(r.model) ?? {
        model: r.model, requests: 0, ok: 0, fail: 0, avgLatencyMs: 0, p50LatencyMs: 0,
      };
      bucket.requests += 1;
      if (r.ok) bucket.ok += 1; else bucket.fail += 1;
      byModel.set(r.model, bucket);
    }
    const stats: ModelStat[] = [];
    for (const [model, bucket] of byModel) {
      const latencies = this.requests
        .filter((r) => r.keyId === keyId && r.model === model)
        .map((r) => r.latencyMs).sort((a, b) => a - b);
      const avg = latencies.length
        ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0;
      const p50 = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;
      stats.push({ ...bucket, avgLatencyMs: avg, p50LatencyMs: p50 });
    }
    return stats.sort((a, b) => b.requests - a.requests);
  }
}

const shared: { store: PortalStore | null } = { store: null };

export function getPortalStore(env: Environment): PortalStore {
  if (!shared.store) {
    shared.store = PostgresPortalStore.fromEnv(env) ?? new InMemoryPortalStore();
  }
  return shared.store;
}

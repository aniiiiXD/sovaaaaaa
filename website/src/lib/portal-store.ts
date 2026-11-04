import { createHash } from "node:crypto";
import postgres from "postgres";

type Environment = Record<string, string | undefined>;

export type PortalKeyRow = {
  keyId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
};

export type UsageDay = {
  day: string; // YYYY-MM-DD (UTC)
  requests: number;
  promptTokens: number;
  completionTokens: number;
};

export type PortalStore = {
  // Returns the key row for a presented plaintext key, or null when unknown
  // or revoked. The plaintext is never stored; only its SHA-256 fingerprint.
  findByKey(key: string): Promise<PortalKeyRow | null>;
  recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void>;
  usageDays(keyId: string, days: number): Promise<UsageDay[]>;
};

const SCHEMA = `
create table if not exists portal_keys (
  key_id text primary key,
  fingerprint text unique not null,
  label text not null default 'unnamed',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz,
  total_requests bigint not null default 0,
  total_prompt_tokens bigint not null default 0,
  total_completion_tokens bigint not null default 0
);
create table if not exists portal_usage_daily (
  key_id text not null,
  day date not null,
  requests bigint not null default 0,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  primary key (key_id, day)
);
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
    // prepare: false keeps the store compatible with transaction-pooler
    // endpoints (Supabase/pgbouncer), which reject named prepared statements.
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
      select key_id, label, created_at, revoked_at, last_used_at,
             total_requests, total_prompt_tokens, total_completion_tokens
      from portal_keys where fingerprint = ${fingerprint} and revoked_at is null`;
    if (!rows.length) return null;
    const r = rows[0];
    return {
      keyId: r.key_id,
      label: r.label,
      createdAt: new Date(r.created_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
      totalRequests: Number(r.total_requests),
      totalPromptTokens: Number(r.total_prompt_tokens),
      totalCompletionTokens: Number(r.total_completion_tokens),
    };
  }

  // Registers an operator-minted key (from backend/ops/keys.py) into the
  // portal. Idempotent: re-registering the same fingerprint is a no-op.
  async registerKey(key: string, label: string): Promise<void> {
    await this.ready();
    const fingerprint = fingerprintOf(key);
    const keyId = fingerprint.slice(0, 8);
    await this.sql`
      insert into portal_keys (key_id, fingerprint, label)
      values (${keyId}, ${fingerprint}, ${label})
      on conflict (fingerprint) do nothing`;
  }

  // Fire-and-forget by contract: callers must not await it on the hot path.
  async recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void> {
    await this.ready();
    await this.sql`
      update portal_keys set last_used_at = now(), total_requests = total_requests + 1,
        total_prompt_tokens = total_prompt_tokens + ${promptTokens},
        total_completion_tokens = total_completion_tokens + ${completionTokens}
      where key_id = ${keyId}`;
    await this.sql`
      insert into portal_usage_daily (key_id, day, requests, prompt_tokens, completion_tokens)
      values (${keyId}, current_date, 1, ${promptTokens}, ${completionTokens})
      on conflict (key_id, day) do update set
        requests = portal_usage_daily.requests + 1,
        prompt_tokens = portal_usage_daily.prompt_tokens + ${promptTokens},
        completion_tokens = portal_usage_daily.completion_tokens + ${completionTokens}`;
  }

  async usageDays(keyId: string, days: number): Promise<UsageDay[]> {
    await this.ready();
    const rows = await this.sql`
      select day::text as day, requests, prompt_tokens, completion_tokens
      from portal_usage_daily
      where key_id = ${keyId} and day > current_date - ${days}::int
      order by day asc`;
    return rows.map((r) => ({
      day: r.day,
      requests: Number(r.requests),
      promptTokens: Number(r.prompt_tokens),
      completionTokens: Number(r.completion_tokens),
    }));
  }
}

// In-memory fallback so the portal renders (with a warning) when no database
// is configured. Usage recorded here evaporates on restart.
export class InMemoryPortalStore implements PortalStore {
  private rows = new Map<string, PortalKeyRow & { fingerprint: string }>();
  private daily = new Map<string, UsageDay>();

  constructor(seedKeys: { key: string; label: string }[] = []) {
    for (const seed of seedKeys) this.registerSeed(seed.key, seed.label);
  }

  private registerSeed(key: string, label: string) {
    const fingerprint = fingerprintOf(key);
    this.rows.set(fingerprint.slice(0, 8), {
      keyId: fingerprint.slice(0, 8), label, createdAt: new Date(0), revokedAt: null,
      lastUsedAt: null, totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0,
      fingerprint,
    });
  }

  async findByKey(key: string): Promise<PortalKeyRow | null> {
    const row = this.rows.get(fingerprintOf(key).slice(0, 8));
    if (!row || row.revokedAt) return null;
    const { fingerprint: _f, ...rest } = row;
    return rest;
  }

  async recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void> {
    const row = this.rows.get(keyId);
    if (!row) return;
    row.lastUsedAt = new Date();
    row.totalRequests += 1;
    row.totalPromptTokens += promptTokens;
    row.totalCompletionTokens += completionTokens;
    const day = new Date().toISOString().slice(0, 10);
    const bucket = this.daily.get(`${keyId}:${day}`) ?? {
      day, requests: 0, promptTokens: 0, completionTokens: 0,
    };
    bucket.requests += 1;
    bucket.promptTokens += promptTokens;
    bucket.completionTokens += completionTokens;
    this.daily.set(`${keyId}:${day}`, bucket);
  }

  async usageDays(keyId: string, days: number): Promise<UsageDay[]> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return [...this.daily.values()]
      .filter((d) => d.day >= cutoff && this.rows.get(keyId)?.keyId === keyId)
      .sort((a, b) => a.day.localeCompare(b.day));
  }
}

const shared: { store: PortalStore | null } = { store: null };

export function getPortalStore(env: Environment): PortalStore {
  if (!shared.store) {
    shared.store = PostgresPortalStore.fromEnv(env) ?? new InMemoryPortalStore();
  }
  return shared.store;
}

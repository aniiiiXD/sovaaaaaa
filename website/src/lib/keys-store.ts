import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

type Environment = Record<string, string | undefined>;

export type ApiKeyRow = {
  keyId: string;
  label: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
};

export type KeyStore = {
  listKeys(): Promise<ApiKeyRow[]>;
  insertKey(keyId: string, fingerprint: string, label: string): Promise<void>;
  revokeKey(keyId: string): Promise<void>;
  activeFingerprints(): Promise<string[]>;
  recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void>;
};

export const KEY_PREFIX = "sk-sova-";

export function fingerprintOf(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Mint a customer key. The plaintext exists exactly once, in this return
// value: only its SHA-256 fingerprint is stored. Same contract as
// backend/ops/keys.py.
export function mintSecretKey(): { key: string; keyId: string; fingerprint: string } {
  const key = KEY_PREFIX + randomBytes(24).toString("hex");
  const fingerprint = fingerprintOf(key);
  return { key, keyId: fingerprint.slice(0, 8), fingerprint };
}

function sqlFrom(env: Environment) {
  const url = env.DATABASE_URL;
  if (!url) return null;
  return postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
}

const SCHEMA = `
create table if not exists api_keys (
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
`;

type PostgresSql = ReturnType<typeof postgres>;

export class PostgresKeyStore implements KeyStore {
  private sql: PostgresSql;
  private fingerprintCache: { at: number; values: string[] } | null = null;
  private static CACHE_TTL_MS = 60_000;

  constructor(sql: PostgresSql) {
    this.sql = sql;
  }

  static fromEnv(env: Environment): PostgresKeyStore | null {
    const sql = sqlFrom(env);
    return sql ? new PostgresKeyStore(sql) : null;
  }

  async ensureSchema(): Promise<void> {
    await this.sql.unsafe(SCHEMA);
  }

  async listKeys(): Promise<ApiKeyRow[]> {
    await this.ensureSchemaOnce();
    const rows = await this.sql`
      select key_id, label, created_at, revoked_at, last_used_at,
             total_requests, total_prompt_tokens, total_completion_tokens
      from api_keys order by created_at desc`;
    return rows.map((r) => ({
      keyId: r.key_id,
      label: r.label,
      createdAt: new Date(r.created_at),
      revokedAt: r.revoked_at ? new Date(r.revoked_at) : null,
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
      totalRequests: Number(r.total_requests),
      totalPromptTokens: Number(r.total_prompt_tokens),
      totalCompletionTokens: Number(r.total_completion_tokens),
    }));
  }

  async insertKey(keyId: string, fingerprint: string, label: string): Promise<void> {
    await this.ensureSchemaOnce();
    await this.sql`
      insert into api_keys (key_id, fingerprint, label) values (${keyId}, ${fingerprint}, ${label})
      on conflict (key_id) do nothing`;
    this.fingerprintCache = null;
  }

  async revokeKey(keyId: string): Promise<void> {
    await this.ensureSchemaOnce();
    await this.sql`update api_keys set revoked_at = now() where key_id = ${keyId} and revoked_at is null`;
    this.fingerprintCache = null;
  }

  // Cached so the inference hot path never waits on a database round trip;
  // staleness window is 60s, acceptable for key revocation.
  async activeFingerprints(): Promise<string[]> {
    if (this.fingerprintCache && Date.now() - this.fingerprintCache.at < PostgresKeyStore.CACHE_TTL_MS) {
      return this.fingerprintCache.values;
    }
    await this.ensureSchemaOnce();
    const rows = await this.sql`
      select fingerprint from api_keys where revoked_at is null`;
    this.fingerprintCache = { at: Date.now(), values: rows.map((r) => r.fingerprint) };
    return this.fingerprintCache.values;
  }

  // Fire-and-forget by contract: callers must not await it on the hot path.
  async recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void> {
    await this.sql`
      update api_keys set last_used_at = now(), total_requests = total_requests + 1,
        total_prompt_tokens = total_prompt_tokens + ${promptTokens},
        total_completion_tokens = total_completion_tokens + ${completionTokens}
      where key_id = ${keyId}`;
  }

  private schemaReady = false;
  private async ensureSchemaOnce(): Promise<void> {
    if (this.schemaReady) return;
    this.schemaReady = true;
    try {
      await this.sql.unsafe(SCHEMA);
    } catch (cause) {
      this.schemaReady = false;
      throw cause;
    }
  }
}

// In-memory implementation for tests and for running without a database:
// fingerprints start from env, minted keys live for the process lifetime.
export class InMemoryKeyStore implements KeyStore {
  private rows = new Map<string, ApiKeyRow & { fingerprint: string }>();

  constructor(seedFingerprints: string[] = []) {
    for (const fingerprint of seedFingerprints) {
      this.rows.set(fingerprint.slice(0, 8), {
        keyId: fingerprint.slice(0, 8),
        label: "env",
        createdAt: new Date(0),
        revokedAt: null,
        lastUsedAt: null,
        totalRequests: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        fingerprint,
      });
    }
  }

  async listKeys(): Promise<ApiKeyRow[]> {
    return [...this.rows.values()].map(({ fingerprint: _f, ...row }) => row);
  }

  async insertKey(keyId: string, fingerprint: string, label: string): Promise<void> {
    this.rows.set(keyId, {
      keyId, label, fingerprint, createdAt: new Date(), revokedAt: null,
      lastUsedAt: null, totalRequests: 0, totalPromptTokens: 0, totalCompletionTokens: 0,
    });
  }

  async revokeKey(keyId: string): Promise<void> {
    const row = this.rows.get(keyId);
    if (row) row.revokedAt = new Date();
  }

  async activeFingerprints(): Promise<string[]> {
    return [...this.rows.values()].filter((r) => !r.revokedAt).map((r) => r.fingerprint);
  }

  async recordUsage(keyId: string, promptTokens: number, completionTokens: number): Promise<void> {
    const row = this.rows.get(keyId);
    if (!row) return;
    row.lastUsedAt = new Date();
    row.totalRequests += 1;
    row.totalPromptTokens += promptTokens;
    row.totalCompletionTokens += completionTokens;
  }
}

const shared: { store: KeyStore | null } = { store: null };

// Single store per server process. Falls back to in-memory (seeded from env)
// so the site keeps working when DATABASE_URL is absent.
export function getKeyStore(env: Environment): KeyStore {
  if (!shared.store) {
    const pg = PostgresKeyStore.fromEnv(env);
    shared.store = pg ?? new InMemoryKeyStore(
      (env.SOVA_API_KEY_HASHES ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    );
  }
  return shared.store;
}

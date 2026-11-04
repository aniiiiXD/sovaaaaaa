import type { Metadata } from "next";
import { getKeyStore, type ApiKeyRow } from "@/lib/keys-store";
import { logoutAction } from "./actions";
import { adminConfigured, isAdminAuthed } from "./gate";
import LoginForm from "./login-form";
import KeysTable from "./keys-table";
import MintForm from "./mint-form";

export const metadata: Metadata = {
  title: "Sova admin | API keys",
  description: "Mint and revoke SOVA API keys.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("en-US");

function AdminHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-[var(--line)]">
      <div className="container-x flex h-16 items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--ink)]">
            Sova
          </span>
          <span className="mono text-[0.6rem] tracking-[0.22em] text-[var(--faint)]">
            ADMIN · API KEYS
          </span>
        </div>
        {signedIn && (
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-nav">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "color-mix(in oklab, var(--signal) 45%, transparent)",
        background: "color-mix(in oklab, var(--signal) 6%, var(--paper-2))",
      }}
    >
      <p className="mono text-sm leading-relaxed text-[var(--muted)]">{children}</p>
    </div>
  );
}

function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="bg-[var(--paper-2)] p-6">
      <p className="display text-[clamp(1.6rem,2.4vw,2.2rem)] tabular-nums text-[var(--ink)]">{value}</p>
      <p className="mono mt-2 text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">{caption}</p>
    </div>
  );
}

function SetupRequired() {
  return (
    <>
      <AdminHeader signedIn={false} />
      <section className="container-x py-24">
        <p className="eyebrow">
          <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
          Setup required
        </p>
        <h1 className="display mt-5 max-w-2xl text-[clamp(2.2rem,4.6vw,3.3rem)]">
          The admin gate has no password to check against.
        </h1>
        <p className="lead mt-5 max-w-2xl">
          ADMIN_PASSWORD is not set on this deployment. Until it exists, minting and revoking are
          disabled and this page stays locked.
        </p>
        <div className="well mt-10 max-w-xl p-6">
          <ol className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
            <li>
              <span className="num mr-2">1</span>
              Set ADMIN_PASSWORD in the environment (.env.local locally, project settings on Vercel).
            </li>
            <li>
              <span className="num mr-2">2</span>
              Redeploy or restart so the server picks it up.
            </li>
            <li>
              <span className="num mr-2">3</span>
              Reload this page and sign in with that password.
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}

function Gate() {
  return (
    <>
      <AdminHeader signedIn={false} />
      <section className="container-x flex min-h-[60svh] items-center justify-center py-24">
        <div className="w-full max-w-md">
          <LoginForm />
          <p className="mono mt-4 text-xs leading-relaxed text-[var(--faint)]">
            Access is gated by ADMIN_PASSWORD. The session cookie is httpOnly, lasts 7 days, and
            never contains the password.
          </p>
        </div>
      </section>
    </>
  );
}

function Dashboard({
  keys,
  loadError,
  hasDb,
}: {
  keys: ApiKeyRow[];
  loadError: string | null;
  hasDb: boolean;
}) {
  const active = keys.filter((k) => !k.revokedAt).length;
  const totalRequests = keys.reduce((sum, k) => sum + k.totalRequests, 0);
  const totalTokens = keys.reduce(
    (sum, k) => sum + k.totalPromptTokens + k.totalCompletionTokens,
    0,
  );

  return (
    <>
      <AdminHeader signedIn />
      <section className="container-x py-16">
        <p className="eyebrow">
          <span className="signal-dot" aria-hidden />
          Sova admin
        </p>
        <h1 className="display mt-5 max-w-2xl text-[clamp(2.2rem,4.6vw,3.3rem)]">API keys</h1>
        <p className="lead mt-5 max-w-2xl">
          Keys are <span className="mono text-[var(--ink)]">sk-sova-&lt;48 hex&gt;</span>. The
          plaintext is shown once at mint; only a SHA-256 fingerprint is stored. Revocation takes
          effect within 60 seconds.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] grid-cols-2 md:grid-cols-4">
          <Stat value={nf.format(keys.length)} caption="keys total" />
          <Stat value={nf.format(active)} caption="active" />
          <Stat value={nf.format(totalRequests)} caption="requests all-time" />
          <Stat value={nf.format(totalTokens)} caption="tokens in+out all-time" />
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {!hasDb && (
            <Banner>
              No DATABASE_URL is set, so the key store is in memory for this process only. Everything
              minted here disappears on restart. Set DATABASE_URL for durable storage.
            </Banner>
          )}
          {loadError && <Banner>Could not read the key store: {loadError}</Banner>}
        </div>

        <div className="mt-12">
          <p className="eyebrow mb-5">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
            All keys
          </p>
          <KeysTable rows={keys} />
        </div>

        <div className="mt-14">
          <p className="eyebrow mb-5">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />
            New key
          </p>
          <MintForm />
        </div>

        <p className="mono mt-14 text-sm text-[var(--muted)]">
          Fingerprints only, same contract as backend/ops/keys.py. Plaintext keys cannot be
          recovered: if one is lost, revoke it and mint a replacement.
        </p>
      </section>
    </>
  );
}

export default async function AdminKeysPage() {
  const configured = adminConfigured();
  const authed = configured && (await isAdminAuthed());

  if (!configured) return <SetupRequired />;
  if (!authed) return <Gate />;

  let keys: ApiKeyRow[] = [];
  let loadError: string | null = null;
  try {
    keys = await getKeyStore(process.env).listKeys();
  } catch (cause) {
    console.error("admin/keys: listKeys failed.", cause);
    loadError = cause instanceof Error ? cause.message : "unknown error";
  }

  return <Dashboard keys={keys} loadError={loadError} hasDb={Boolean(process.env.DATABASE_URL)} />;
}

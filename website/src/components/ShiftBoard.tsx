/**
 * ShiftBoard — the page's signature element.
 *
 * The thesis of an AI-native firm is that it doesn't just advise; it builds
 * and keeps things running. So the hero isn't a headline over a gradient — it's
 * a small "working board" showing the three lanes of the firm as a live system:
 * Advise → Build → Run. The vermilion signal is reserved for the one lane that's
 * genuinely live. Pure markup + CSS; motion is handled by globals.css and is
 * disabled under prefers-reduced-motion.
 */

const LANES = [
  {
    fn: "ADVISE",
    title: "Roadmap · Northwind",
    detail: "3 use-cases scoped · ROI modeled",
    state: "reviewed",
    live: false,
  },
  {
    fn: "BUILD",
    title: "support-triage agent",
    detail: "shipped in 12 days · 2 integrations",
    state: "shipping",
    live: false,
  },
  {
    fn: "RUN",
    title: "4 systems on shift",
    detail: "99.9% uptime · evals green",
    state: "live",
    live: true,
  },
];

export default function ShiftBoard() {
  return (
    <div className="card w-full max-w-md overflow-hidden shadow-[0_24px_60px_-32px_rgba(25,27,20,0.35)]">
      {/* header */}
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
        <span className="mono text-[0.7rem] uppercase tracking-[0.18em] text-[var(--faint)]">
          the working board
        </span>
        <span className="tag tag--live">
          <span className="signal-dot" aria-hidden />
          live
        </span>
      </div>

      {/* lanes */}
      <div className="divide-y divide-[var(--line)]">
        {LANES.map((l) => (
          <div
            key={l.fn}
            className={`flex items-center gap-4 px-5 py-4 ${l.live ? "scan bg-[color-mix(in_oklab,var(--signal)_4%,transparent)]" : ""}`}
          >
            <span
              className="mono w-14 shrink-0 text-[0.66rem] tracking-[0.12em]"
              style={{ color: l.live ? "var(--signal)" : "var(--pine-ink)" }}
            >
              {l.fn}
            </span>

            <div className="min-w-0 flex-1">
              <p className="mono truncate text-[0.82rem] text-[var(--ink)]">{l.title}</p>
              <p className="mt-0.5 truncate text-[0.78rem] text-[var(--muted)]">{l.detail}</p>
            </div>

            <span
              className="mono flex shrink-0 items-center gap-1.5 text-[0.66rem] uppercase tracking-[0.08em]"
              style={{ color: l.live ? "var(--signal)" : "var(--muted)" }}
            >
              {l.live ? (
                <span className="signal-dot" aria-hidden />
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--pine)" strokeWidth="2.4" aria-hidden>
                  <path d="M5 12l4 4L19 7" />
                </svg>
              )}
              {l.state}
            </span>
          </div>
        ))}
      </div>

      {/* footer */}
      <div className="border-t border-[var(--line)] bg-[var(--paper)] px-5 py-3.5">
        <p className="mono text-[0.72rem] text-[var(--faint)]">
          one team, one thread, first call to on-call
        </p>
      </div>
    </div>
  );
}

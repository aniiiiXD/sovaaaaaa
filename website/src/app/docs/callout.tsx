import type { ReactNode } from "react";

type CalloutVariant = "info" | "warning";

type CalloutProps = {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
};

// Tints are additive on the dark monochrome ground: a quiet blue for context,
// an amber for the things that bite (shown-once keys, lane limits, 429).
const STYLES: Record<CalloutVariant, { border: string; background: string; accent: string }> = {
  info: {
    border: "rgba(96, 165, 250, 0.32)",
    background: "rgba(96, 165, 250, 0.08)",
    accent: "#93C5FD",
  },
  warning: {
    border: "rgba(251, 191, 36, 0.32)",
    background: "rgba(251, 191, 36, 0.08)",
    accent: "#FCD34D",
  },
};

function CalloutIcon({ variant }: { variant: CalloutVariant }) {
  if (variant === "warning") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3 2.5 20h19L12 3Z" strokeLinejoin="round" />
        <path d="M12 10v4" strokeLinecap="round" />
        <path d="M12 17.5h.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

// GitBook-style callout: a tinted panel with a small icon.
export default function Callout({ variant = "info", title, children }: CalloutProps) {
  const s = STYLES[variant];
  return (
    <aside
      className="mt-8 rounded-xl border p-4 sm:p-5"
      style={{ borderColor: s.border, background: s.background }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-none" style={{ color: s.accent }}>
          <CalloutIcon variant={variant} />
        </span>
        <div className="min-w-0">
          {title ? <p className="text-sm font-medium text-[var(--ink)]">{title}</p> : null}
          <div className={`text-sm leading-relaxed text-[var(--muted)] ${title ? "mt-1" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </aside>
  );
}

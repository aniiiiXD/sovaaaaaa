import CopyButton from "./copy-button";

type CodeBlockProps = {
  /** Small language chip: bash / python / json / text. */
  lang?: string;
  /** Header label, also used for the copy button's aria-label. */
  label: string;
  code: string;
  caption?: string;
};

// Dark code well with a language chip and the shared copy button.
export default function CodeBlock({ lang, label, code, caption }: CodeBlockProps) {
  return (
    <figure className="mt-8 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper-3)]">
      <figcaption className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3">
        {lang ? (
          <span className="mono flex-none rounded-md border border-[var(--line-2)] px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-[var(--faint)]">
            {lang}
          </span>
        ) : null}
        <span className="mono min-w-0 flex-1 truncate text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
          {label}
        </span>
        <CopyButton value={code} label={label} />
      </figcaption>
      <pre className="overflow-x-auto bg-[#0B0B0E] p-5">
        <code className="mono text-[0.84rem] leading-relaxed text-[var(--ink)]">{code}</code>
      </pre>
      {caption ? (
        <p className="border-t border-[var(--line)] px-5 py-3 text-sm leading-relaxed text-[var(--muted)]">
          {caption}
        </p>
      ) : null}
    </figure>
  );
}

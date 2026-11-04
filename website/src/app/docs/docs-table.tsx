import type { ReactNode } from "react";

type DocsTableProps = {
  head: string[];
  rows: ReactNode[][];
  /** Columns rendered in monospace (field names, statuses, values). */
  mono?: readonly number[];
  minWidth?: string;
};

// Hairline table with monospace value columns, matching the landing pages.
export default function DocsTable({
  head,
  rows,
  mono = [0],
  minWidth = "640px",
}: DocsTableProps) {
  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--line)]">
      <table
        className="w-full border-collapse bg-[var(--paper-2)] text-left"
        style={{ minWidth }}
      >
        <thead>
          <tr className="mono text-[0.72rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            {head.map((h) => (
              <th key={h} className="p-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-[var(--line)]">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`p-4 align-top text-sm leading-relaxed ${
                    mono.includes(j)
                      ? "mono text-[0.84rem] text-[var(--ink)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

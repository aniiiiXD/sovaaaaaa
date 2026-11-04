"use client";

import { useRouter } from "next/navigation";

/**
 * Model filter for the charts. The choice lives in the URL, so the server
 * does the filtering and every view stays shareable.
 */
export default function ModelFilter({
  models,
  value,
  days,
  basePath,
}: {
  models: string[];
  value: string | null;
  days: number;
  basePath: string;
}) {
  const router = useRouter();

  if (models.length === 0) return null;

  function change(next: string) {
    const params = new URLSearchParams({ days: String(days) });
    if (next) params.set("model", next);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <label className="mono flex items-center gap-2.5 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">
      Model
      <select
        value={value ?? ""}
        onChange={(event) => change(event.target.value)}
        aria-label="Filter charts by model"
        className="mono min-h-[38px] max-w-[260px] rounded-lg border border-[var(--line-2)] bg-[var(--paper-3)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--ink)] focus:border-[var(--pine)]"
      >
        <option value="">All models</option>
        {models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </label>
  );
}

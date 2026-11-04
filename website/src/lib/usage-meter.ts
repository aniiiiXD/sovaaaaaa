export type UsageRecord = {
  ts: number;
  key_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  backend: string;
};

// Fire-and-forget usage metering: one structured JSON line per completed
// request, emitted via console.log. The Vercel log drain is the ledger, and
// ops/margin.py consumes these lines later. Metering must never throw into or
// delay the response path. key_id is a short fingerprint label, never the raw
// key.
export function meterUsage(record: UsageRecord, emit: (line: string) => void = (line) => console.log(line)): void {
  try { emit(JSON.stringify(record)); } catch { /* Metering never breaks inference. */ }
}

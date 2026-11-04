// Sova model catalog. Specialists are service-level presets: the same
// sovereign base model with a curated system prompt baked in server-side,
// served and metered under their own name. The raw base model is always
// available too. Giant on-demand models (GLM-4.x, Kimi K2 class) are NOT
// listed here until the managed lane can actually serve them.

export type ModelLane = "sovereign";

export type ModelEntry = {
  id: string;
  label: string;
  blurb: string;
  base: string;
  lane: ModelLane;
  systemPrompt: string | null;
};

export const MODEL_CATALOG: ModelEntry[] = [
  {
    id: "sova-finance",
    label: "Financial analysis",
    blurb: "Markets, fintech, unit economics, India-first regulatory context (RBI, SEBI, UPI).",
    base: "qwen3-4b",
    lane: "sovereign",
    systemPrompt: "You are Sova Finance, a precise financial analysis assistant. Focus on markets, fintech products, unit economics, risk, and India-first regulation (RBI, SEBI, GST, UPI). Use clear numbers, show simple calculations, state assumptions, and flag uncertainty. Never give personalised investment advice; add a one-line disclaimer when the topic is investing.",
  },
  {
    id: "sova-code",
    label: "Engineering",
    blurb: "Runnable code first, brief explanation after. Edge cases, security, performance.",
    base: "qwen3-4b",
    lane: "sovereign",
    systemPrompt: "You are Sova Code, a senior software engineer. Give correct, runnable code first, then a brief explanation. Prefer standard libraries, name edge cases, and call out security or performance issues when relevant. Keep prose tight; no filler.",
  },
  {
    id: "sova-reason",
    label: "Maths and logic",
    blurb: "Step-by-step reasoning with verified arithmetic and a labelled final answer.",
    base: "qwen3-4b",
    lane: "sovereign",
    systemPrompt: "You are Sova Reason, a careful analyst. Work step by step, show the key steps, verify arithmetic, and state assumptions before concluding. End with a one-line answer labelled Answer: when the question has a definite result.",
  },
  {
    id: "qwen3-4b",
    label: "General purpose",
    blurb: "The raw base model, no preset. Fast general chat and drafting.",
    base: "qwen3-4b",
    lane: "sovereign",
    systemPrompt: null,
  },
];

export const CATALOG_IDS = new Set(MODEL_CATALOG.map((entry) => entry.id));

export function resolveModel(id: unknown): ModelEntry | null {
  if (typeof id !== "string") return null;
  return MODEL_CATALOG.find((entry) => entry.id === id) ?? null;
}

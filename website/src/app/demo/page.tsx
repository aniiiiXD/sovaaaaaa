import type { Metadata } from "next";
import DemoWorkbench from "./workbench";

export const metadata: Metadata = {
  title: "Sova Studio | Finance workflow demo",
  description: "Run a finance workflow, inspect its calculations, and scope a pilot on your own data.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function DemoPage() {
  return <DemoWorkbench baselineConnected={Boolean(process.env.BEDROCK_DEMO_BASELINE_ID)} liveEnabled={Boolean(process.env.SOVA_DEMO_ACCESS_CODE) && process.env.SOVA_INFERENCE_ENABLED === "true"} />;
}

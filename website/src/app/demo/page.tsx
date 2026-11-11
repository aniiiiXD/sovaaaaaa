import type { Metadata } from "next";
import DemoWorkbench from "./workbench";
import { demoAvailability } from "@/lib/serving-config";

export const metadata: Metadata = {
  title: "Clove Studio | Finance workflow demo",
  description: "Run a finance workflow, inspect its calculations, and scope a pilot on your own data.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function DemoPage() {
  return <DemoWorkbench {...demoAvailability(process.env)} />;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SidebarNav from "./sidebar-nav";
import Breadcrumb from "./breadcrumb";
import Pager from "./pager";

// The docs shell: fixed site nav, a sticky grouped sidebar on desktop, a
// scrollable chip row on mobile, and a centered content column with
// breadcrumb and prev/next pager around the page body.
export const metadata: Metadata = {
  title: {
    default: "Sova docs",
    template: "%s · Sova docs",
  },
  description:
    "The Sova inference API: an OpenAI-shaped chat completions endpoint for qwen3-4b, with per-key usage metering, streaming on the managed lane, and limits enforced server side.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto flex w-full max-w-[1180px] items-stretch pt-16 2xl:pt-[4.75rem]">
        <aside className="hidden w-64 flex-none border-r border-[var(--line)] lg:block">
          <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto 2xl:top-[4.75rem] 2xl:h-[calc(100vh-4.75rem)]">
            <SidebarNav variant="sidebar" />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[800px] px-5 pb-24 pt-10 sm:px-8 sm:pt-12">
            <div className="mb-7 lg:hidden">
              <SidebarNav variant="chips" />
            </div>
            <Breadcrumb />
            {children}
            <Pager />
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}

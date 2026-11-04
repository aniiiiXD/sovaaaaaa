import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BOOKING_URL } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "../auth";
import Sidebar from "../sidebar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SOVA · Customer console",
  description:
    "The SOVA customer console: live tokens, requests, latency, and self-serve API keys.",
  robots: { index: false, follow: false },
};

// Supabase env vars missing: the gate cannot verify anyone. A quiet panel
// instead of an exception; the rest of the site keeps working.
function NotConfigured() {
  return (
    <div className="min-h-svh">
      <section>
        <div className="container-x max-w-2xl py-12 sm:py-20">
          <p className="eyebrow">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden />{" "}
            Customer console
          </p>
          <h1 className="display mt-5 text-[clamp(2.2rem,4.6vw,3.2rem)] text-[var(--ink)]">
            Accounts are not configured yet.
          </h1>
          <p className="lead mt-6">
            The console signs you in with an email and password, and that
            service is not switched on for this deployment yet. Everything
            else on the site keeps working.
          </p>
          <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-ghost mt-9">
            Book a call
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}

// Session gate: no live Supabase session, no console. Signed-in visitors get
// the console shell; the session user id scopes every store call below it.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <NotConfigured />;
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/portal/login");
  }

  return (
    <div className="min-h-svh bg-[var(--paper)]">
      <Sidebar email={user.email} />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          {children}
        </main>
      </div>
    </div>
  );
}

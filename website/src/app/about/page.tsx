import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { BOOKING_URL, CONTACT_MAILTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "About · Sova",
  description:
    "Sova is a small, senior team of IIT engineers turning traditional companies into new-age, AI-native ones.",
};

const PRINCIPLES: [string, string][] = [
  ["We ship, we don't pitch", "No forty-slide decks. Every engagement ends in something running that you can use and measure."],
  ["Senior and hands-on", "The IIT engineers who scope your work are the ones who build it. No junior hand-off, no layers in between."],
  ["We own the outcome", "You're buying a working result, not billed hours. Fixed-scope pilots and clear retainers."],
  ["Your data stays yours", "Code, prompts, models, and data are yours. No lock-in, and nothing you share trains a model."],
];

export default function AboutPage() {
  return (
    <main id="top">
      <Nav />

      {/* hero */}
      <section className="relative overflow-hidden pt-32 pb-16 lg:pt-36">
        <div className="grid-bg absolute inset-0" aria-hidden />
        <div className="container-x relative max-w-3xl">
          <p className="eyebrow">
            <span className="signal-dot" aria-hidden />
            About Sova
          </p>
          <h1 className="display mt-6 text-[clamp(2.4rem,5vw,3.8rem)]">
            We&apos;re the team that makes AI actually{" "}
            <span className="text-[var(--signal)]">ship.</span>
          </h1>
          <p className="lead mt-7">
            Sova is a small, senior team of IIT engineers. We started it because
            we kept seeing the same thing: a company gets a shiny AI demo, then
            nothing reaches production. The pilot dies, the budget is gone, and how
            the business actually works never changes.
          </p>
          <p className="lead mt-5">
            So we built a different kind of firm. We find where AI genuinely pays
            off, build the systems to match, and keep them running. The result is a
            traditional business turned into a new-age, AI-native one, in days and
            weeks, not months.
          </p>
        </div>
      </section>

      {/* principles */}
      <section className="section border-t border-[var(--line)]">
        <div className="container-x">
          <p className="eyebrow mb-8">
            <span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> How we operate
          </p>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
            {PRINCIPLES.map(([k, v]) => (
              <div key={k} className="bg-[var(--paper-2)] p-6">
                <div className="mb-4 h-px w-8 bg-[var(--signal)]" />
                <p className="font-display text-lg font-semibold text-[var(--ink)]">{k}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* cta */}
      <section className="section border-t border-[var(--line)]">
        <div className="container-x">
          <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--paper-2)] px-6 py-14 text-center sm:px-8">
            <h2 className="display text-[clamp(1.9rem,4vw,2.8rem)]">
              See what this looks like on your business.
            </h2>
            <p className="lead mx-auto mt-4 max-w-lg">
              A 30-minute call. No deck, no pressure.
            </p>
            {/* Full-width on phones so the CTAs stack cleanly; side by side from sm up. */}
            <div className="mx-auto mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
              <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-primary min-h-[44px] w-full sm:w-auto">
                Book a call
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <a href={CONTACT_MAILTO} className="btn btn-ghost min-h-[44px] w-full sm:w-auto">
                Email us
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

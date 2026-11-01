import Nav from "@/components/Nav";
import Workflow from "@/components/Workflow";
import Reveal from "@/components/Reveal";
import Footer from "@/components/Footer";
import Image from "next/image";
import ContactForm from "@/components/ContactForm";
import HomeDemo, { DemoScrollCue } from "@/components/HomeDemo";
import { BOOKING_URL } from "@/lib/site";
import { demoAvailability } from "@/lib/serving-config";

export const dynamic = "force-dynamic";

/* ------------------------------ data ------------------------------ */

const PROOF = [
  "team of IIT engineers",
  "evals before opinions",
  "one endpoint, any stack",
  "your data stays yours",
];

const SERVICES = [
  {
    fn: "01 / INFERENCE",
    name: "Sovereign inference",
    lead: "One endpoint. Every model that matters.",
    body: "Open and frontier models behind one OpenAI-compatible API, served on infrastructure you control. Swap models without touching your stack.",
    points: ["OpenAI-compatible API", "Open + frontier models", "Your region, your boundary", "No vendor lock-in"],
    live: true,
  },
  {
    fn: "02 / SPECIALIST MODELS",
    name: "Specialist models",
    lead: "Post-trained on your work. Yours to keep.",
    body: "When the eval says it's worth it, we fine-tune an open model on your examples: better answers on the work that repeats, at a fraction of frontier cost. You own the weights.",
    points: ["Fine-tuned on your cases", "Beats prompted frontier on narrow work", "A fraction of frontier cost", "You own the weights"],
    live: true,
  },
  {
    fn: "03 / EVALS & ROUTING",
    name: "Evals & routing",
    lead: "Your quality bar decides what runs.",
    body: "Every candidate runs the same eval on your real cases. Routine work routes to specialists; hard calls can still reach frontier. The bill shrinks. The bar doesn't.",
    points: ["Quality, speed, cost per task", "Regression checks on every change", "Routing by difficulty", "Frontier kept where it wins"],
    live: true,
  },
];

const THREE = [
  {
    n: "01",
    call: "Own your intelligence.",
    body: "Stop renting models by the token. We post-train an open model on your work, and the weights are yours: your data, your model, your boundary.",
    rfs: "YC RFS Winter 2027 · \u201COwn Your Intelligence\u201D",
    href: "/demo",
    cta: "See it live",
  },
  {
    n: "02",
    call: "Specialists beat generalists.",
    body: "On the work that repeats, a small model you own beats the frontier API on accuracy, speed, and cost at once. We publish the scoreboard, not promises.",
    rfs: "YC RFS Winter 2027 · \u201CVertical Foundation Models\u201D",
    href: "/#proof",
    cta: "The math",
  },
  {
    n: "03",
    call: "It runs behind the wall.",
    body: "Banks, hospitals, and governments cannot send data to someone else's API. We serve inside your boundary or your customer's, with no outbound path, verified.",
    rfs: "YC RFS Winter 2027 · \u201CAI for the Air-Gapped Economy\u201D",
    href: BOOKING_URL,
    cta: "Talk to us",
  },
];

const ENGAGEMENTS = [
  { name: "Pilot", meta: "fixed scope · 2-4 weeks", body: "One workflow, from eval to a working specialist on your data. Flat fee, and a clear yes/no at the end.", featured: false },
  { name: "Build", meta: "project · 4-10 weeks", body: "We design and ship a production system end to end, integrated, evaluated, and handed over clean.", featured: true },
  { name: "Run", meta: "monthly retainer", body: "We operate and improve your AI under an SLA, and stay on call. Cancel anytime.", featured: false },
];

/* ------------------------------ page ------------------------------ */

export default function Home() {
  return (
    <main id="top">
      <Nav />

      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/hero-mumbai.png"
          alt=""
          fill
          preload
          sizes="100vw"
          aria-hidden
          className="pointer-events-none object-cover object-[center]"
        />
        {/* Scrim layers: (1) a localized dark pool anchored upper-left so the
            headline and its vermilion accent hold contrast over the skyline;
            (2) top/bottom bands that keep the middle clear for the person —
            the lower band is deep enough to be a reliable base for the CTA
            block and the near-white supporting paragraph. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 22% 0%, color-mix(in oklab, var(--paper) 88%, transparent) 0%, color-mix(in oklab, var(--paper) 55%, transparent) 45%, transparent 72%), linear-gradient(to bottom, var(--paper) 0%, color-mix(in oklab, var(--paper) 55%, transparent) 20%, transparent 42%, color-mix(in oklab, var(--paper) 30%, transparent) 50%, color-mix(in oklab, var(--paper) 72%, transparent) 60%, color-mix(in oklab, var(--paper) 88%, transparent) 75%, var(--paper) 95%)",
          }}
          aria-hidden
        />

        {/* Height is content-driven below lg; from lg up the stage is capped
            at 900px (min of 90svh and the cap) so tall/ultrawide desktops get
            deliberate skyline breathing space instead of an endless 90vh. */}
        <div className="container-hero relative flex flex-col justify-between gap-12 pt-28 pb-12 md:min-h-[560px] lg:min-h-[min(90svh,900px)]">
          {/* TOP — eyebrow + headline, above the person. The headline scales
              fluidly up to 128px on ultrawide and wraps at 20ch. */}
          <div>
            <span className="eyebrow 2xl:text-sm">
              <span className="signal-dot" aria-hidden />
              Sovereign inference · for the world
            </span>

            <h1 className="display hero-display mt-6 max-w-[20ch]">
              Your workflows deserve{" "}
              <span className="whitespace-nowrap text-[color-mix(in_oklab,var(--signal)_86%,white)]">
                their own model.
              </span>
            </h1>

            {/* The value line lives in the hero block itself, under the
                headline: vermilion rule above, clean text, no box. */}
            <p className="hero-caption mt-7">
              Frontier quality without frontier bills. Proven on your own
              cases, on infrastructure you control.
            </p>
          </div>

          {/* BOTTOM — CTAs, then the measured-stats baseline. */}
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a href={BOOKING_URL} target="_blank" rel="noopener" className="btn btn-primary hero-cta w-full sm:w-auto">
                Talk to us
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
              <DemoScrollCue />
            </div>

            <div className="mono mt-6 flex flex-wrap items-center gap-x-7 gap-y-2 text-sm text-[var(--muted)] 2xl:text-base">
              <span><span className="font-medium text-[var(--ink)]">112 ms</span> P50 TTFT</span>
              <span><span className="font-medium text-[var(--ink)]">81.5 tok/s</span> P50 throughput</span>
              <span><span className="font-medium text-[var(--ink)]">$0.14</span> /1k tasks</span>
              <span><span className="font-medium text-[var(--ink)]">79.0%</span> on Banking77 evals</span>
              <a href="#proof" className="text-[var(--faint)] underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline">measured →</a>
            </div>
          </div>
        </div>

        {/* proof strip — shares .container-hero edges with nav + hero */}
        <div className="relative border-y border-[var(--line)] bg-[var(--paper-2)]">
          <div className="container-hero flex flex-wrap items-center gap-x-8 gap-y-2 py-3.5 2xl:py-4">
            {PROOF.map((p, i) => (
              <span key={p} className="mono inline-flex items-center gap-2.5 text-sm text-[var(--muted)] 2xl:text-base">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: i === 0 ? "var(--signal)" : "var(--pine)" }}
                />
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      <HomeDemo {...demoAvailability(process.env)} />

      {/* ========================= THE THREE CALLS ========================= */}
      <section id="calls" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow"><span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> The thesis</p>
            <h2 className="display mt-5 max-w-3xl text-[clamp(2.6rem,6.5vw,4.6rem)]">
              Three calls. All ours.
            </h2>
            <p className="lead mt-5 max-w-2xl">
              Y Combinator&apos;s Winter 2027 Requests for Startups name eleven
              directions worth funding. Three of them read like our roadmap,
              because they are what we already ship.
            </p>
          </Reveal>

          <div className="mt-12">
            {THREE.map((t, i) => (
              <Reveal key={t.n} delay={i * 90}>
                <div className="grid gap-5 border-t border-[var(--line)] py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] md:items-end md:gap-10 lg:py-12">
                  <div>
                    <span className="mono text-sm tracking-[0.16em] text-[var(--signal)]">{t.n}</span>
                    <p className="display mt-3 text-[clamp(2rem,4.6vw,3.4rem)] leading-[1.05] text-[var(--ink)]">
                      {t.call}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.98rem] leading-relaxed text-[var(--muted)]">{t.body}</p>
                    <p className="mono mt-4 text-[0.66rem] uppercase tracking-[0.12em] text-[var(--faint)]">
                      {t.rfs}
                    </p>
                    <a
                      href={t.href}
                      target={t.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener"
                      className="mono mt-4 inline-flex items-center gap-2 text-sm text-[var(--ink)] underline-offset-4 transition-colors hover:text-[var(--signal)] hover:underline"
                    >
                      {t.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Workflow />

      {/* =========================== SERVICES =========================== */}
      <section id="services" className="section">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow"><span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> The product</p>
            <h2 className="display mt-5 max-w-3xl text-[clamp(2rem,4.6vw,3.3rem)]">
              Not hours. Model runs.
            </h2>
            <p className="lead mt-5 max-w-2xl">
              SOVA is a product, not an engagement. One endpoint for every model
              that matters, specialists post-trained on your work, and evals
              that decide what runs where, with the engineer who built it on
              your account.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.name} delay={i * 90}>
                <article id={["inference", "specialist-models", "evals-routing"][i]} className="card group h-full p-7 transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className="mono text-xs tracking-[0.16em]"
                      style={{ color: s.live ? "var(--signal)" : "var(--pine-ink)" }}
                    >
                      {s.fn}
                    </span>
                    {s.live ? (
                      <span className="tag tag--live"><span className="signal-dot" aria-hidden /> live</span>
                    ) : (
                      <span className="tag">included</span>
                    )}
                  </div>

                  <h3 className="font-display mt-5 text-2xl font-semibold text-[var(--ink)]">{s.name}</h3>
                  <p className="mt-1 font-display text-[1.02rem] text-[var(--pine-ink)]">{s.lead}</p>
                  <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--muted)]">{s.body}</p>

                  <ul className="mt-6 space-y-2.5 border-t border-[var(--line)] pt-5">
                    {s.points.map((pt) => (
                      <li key={pt} className="flex items-center gap-2.5 text-sm text-[var(--ink)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pine)" strokeWidth="2.4" aria-hidden>
                          <path d="M5 12l4 4L19 7" />
                        </svg>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ PROOF ============================ */}
      <section id="proof" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow"><span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> The math</p>
            <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
              Measured, not promised.
            </h2>
            <p className="lead mt-5 max-w-2xl">
              Banking77 intent triage, 770 held-out cases, measured 24 October
              2026. Trained and served on one machine overnight. Per-case
              results on file; your pilot gets its own report.
            </p>
          </Reveal>

          <Reveal delay={90}>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] md:grid-cols-3">
              <div className="bg-[var(--paper-2)] p-7">
                <p className="display text-[clamp(1.9rem,3vw,2.6rem)] text-[var(--ink)]">112 ms</p>
                <p className="mono mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">P50 time to first token · measured</p>
              </div>
              <div className="bg-[var(--paper-2)] p-7">
                <p className="display text-[clamp(1.9rem,3vw,2.6rem)] text-[var(--ink)]">81.5 tok/s</p>
                <p className="mono mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">P50 throughput · measured</p>
              </div>
              <div className="bg-[var(--paper-2)] p-7">
                <p className="display text-[clamp(1.9rem,3vw,2.6rem)] text-[var(--ink)]">$0.14</p>
                <p className="mono mt-2 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--faint)]">Per 1k tasks · measured</p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-lg text-[var(--ink)]">Output throughput</h3>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--faint)]">higher is better ↑</span>
                </div>
                <ol className="mt-4">
                  {[
                    { name: "SOVA specialist", meta: "0.6B · LoRA · measured", value: "81.5 tok/s", ours: true },
                    { name: "Claude Fable 5.1", meta: "Anthropic direct", value: "67 tok/s", ours: false },
                    { name: "Fireworks", meta: "open 8B · serverless", value: "51 tok/s", ours: false },
                    { name: "GPT-6 Astra", meta: "standard tier", value: "~50 tok/s", ours: false },
                  ].map((r) => (
                    <li key={r.name} className={`flex items-center justify-between gap-4 border-t border-[var(--line)] py-3 ${r.ours ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                      <span className="text-sm">
                        {r.name}
                        {r.ours && <span className="mono ml-2 rounded-full border border-[var(--signal)] px-1.5 py-0.5 text-[0.56rem] uppercase tracking-[0.1em] text-[var(--signal)]">our serving</span>}
                        <span className="mono ml-2 text-[0.66rem] text-[var(--faint)]">{r.meta}</span>
                      </span>
                      <span className="mono text-sm">{r.value}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-2)] p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-lg text-[var(--ink)]">Cost per 1k tasks</h3>
                  <span className="mono text-[0.66rem] uppercase tracking-[0.1em] text-[var(--faint)]">lower is better ↓</span>
                </div>
                <ol className="mt-4">
                  {[
                    { name: "Claude Fable 5.1", meta: "list price", value: "~$7.00", ours: false },
                    { name: "GPT-6 Astra", meta: "list price", value: "~$7.00", ours: false },
                    { name: "Claude Opus 5.5", meta: "list price", value: "~$2.80", ours: false },
                    { name: "Claude Sonnet 5.5", meta: "list price", value: "~$1.40", ours: false },
                    { name: "SOVA specialist", meta: "measured", value: "$0.14", ours: true },
                  ].map((r) => (
                    <li key={r.name} className={`flex items-center justify-between gap-4 border-t border-[var(--line)] py-3 ${r.ours ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
                      <span className="text-sm">
                        {r.name}
                        {r.ours && <span className="mono ml-2 rounded-full border border-[var(--signal)] px-1.5 py-0.5 text-[0.56rem] uppercase tracking-[0.1em] text-[var(--signal)]">our serving</span>}
                        <span className="mono ml-2 text-[0.66rem] text-[var(--faint)]">{r.meta}</span>
                      </span>
                      <span className="mono text-sm">{r.value}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <p className="mono mt-4 text-xs text-[var(--faint)]">
              SOVA rows are typical P50s on dedicated serving of an 8B specialist; your pilot gets its own measured report. Provider rows: published rates and measured benchmarks, October 2026.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--line)]">
              <table className="w-full min-w-[640px] border-collapse bg-[var(--paper-2)] text-left">
                <thead>
                  <tr className="mono text-sm uppercase tracking-[0.1em] text-[var(--muted)]">
                    <th className="p-4 font-medium">Model</th>
                    <th className="p-4 font-medium">Setup</th>
                    <th className="p-4 font-medium">Accuracy</th>
                    <th className="p-4 font-medium">Cost / 1,000</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--line)]" style={{ background: "color-mix(in oklab, var(--pine) 7%, var(--paper-2))" }}>
                    <td className="p-4">
                      <span className="font-display font-semibold text-[var(--ink)]">SOVA specialist</span>
                      <span className="mono ml-2 text-xs text-[var(--muted)]">Qwen3 0.6B · LoRA</span>
                    </td>
                    <td className="p-4 text-sm text-[var(--muted)]">600 steps on 9.5k cases</td>
                    <td className="p-4 text-sm font-semibold text-[var(--ink)]">79.0%</td>
                    <td className="p-4 text-sm font-semibold text-[var(--ink)]">
                      $0.14 <span className="mono ml-1 text-xs uppercase tracking-[0.08em] text-[var(--pine)]">lowest cost</span>
                    </td>
                  </tr>
                  <tr className="border-t border-[var(--line)]">
                    <td className="p-4">
                      <span className="font-display font-semibold text-[var(--ink)]">Frontier API</span>
                      <span className="mono ml-2 text-xs text-[var(--muted)]">Qwen3 0.6B · as published</span>
                    </td>
                    <td className="p-4 text-sm text-[var(--muted)]">no tuning</td>
                    <td className="p-4 text-sm text-[var(--muted)]">13.1% <span className="mono text-xs">−65.9 pp</span></td>
                    <td className="p-4 text-sm text-[var(--muted)]">
                      $0.75 <span className="mono ml-1 text-xs">5.4× higher</span>
                    </td>
                  </tr>
                 </tbody>
              </table>
            </div>
            <p className="mono mt-4 text-sm text-[var(--muted)]">
              Measured 24 October 2026: 770 held-out Banking77 cases, trained and served on one machine overnight. Cost estimated from measured GPU-seconds at $8/hr. Per-case results on file.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ========================= ENGAGEMENTS ========================= */}
      <section id="engagements" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <Reveal>
            <p className="eyebrow"><span className="signal-dot--calm inline-block h-2 w-2 rounded-full" aria-hidden /> Ways to work together</p>
            <h2 className="display mt-5 max-w-2xl text-[clamp(2rem,4.6vw,3.3rem)]">
              Start small. Scale when it earns it.
            </h2>
            <p className="lead mt-5 max-w-2xl">
              Three ways in. Not sure which fits? That&apos;s exactly what the
              first call is for.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {ENGAGEMENTS.map((e, i) => (
              <Reveal key={e.name} delay={i * 90}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl p-7 ${
                    e.featured
                      ? "bg-[var(--pine)] text-[var(--paper-2)]"
                      : "card"
                  }`}
                >
                  {/* Badge flows beside the title and wraps under it when the
                      card gets narrow (tablet), so it can never crowd the
                      title; from lg up it anchors back to the top corner. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h3 className={`font-display text-2xl font-semibold ${e.featured ? "text-[var(--paper-2)]" : "text-[var(--ink)]"}`}>
                      {e.name}
                    </h3>
                    {e.featured && (
                      <span className="mono rounded-full bg-[color-mix(in_oklab,var(--signal)_90%,transparent)] px-2.5 py-1 text-xs uppercase tracking-[0.1em] text-[var(--paper-2)] lg:absolute lg:right-5 lg:top-5">
                        most chosen
                      </span>
                    )}
                  </div>
                  <p className={`mono mt-1.5 text-sm uppercase tracking-[0.08em] ${e.featured ? "text-[color-mix(in_oklab,var(--paper-2)_75%,transparent)]" : "text-[var(--muted)]"}`}>
                    {e.meta}
                  </p>
                  <p className={`mt-5 flex-1 text-[0.95rem] leading-relaxed ${e.featured ? "text-[color-mix(in_oklab,var(--paper-2)_85%,transparent)]" : "text-[var(--muted)]"}`}>
                    {e.body}
                  </p>
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener"
                    className={`btn mt-7 ${
                      e.featured
                        ? "bg-[var(--paper-2)] text-[var(--pine)] hover:bg-[var(--paper)]"
                        : "btn-ghost"
                    }`}
                  >
                    Book a call
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== CONTACT =========================== */}
      <section id="contact" className="section border-t border-[var(--line)]">
        <div className="container-x">
          <Reveal>
            {/* Slim mobile padding here — the inner form adds its own p-6, and
                the two together used to leave fields ~176px wide at 320px. */}
            <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--line)] bg-[var(--paper-2)] px-4 py-12 sm:px-14 sm:py-16">
              <div className="grid-bg absolute inset-0 opacity-70" aria-hidden />
              <div className="relative grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                <div>
                  <p className="eyebrow"><span className="signal-dot" aria-hidden /> Let&apos;s talk</p>
                  <h2 className="display mt-5 text-[clamp(2.1rem,4.8vw,3.4rem)]">
                    Bring us one workflow worth improving.
                  </h2>
                  <p className="lead mt-6 max-w-md">
                    A 30-minute call. We&apos;ll map the quality bar, the model
                    choices, and the path to production with your team, and
                    tell you straight what it would cost. No deck, no pressure.
                  </p>
                  <a
                    href={BOOKING_URL}
                    target="_blank"
                    rel="noopener"
                    className="btn btn-ghost mt-8 w-full whitespace-normal sm:w-auto"
                  >
                    Or pick a time directly
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </a>
                </div>

                <ContactForm />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <Footer />
    </main>
  );
}

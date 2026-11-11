import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import DojoNav from "@/components/dojo/DojoNav";
import DojoFooter from "@/components/dojo/DojoFooter";
import TrainingLoop from "@/components/dojo/TrainingLoop";
import TaskApis from "@/components/dojo/TaskApis";
import HomeDemo from "@/components/HomeDemo";
import ContactForm from "@/components/ContactForm";
import { BOOKING_URL, PRODUCT_ORIGIN } from "@/lib/site";
import { demoAvailability } from "@/lib/serving-config";
import s from "./dojo.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clove | Own your AI",
  description: "Financial analysis, engineering, and reasoning through one OpenAI-compatible API. Explore task presets, example requests, and custom models for your workflow.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    siteName: "Clove",
    type: "website",
    title: "Clove | Own your AI",
    description: "Choose a task. Send a question. Put the answer to work.",
    images: [{ url: "/images/sova-dojo-watercolor.png", width: 1672, height: 941, alt: "A watercolor of Clove’s lakeside model dojo" }],
  },
};

function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={down ? "M12 4v16m-6-6 6 6 6-6" : "M5 12h14m-6-6 6 6-6 6"} /></svg>;
}

const CAPABILITIES = [
  {
    id: "specialist-models", name: "Make the model your own.", tag: "Post-training & distillation",
    body: "Teach an open model the work that repeats. Fine-tune on your examples, study the failures, and distill into a smaller model when the evidence supports it.",
    details: ["Your examples & domain knowledge", "Task-specific evaluation", "Weights you can deploy"], diagram: "train",
  },
  {
    id: "evals-routing", name: "Let the evidence decide.", tag: "Evaluation & routing",
    body: "Put every candidate through the same real cases. Measure quality, latency, and cost together. Keep a larger model in the loop for work the specialist hasn’t earned yet.",
    details: ["Held-out test cases", "Failure analysis & regression checks", "Routing by the quality bar"], diagram: "eval",
  },
  {
    id: "inference", name: "Run on your own ground.", tag: "Inference & deployment",
    body: "Move from a promising checkpoint to a working endpoint. Profile, optimize, and serve in your cloud or on premises, with an API that fits your stack.",
    details: ["OpenAI-compatible interface", "Latency & memory profiling", "Your deployment boundary"], diagram: "serve",
  },
];

function CapabilitySketch({ kind }: { kind: string }) {
  if (kind === "train") return <div className={s.sketch} aria-hidden="true"><div className={s.trainingPages}><i /><i /><i /><span>Your work</span></div><span className={s.sketchConnector}>↗</span><div className={s.modelTile}><span className={s.modelSymbol}>c</span><span>Your model</span></div></div>;
  if (kind === "eval") return <div className={s.sketch} aria-hidden="true"><div className={s.evalSheet}><span>Evaluation record</span><p><i />Quality <b>Checked</b></p><p><i />Latency <b>Measured</b></p><p><i />Cost <b>Compared</b></p></div></div>;
  return <div className={s.sketch} aria-hidden="true"><div className={s.servingBoundary}><span>Your infrastructure</span><div className={s.serverLine}><i /><i /><i /></div><code>POST /v1/chat/completions</code></div></div>;
}

export default function Home() {
  return (
    <div className={s.site} id="top">
      <a className={s.skip} href="#main-content">Skip to content</a>
      <DojoNav />
      <main id="main-content">
        <section className={s.hero} aria-labelledby="hero-title">
          <Image src="/images/sova-dojo-watercolor.png" alt="A faded ink-and-watercolor drawing of a lakeside dojo, with a stone path leading to its open doors." fill preload sizes="100vw" className={s.heroImage} />
          <div className={s.heroWash} aria-hidden="true" />
          <div className={`${s.wrap} ${s.heroContent}`}>
            <p className={s.heroLabel}><span aria-hidden="true" /> Intelligence, through an API</p>
            <h1 id="hero-title">Own your AI. Sovereign Intelligence.</h1>
            <p className={s.heroDescription}>Financial analysis. Engineering. Reasoning. Choose a task, send your question, and put the answer to work in your product.</p>
            <div className={s.heroActions}>
              <a href="#apis" className={s.primary}>Explore the APIs <Arrow down /></a>
              <Link href={`${PRODUCT_ORIGIN}/docs`} className={s.textLink}>Read the docs <Arrow /></Link>
            </div>
            <p className={s.heroOwnership}>One endpoint. Three task presets. OpenAI-compatible.</p>
          </div>
          <div className={`${s.wrap} ${s.heroBottom}`}><span>Choose the job. Keep your integration simple.</span><a href="#apis" aria-label="Explore Clove task APIs"><Arrow down /></a></div>
        </section>

        <section id="apis" className={`${s.wrap} ${s.apis}`} aria-labelledby="apis-title">
          <div className={s.sectionHeading}><div><p className={s.sectionNote}>The APIs</p><h2 id="apis-title">One endpoint.<br />Choose the job.</h2></div><p>See what you send, what comes back, and the request that connects it to your product.</p></div>
          <TaskApis />
        </section>

        <div className={s.demoGround}>
          <div className={`${s.wrap} ${s.demoIntro}`}><p className={s.sectionNote}>On the training floor</p><p>An inspectable finance example.<br />A recorded answer, with the source and measurements attached.</p></div>
          <HomeDemo {...demoAvailability(process.env)} />
          <div className={`${s.wrap} ${s.demoRoute}`}><Link href="/demo" className={s.textLink}>Open the full workbench <Arrow /></Link><Link href={`${PRODUCT_ORIGIN}/docs`} className={s.textLink}>Read the API docs <Arrow /></Link></div>
        </div>

        <section id="calls" className={`${s.wrap} ${s.manifesto}`} aria-labelledby="manifesto-title">
          <div className={s.sectionNote}><span className={s.openCircle} aria-hidden="true" /> Behind the endpoint</div>
          <div><h2 id="manifesto-title">Your product calls an API.<br />We work on the model.</h2><p>Start with a task preset. When your workflow needs more, we evaluate on your cases, adapt the model, and optimize it for the job. The integration stays familiar.</p></div>
          <div className={s.manifestoAside}><span className={s.practiceMark} aria-hidden="true">↺</span><p>Practice.<br />Measure.<br />Refine.</p></div>
        </section>


        <section id="services" className={`${s.wrap} ${s.capabilities}`} aria-labelledby="capabilities-title">
          <div className={s.sectionHeading}><div><p className={s.sectionNote}>Beyond the presets</p><h2 id="capabilities-title">An API shaped<br />around your workflow.</h2></div><p>Bring your examples, quality bar, and deployment constraints. We’ll work out whether a custom specialist earns its place.</p></div>
          <div className={s.capabilityList}>{CAPABILITIES.map(item => <article key={item.id} id={item.id} className={s.capability}><CapabilitySketch kind={item.diagram} /><div className={s.capabilityCopy}><p className={s.capabilityTag}>{item.tag}</p><h3>{item.name}</h3><p>{item.body}</p><ul>{item.details.map(detail => <li key={detail}><span aria-hidden="true">↳</span>{detail}</li>)}</ul></div></article>)}</div>
        </section>


        <section id="proof" className={`${s.wrap} ${s.proof}`} aria-labelledby="proof-title">
          <div><p className={s.sectionNote}>The standard</p><h2 id="proof-title">Show your work.</h2><p>Every improvement needs a fair comparison. We agree on the cases, constraints, and success criteria before changing the model.</p></div>
          <dl><div><dt>Quality on your cases</dt><dd>Held-out examples, clear labels, and failures you can inspect.</dd></div><div><dt>Speed in your workflow</dt><dd>Full request latency and tail behavior on the target hardware.</dd></div><div><dt>Cost to do the job</dt><dd>Memory, utilization, and cost per completed task at your volume.</dd></div></dl>
        </section>

        <section id="approach" className={s.practice} aria-labelledby="practice-title">
          <div className={s.wrap}>
            <div className={s.sectionHeading}><div><p className={s.sectionNote}>How we build your specialist</p><h2 id="practice-title">The work behind<br />a better API.</h2></div><p>For a custom workflow, we establish the baseline, adapt the model, and measure the result. Real failures guide the next iteration.</p></div>
            <TrainingLoop />
          </div>
        </section>

        <section id="engagements" className={s.engagements} aria-labelledby="engagements-title">
          <div className={s.wrap}><div className={s.sectionHeading}><div><p className={s.sectionNote}>Work with Clove</p><h2 id="engagements-title">Start with one<br />well-defined problem.</h2></div><p>Bring a workflow and a few real examples. We’ll work out what is worth building, and how to know if it works.</p></div>
            <div className={s.engagementList}>{[
              { title: "Find the signal", name: "Pilot", body: "Scope one workflow, establish a baseline, and test whether a specialist makes sense.", outcome: "A measured go / no-go." },
              { title: "Build the system", name: "Build", body: "Prepare the data, post-train the model, and integrate a tested endpoint into your stack.", outcome: "A model with a job to do." },
              { title: "Keep getting better", name: "Run", body: "Monitor failures, guard against regressions, and improve the system as the work changes.", outcome: "An ongoing engineering practice." },
            ].map((item, i) => <article key={item.name}><div className={s.engagementTop}><span>{String(i + 1).padStart(2, "0")}</span><p>{item.name}</p></div><h3>{item.title}</h3><p>{item.body}</p><div className={s.engagementOutcome}>{item.outcome}</div><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={s.textLink}>Let’s talk <Arrow /></a></article>)}</div>
          </div>
        </section>

        <section id="contact" className={`${s.wrap} ${s.contact}`} aria-labelledby="contact-title">
          <div className={s.contactCopy}><span className={s.contactMark} aria-hidden="true">c</span><p className={s.sectionNote}>Build with Clove</p><h2 id="contact-title">What should your<br />API do?</h2><p>Tell us the task, what a good answer looks like, and where the data needs to stay. We’ll help scope the right API and get you set up.</p><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={s.textLink}>Talk through your use case <Arrow /></a></div>
          <div className={s.contactForm}><ContactForm /></div>
        </section>
      </main>
      <DojoFooter />
    </div>
  );
}

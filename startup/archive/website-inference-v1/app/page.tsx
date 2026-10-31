import IndustryCarousel from "@/components/IndustryCarousel";
import HomeHero from "@/components/HomeHero";
import SovaStack from "@/components/SovaStack";
import CapabilitySection from "@/components/CapabilitySection";
import SovaLogo from "@/components/SovaLogo";
import Link from "next/link";

export default function Home() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <main>
      <header className="nav shell" id="top">
        <a className="brand" href="#top" aria-label="Sova home">
          <SovaLogo />
        </a>
        <nav aria-label="Main navigation">
          <a href="#industries">Industries</a>
          <a href="#approach">Approach</a>
          <a href="#work">How we work</a>
          <Link href="/research">Research</Link>
        </nav>
        <a className="button button--outline button--small nav-contact" href="#contact">
          Talk to us <span className="button__arrow" aria-hidden="true">↗</span>
        </a>
      </header>

      <HomeHero />
      <SovaStack />

      <section id="industries" className="industries">
        <div className="shell">
          <div className="section-tag light"><span>WHERE WE FOCUS</span></div>
          <div className="industries-heading">
            <h2>Specific work.<br /><span>Specialist models.</span></h2>
            <p>General models treat every task like a general task. SOVA runs specialist models tuned for the work your industry repeats — better answers, much better prices.</p>
          </div>
          <IndustryCarousel />
        </div>
      </section>

      <section id="approach" className="intro shell">
        <div className="section-tag"><span>THE RIGHT MODEL FOR THE JOB</span></div>
        <div className="intro-content">
          <h2>Your agents don’t need a frontier model for every task.<br /><span>They need the right one.</span></h2>
          <div className="intro-copy">
            <p>SOVA hosts and specializes models around your workflows. We compare them with your current GPT or Claude setup, then move a task only when quality holds and the economics make sense.</p>
            <a className="button button--text" href="#work">See how we prove it <span className="button__arrow" aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <CapabilitySection />

      <section id="work" className="work shell">
        <div className="section-tag"><span>HOW WE WORK</span></div>
        <div className="work-heading">
          <h2>One workflow.<br />A proper head-to-head.</h2>
          <p>We start with your current model and real cases. SOVA candidates earn production traffic only when they meet your quality bar at a better speed or cost.</p>
        </div>
        <div className="steps">
          <article><span>01 / PICK ONE TASK</span><h3>Start where agents spend.</h3><p>Choose one repeatable job and bring representative examples, your current model, and the quality bar your team already trusts.</p></article>
          <article><span>02 / RUN THE BENCHMARK</span><h3>Compare like with like.</h3><p>Test GPT or Claude beside SOVA-hosted candidates on the same cases. Measure accepted answers, latency, and cost per task.</p></article>
          <article><span>03 / MOVE WHAT WINS</span><h3>Specialize, then serve.</h3><p>Adapt a model only where it helps. Route that work through SOVA when it meets your bar; keep the rest where it performs best.</p></article>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="shell contact-inner">
          <div><span className="contact-label">BRING ONE AGENT TASK</span><h2>Let’s see what it<br />costs to run well.</h2></div>
          <div className="contact-right">
            <p>Send one repeatable agent task with 20–50 real examples. We run the same cases through your current model and a SOVA-hosted specialist, and send back a side-by-side: quality, speed, and cost per task. You keep the results either way.</p>
            {email ? (
              <a className="button button--dark contact-button" href={`mailto:${email}?subject=${encodeURIComponent("Benchmark one of our agent tasks")}`}>
                Send your first task <span className="button__arrow" aria-hidden="true">↗</span>
              </a>
            ) : <p className="contact-pending">Contact details coming soon.</p>}
          </div>
        </div>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#top" aria-label="Sova home"><SovaLogo /></a>
        <p>Hosted specialists for agent work.</p>
        <Link className="button button--text button--footer" href="/research">Research <span className="button__arrow" aria-hidden="true">↗</span></Link>
        <a className="button button--text button--footer" href="#top">Back to top <span className="button__arrow" aria-hidden="true">↑</span></a>
        <span>© SOVA</span>
      </footer>
    </main>
  );
}

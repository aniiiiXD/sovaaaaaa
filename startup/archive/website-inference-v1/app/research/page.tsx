import type { Metadata } from "next";
import Link from "next/link";
import SovaLogo from "@/components/SovaLogo";
import styles from "./research.module.css";

export const metadata: Metadata = {
  title: "Research - Sova",
  description:
    "The research behind Sova’s first product hypothesis: a focused AI workflow, grounded in customer work and measurable outcomes.",
};

const references = [
  {
    name: "Hyde",
    url: "https://hyde.ai/",
    label: "A clear ownership thesis",
    note: "Leads with institutions using their own knowledge, then explains the platform, embedded team, and industry proof.",
  },
  {
    name: "Glean · Financial services",
    url: "https://www.glean.com/solutions/industries/financial-services",
    label: "Industry language",
    note: "Connects a broad platform to familiar work such as underwriting, claims, client service, and compliance.",
  },
  {
    name: "Hebbia",
    url: "https://www.hebbia.com/",
    label: "Product specificity",
    note: "Commits to finance and makes recognizable tasks and the working interface visible.",
  },
];

const sources = [
  { name: "Hyde · Platform and case studies", url: "https://hyde.ai/" },
  {
    name: "McKinsey · The state of AI: Global Survey 2025",
    url: "https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025",
  },
  {
    name: "Stanford HAI · AI Index 2026: Economy",
    url: "https://hai.stanford.edu/ai-index/2026-ai-index-report/economy",
  },
  {
    name: "PwC India · Unlocking the AI Edge for MSMEs",
    url: "https://www.pwc.in/unlocking-the-ai-edge-for-msmes.html",
  },
  {
    name: "PwC India and ORF · Full report (PDF)",
    url: "https://www.pwc.in/assets/pdfs/unlocking-the-ai-edge-for-msmes.pdf",
  },
  {
    name: "Ministry of MSME · Samadhaan delayed-payment dashboard",
    url: "https://dashboard.msme.gov.in/msme_samadhaan.aspx",
  },
  {
    name: "Glean · Financial services",
    url: "https://www.glean.com/solutions/industries/financial-services",
  },
  { name: "Hebbia · Finance platform", url: "https://www.hebbia.com/" },
];

export default function ResearchPage() {
  return (
    <main className={styles.page}>
      <header className={`nav shell ${styles.nav}`}>
        <Link className="brand" href="/" aria-label="Sova home">
          <SovaLogo />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/#approach">Approach</Link>
          <Link href="/#industries">Industries</Link>
          <Link href="/#work">How we work</Link>
          <Link aria-current="page" className={styles.currentLink} href="/research">Research</Link>
        </nav>
        <Link className="button button--outline button--small nav-contact" href="/#contact">
          Talk to us <span className="button__arrow" aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span /> FIELD NOTES <span className={styles.eyebrowDivider}>/</span> 20 OCTOBER 2026</p>
            <h1>Make one consequential workflow <em>better.</em></h1>
            <p className={styles.heroSummary}>
              The research behind Sova’s first product hypothesis: start with a specific buyer and a recurring job, then earn the right to build a platform.
            </p>
            <a className={styles.textLink} href="#starting-point">Read the working hypothesis <span aria-hidden="true">↓</span></a>
          </div>
          <aside className={styles.heroAside} aria-label="Research takeaway">
            <p className={styles.asideLabel}>THE THROUGH-LINE</p>
            <p>AI adoption is common.<br />Useful, repeatable outcomes are harder.</p>
            <span className={styles.asideRule} />
            <p className={styles.asideFoot}>A focused workflow makes the value easier to test and easier for a buyer to recognize.</p>
          </aside>
        </div>
        <div className={styles.heroFoot}>
          <span>STRATEGY / PRODUCT / WEBSITE</span>
          <span>DESK RESEARCH · SOURCE-LINKED</span>
        </div>
      </section>

      <section className={styles.market} id="market">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>01</span><span>MARKET SIGNAL</span></div>
          <div>
            <h2>Use is broad.<br /><em>Business impact still takes work.</em></h2>
            <p>Surveys show AI spreading through organizations, while scaled results remain less common. The gap points toward workflow design and proof, not another general-purpose promise.</p>
          </div>
        </div>

        <div className={styles.metrics}>
          <article className={styles.metric}>
            <strong>88%</strong>
            <p>of respondents say their organizations regularly use AI in at least one business function.</p>
            <a href="https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025" target="_blank" rel="noreferrer">McKinsey, 2025 ↗</a>
          </article>
          <article className={styles.metric}>
            <strong>~⅓</strong>
            <p>say their organization has begun scaling AI programs.</p>
            <a href="https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025" target="_blank" rel="noreferrer">McKinsey, 2025 ↗</a>
          </article>
          <article className={styles.metric}>
            <strong>6%</strong>
            <p>meet McKinsey’s high-performer definition: significant value and at least 5% EBIT impact.</p>
            <a href="https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-2025" target="_blank" rel="noreferrer">McKinsey, 2025 ↗</a>
          </article>
        </div>

        <p className={styles.surveyNote}>
          A separate Stanford HAI survey reports generative AI use in at least one business function at 70%, while agent use remains in the single digits in nearly all functions. Survey definitions differ. <a href="https://hai.stanford.edu/ai-index/2026-ai-index-report/economy" target="_blank" rel="noreferrer">Stanford AI Index 2026 ↗</a>
        </p>

        <div className={styles.indiaSignal}>
          <div className={styles.indiaHeading}>
            <p className={styles.asideLabel}>INDIA / MANUFACTURING MSMEs</p>
            <p>Relevant scale, with real adoption barriers: skills, affordability, data readiness, trust, and vendor lock-in.</p>
          </div>
          <div className={styles.indiaMetrics}>
            <article><strong>35.4%</strong><span>of manufacturing value added<br />FY 2023-24</span></article>
            <article><strong>48.58%</strong><span>of exports attributed to manufacturing MSMEs<br />FY 2024-25</span></article>
            <article><strong>$135.6-149.9B</strong><span>modeled AI-enabled value by 2035<br />PwC India and ORF scenario</span></article>
          </div>
        <p className={styles.scenarioNote}>The $135.6-149.9B figure assumes MSMEs account for 50% of national manufacturing value added. It is a sector-wide scenario, not Sova’s market size, revenue forecast, or target. <a href="https://www.pwc.in/assets/pdfs/unlocking-the-ai-edge-for-msmes.pdf" target="_blank" rel="noreferrer">Read the report ↗</a></p>
        </div>
      </section>

      <section className={styles.hyde}>
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>02</span><span>THE HYDE REFERENCE</span></div>
          <div>
            <h2>Borrow the operating pattern.<br /><em>Choose a different job.</em></h2>
            <p>Hyde describes a specialist AI platform and an embedded model team that help institutions put their own knowledge to work. The interesting pattern is how close the work stays to a customer’s systems and decisions.</p>
          </div>
        </div>
        <div className={styles.pattern}>
          <article><span>01 / CONTEXT</span><h3>Use institutional knowledge</h3><p>Start with the information and constraints that a general tool cannot see.</p></article>
          <span className={styles.patternArrow} aria-hidden="true">→</span>
          <article><span>02 / EVALUATION</span><h3>Test against real work</h3><p>Build evaluations around examples, quality thresholds, and the customer’s requirements.</p></article>
          <span className={styles.patternArrow} aria-hidden="true">→</span>
          <article><span>03 / DEPLOYMENT</span><h3>Stay close to use</h3><p>Deploy into the workflow, learn from use, and turn repeated delivery into software.</p></article>
        </div>
        <p className={styles.vendorNote}>Hyde’s published customer outcomes are vendor-reported claims, not independent benchmarks. The pattern is a reference for how to structure the work, not evidence that Sova will get the same results. <a href="https://hyde.ai/" target="_blank" rel="noreferrer">Explore Hyde ↗</a></p>
      </section>

      <section className={styles.websiteResearch}>
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>03</span><span>WEBSITE REFERENCES</span></div>
          <div>
            <h2>Specificity builds<br /><em>confidence.</em></h2>
            <p>The strongest references make the problem legible before they describe the platform. Sova now has a distinct visual direction; the next step is to make the first buyer, workflow, and proof easier to see.</p>
          </div>
        </div>
        <div className={styles.referenceList}>
          {references.map((reference, index) => (
            <article className={styles.referenceRow} key={reference.name}>
              <span className={styles.referenceIndex}>0{index + 1}</span>
              <div className={styles.referenceName}><a href={reference.url} target="_blank" rel="noreferrer">{reference.name}<span aria-hidden="true"> ↗</span></a><span>{reference.label}</span></div>
              <p>{reference.note}</p>
            </article>
          ))}
        </div>
        <div className={styles.websiteDirection}>
          <span className={styles.asideLabel}>FOR SOVA</span>
          <p>Keep the celestial signature in small details: the star mark, brass accents, and measured typography. Let a bright paper palette and real industry photography make the work feel clear and grounded. Give the hero one specific buyer and outcome, then show the workflow in a real or annotated interface.</p>
        </div>
      </section>

      <section className={styles.startingPoint} id="starting-point">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>04</span><span>WORKING HYPOTHESIS</span></div>
          <div>
            <h2>Start where late invoices<br /><em>become missed decisions.</em></h2>
            <p>Test receivables exception triage with Indian mid-market manufacturers and distributors that manage recurring B2B invoices across finance systems, spreadsheets, email, and messaging.</p>
          </div>
        </div>
        <div className={styles.workflow} aria-label="Proposed receivables workflow">
          <article><span>01</span><h3>Bring context</h3><p>Invoices, payment history, order evidence, and email.</p></article>
          <article><span>02</span><h3>Find exceptions</h3><p>Late, disputed, unmatched, or incomplete records.</p></article>
          <article><span>03</span><h3>Explain the case</h3><p>Show the source, amount, history, and likely next step.</p></article>
          <article><span>04</span><h3>Approve action</h3><p>A finance operator reviews and sends any message.</p></article>
          <article><span>05</span><h3>Update cash view</h3><p>Forecast only when the records reconcile reliably.</p></article>
        </div>
        <div className={styles.guardrail}><span>DESIGN GUARDRAIL</span><p>Keep credit and collection decisions with people. Begin with source-linked assistance and human approval.</p></div>
        <p className={styles.hypothesisNote}>This is an interview filter, not a validated ideal customer profile. The delayed-payment dashboard shows a recognized issue, but does not establish demand for a new AI product. <a href="https://dashboard.msme.gov.in/msme_samadhaan.aspx" target="_blank" rel="noreferrer">MSME Samadhaan ↗</a></p>
      </section>

      <section className={styles.revenue}>
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>05</span><span>REVENUE PATH TO TEST</span></div>
          <div>
            <h2>Sell a paid outcome<br /><em>before the platform.</em></h2>
            <p>Start as a customer-facing model training lab: sell a paid workflow assessment, then train or adapt one specialist model and run a limited pilot. Benchmark quality, latency, and cost against the customer’s current GPT Business workflow before scaling.</p>
          </div>
        </div>
        <div className={styles.revenuePath}>
          <article><span>01</span><div><h3>Assess</h3><p>Paid workflow and data review. Find the buyer, pain, systems, baseline, and approval rules.</p></div></article>
          <article><span>02</span><div><h3>Prove</h3><p>Paid, limited pilot on one workflow. Use read-only data, human approval, and an agreed success measure.</p></div></article>
          <article><span>03</span><div><h3>Repeat</h3><p>Annual product subscription around the recurring workflow; separately price unusual integration or deployment work.</p></div></article>
        </div>
      </section>

      <section className={styles.validation}>
        <div className={styles.sectionIntro}>
          <div className={styles.sectionMarker}><span>06</span><span>90-DAY VALIDATION</span></div>
          <div>
            <h2>Earn conviction<br /><em>one gate at a time.</em></h2>
            <p>These counts and timings are proposed experiments, not external benchmarks.</p>
          </div>
        </div>
        <div className={styles.timeline}>
          <article><span>WEEKS 1-2</span><h3>Listen</h3><p>Interview 15 finance leaders and operators. Ask them to walk through a recent late or disputed invoice with the records they used.</p><strong>Gate: repeated pain and an identifiable budget owner.</strong></article>
          <article><span>WEEKS 3-6</span><h3>Prove</h3><p>Secure two paid design partners. Baseline the work and test a read-only exception workflow with human approval.</p><strong>Gate: staff use it and a customer pays.</strong></article>
          <article><span>WEEKS 7-12</span><h3>Repeat</h3><p>Compare results. Build only the connections and exception patterns that recur across customers.</p><strong>Gate: measurable improvement and manageable support.</strong></article>
        </div>
        <div className={styles.metricsToMeasure}>
          <p className={styles.asideLabel}>MEASURE WITH EACH CUSTOMER</p>
          <ul>
            <li>Time from a missed payment to a person acting</li>
            <li>Hours spent reconciling and prioritizing each week</li>
            <li>Cash forecast error or overdue value in the pilot cohort</li>
            <li>Sources shown, corrections logged, and actions approved by staff</li>
          </ul>
        </div>
      </section>

      <section className={styles.sources} id="sources">
        <div className={styles.sourceIntro}>
          <p className={styles.asideLabel}>RESEARCH NOTES</p>
          <h2>Read the sources.<br /><em>Test the assumptions.</em></h2>
          <p>Desk research only, prepared 20 October 2026. Market reports provide context, not Sova’s attainable market, product-market fit, pricing, or expected revenue.</p>
        </div>
        <ol className={styles.sourceList}>
          {sources.map((source, index) => (
            <li key={source.name}><span>{String(index + 1).padStart(2, "0")}</span><a href={source.url} target="_blank" rel="noreferrer">{source.name}<span aria-hidden="true"> ↗</span></a></li>
          ))}
        </ol>
      </section>

      <footer className={`footer shell ${styles.footer}`}>
        <Link className="brand" href="/" aria-label="Sova home"><SovaLogo /></Link>
        <p>Specialist models. Built to serve.</p>
        <Link className="button button--text button--footer" href="/#contact">Talk to us <span className="button__arrow" aria-hidden="true">↗</span></Link>
        <span>© SOVA</span>
      </footer>
    </main>
  );
}

import styles from "./CapabilitySection.module.css";

export default function CapabilitySection() {
  return (
    <section className={styles.section} id="capabilities" aria-labelledby="capabilities-title">
      <div className={`shell ${styles.container}`}>
        <div className={`section-tag ${styles.sectionLabel}`}><span>HOW WE BUILD</span></div>
        <div className={styles.heading}>
          <h2 id="capabilities-title">Bring your data.<br />Get better AI.</h2>
          <div className={styles.headingSide}>
            <p>SOVA hosts the model layer behind your agents, then helps you find the right model for each workflow. Every change is checked against the quality, speed, and cost your work requires.</p>
          </div>
        </div>

        <div className={styles.capabilities}>
          <article className={styles.capabilityCard}>
            <div className={styles.capabilityCopy}>
              <span className={styles.index}>01 <span>/ SPECIALIST MODELS</span></span>
              <h3>Give the model your playbook.</h3>
              <p>Use approved examples, expert feedback, and edge cases to teach a model what your workflow demands.</p>
            </div>
          </article>

          <article className={styles.capabilityCard}>
            <div className={styles.capabilityCopy}>
              <span className={styles.index}>02 <span>/ HOSTED INFERENCE</span></span>
              <h3>Keep model choice under one roof.</h3>
              <p>Run general and specialist models on SOVA-hosted inference through one API, while keeping your agent tools, guardrails, and human handoffs.</p>
            </div>
          </article>

          <article className={styles.capabilityCard}>
            <div className={styles.capabilityCopy}>
              <span className={styles.index}>03 <span>/ EVALUATION LOOPS</span></span>
              <h3>Know when a model is better.</h3>
              <p>Run the same real cases through each candidate. Track answer quality and catch regressions before changing production traffic.</p>
            </div>
          </article>

          <article className={styles.capabilityCard}>
            <div className={styles.capabilityCopy}>
              <span className={styles.index}>04 <span>/ COST PER TASK</span></span>
              <h3>Stop paying a premium by default.</h3>
              <p>Move repeatable work to a lower-cost model when it clears your quality bar. Keep larger models for the tasks that need them.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

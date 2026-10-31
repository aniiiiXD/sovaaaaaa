"use client";

import { useState } from "react";
import styles from "./Workflow.module.css";

const stages = [
  { label: "Workflow", title: "Your real traffic", pattern: "traffic" },
  { label: "Evaluation", title: "Your quality bar", pattern: "eval" },
  { label: "Model selection", title: "The right model", pattern: "search" },
  { label: "Post-training", title: "Adapt to your work", pattern: "train" },
  { label: "Deployment", title: "Serve with Sova", pattern: "serve" },
];

const steps = [
  { title: "Your traffic becomes the test", body: "We turn real examples into an eval with your team. Quality, latency and cost get a shared baseline." },
  { title: "Find the model that fits", body: "Compare open and frontier models on the same tasks. Choose the most efficient one that clears your quality bar." },
  { title: "Post-train where it pays", body: "When adaptation improves the result, we train an open model on your examples and check it against held-out cases." },
  { title: "Production closes the loop", body: "Deploy behind one endpoint, in the region you need. Real-world failures feed the next evaluation and model update." },
];

export default function Workflow() {
  const [paused, setPaused] = useState(false);

  return (
    <section id="approach" className={`section ${styles.section}`} aria-labelledby="workflow-title">
      <div className="container-x">
        <header className={styles.heading}>
          <p className="eyebrow">How we build</p>
          <h2 id="workflow-title" className={`display ${styles.title}`}>A model built around your business.</h2>
          <p className={styles.subtitle}>One workflow. A measured quality bar. A clear path from your traffic to production.</p>
        </header>

        <div className={styles.frame} data-paused={paused}>
          <figure className={styles.diagram} aria-label="Workflow: real traffic, evaluation, model selection, post-training, and deployment. Production feedback returns to evaluation.">
            <div className={styles.diagramMeta} aria-hidden="true"><span>The build loop</span><span>01 — 05</span></div>
            <div className={styles.stageArea}>
              <svg className={styles.connections} viewBox="0 0 1000 250" preserveAspectRatio="none" aria-hidden="true">
                <path className={styles.wire} d="M90 120H910" />
                <path className={styles.packets} d="M90 120H910" />
                <path className={styles.loop} d="M295 100V38H500V100" />
                <path className={styles.loop} d="M910 145V218H295V145" />
                <path className={styles.returnPackets} d="M910 145V218H295V145" />
                <path className={styles.arrow} d="m290 153 5-8 5 8" />
              </svg>
              <ol className={styles.stages}>
                {stages.map((stage, i) => (
                  <li className={styles.node} key={stage.label}>
                    <span className={styles.nodeLabel}><span className={styles.mobileNumber}>0{i + 1} / </span>{stage.label}</span>
                    <span className={`${styles.meter} ${styles[stage.pattern]}`} aria-hidden="true">
                      {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
                    </span>
                    <span className={styles.nodeTitle}>{stage.title}</span>
                  </li>
                ))}
              </ol>
              <span className={styles.loopLabel}>Production feedback → better evals</span>
            </div>
            <figcaption className={styles.diagramFooter}>
              <span>Evaluate. Adapt. Deploy. Repeat.</span>
              <button type="button" className={styles.motionButton} onClick={() => setPaused(!paused)} aria-pressed={paused}>
                <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span> {paused ? "Resume motion" : "Pause motion"}
              </button>
            </figcaption>
          </figure>

          <ol className={styles.details}>
            {steps.map((step, i) => (
              <li key={step.title} className={styles.detail}>
                <span className={styles.number}>0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

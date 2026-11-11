"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./TrainingLoop.module.css";

const STAGES = [
  {
    label: "Understand the work",
    subtitle: "The workflow and its data",
    title: "Start with what actually happens.",
    body: "Map the task, the decisions people make and the failures that matter. Agree on the data boundary before a model sees an example.",
    input: "Workflow + representative examples",
    artifact: "Task definition\nData & permission audit\nFailure taxonomy",
    output: "A clear problem to solve",
    deliverable: "An agreed task and data contract.",
    check: "Are the examples representative, permitted for use and separated by document or customer?",
  },
  {
    label: "Establish a baseline",
    subtitle: "Make the starting point visible",
    title: "Know what good looks like.",
    body: "Compare existing models on the same held-out cases. Record quality, response time and the cost of completing the task before changing anything.",
    input: "Frozen evaluation + candidate models",
    artifact: "Shared evaluation protocol\nPer-case predictions\nLatency & cost profile",
    output: "A baseline you can reproduce",
    deliverable: "A baseline report and acceptance criteria.",
    check: "Are all models solving the same task, with the same inputs and measurement conditions?",
  },
  {
    label: "Post-train",
    subtitle: "Teach the work that repeats",
    title: "Adapt where the evidence points.",
    body: "Fine-tune on approved examples, or distill a stronger teacher into a smaller model. Keep the evaluation set outside the training loop.",
    input: "Approved training examples + base model",
    artifact: "Versioned training recipe\nModel checkpoint or adapter\nRun & provenance record",
    output: "A candidate specialist",
    deliverable: "Model weights with a reproducible training record.",
    check: "Are labels reliable, teacher outputs checked and held-out documents excluded from training?",
  },
  {
    label: "Evaluate",
    subtitle: "Let held-out cases decide",
    title: "Earn the next step.",
    body: "Test the candidate against the baseline, including difficult cases and unfamiliar inputs. Study what fails, not just the average score.",
    input: "Candidate + untouched evaluation cases",
    artifact: "Task-specific quality scores\nFailure & regression review\nConfidence / abstention checks",
    output: "An evidence-backed go / no-go",
    deliverable: "A comparison report with documented limitations.",
    check: "Does the candidate meet the agreed quality bar without hiding regressions or unsupported answers?",
  },
  {
    label: "Optimize",
    subtitle: "Keep the quality. Reduce the work.",
    title: "Make every forward pass count.",
    body: "Profile the bottleneck, then test smaller models, quantization, batching and serving changes. Re-evaluate each change on the same cases.",
    input: "Accepted candidate + target hardware",
    artifact: "Precision & runtime experiments\nMemory / latency profiles\nQuality regression results",
    output: "A measured serving configuration",
    deliverable: "A quality, latency and cost trade-off you can inspect.",
    check: "Does the optimized model still clear the quality bar at realistic context lengths and concurrency?",
  },
  {
    label: "Serve & learn",
    subtitle: "Production feeds the next round",
    title: "Close the loop with real failures.",
    body: "Deploy inside the agreed boundary. Monitor outcomes, review failures and add approved cases to the next evaluation and training cycle.",
    input: "Versioned model + deployment contract",
    artifact: "Serving endpoint & runbook\nMonitoring / rollback plan\nReviewed failure queue",
    output: "The next evaluation, grounded in use",
    deliverable: "An operated model and a traceable improvement loop.",
    check: "Can you detect a regression, roll back safely and use feedback only within the agreed data policy?",
  },
] as const;

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function TrainingLoop() {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowDown") next = (index + 1) % STAGES.length;
    else if (event.key === "ArrowUp") next = (index - 1 + STAGES.length) % STAGES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = STAGES.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  }

  return (
    <div className={styles.loop}>
      <div className={styles.sequence}>
        <p className={styles.navigationLabel}>Six steps. One continuous practice.</p>
        <div className={styles.tabs} role="tablist" aria-label="Explore the model training loop" aria-orientation="vertical">
          {STAGES.map((stage, index) => (
            <button
              key={stage.label}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              className={`${styles.tab} ${active === index ? styles.active : ""}`}
              onClick={() => setActive(index)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <span className={styles.tabCopy}><span className={styles.tabTitle}>{stage.label}</span><span className={styles.subtitle}>{stage.subtitle}</span></span>
              <span className={styles.tabArrow}><Arrow /></span>
            </button>
          ))}
        </div>
        <p className={styles.returnNote}><span aria-hidden="true">↳</span> Failures return to the next evaluation.</p>
      </div>

      <div className={styles.journal}>
        {STAGES.map((stage, index) => (
          <div
            key={stage.label}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            tabIndex={0}
            hidden={active !== index}
            className={styles.panel}
          >
            <div className={styles.journalMeta}><span>Inside the training loop</span><span>0{index + 1} / 06</span></div>
            <h3 className={styles.title}>{stage.title}</h3>
            <p className={styles.body}>{stage.body}</p>

            <div className={styles.board}>
              <p className={styles.boardLabel}>Illustrative workflow</p>
              <div className={styles.flowRow}>
                <span className={styles.flowLabel}>Input</span>
                <span className={styles.flowValue}>{stage.input}</span>
              </div>
              <div className={styles.artifact}>
                <span className={styles.flowLabel}>Working record</span>
                <ul>{stage.artifact.split("\n").map((line) => <li key={line}><span aria-hidden="true">—</span>{line}</li>)}</ul>
              </div>
              <div className={styles.flowRow}>
                <span className={styles.flowLabel}>Output</span>
                <span className={styles.output}><Arrow />{stage.output}</span>
              </div>
            </div>

            <div className={styles.quality}><p>Before moving on</p><span>{stage.check}</span></div>
            <p className={styles.deliverable}><span>You leave with</span>{stage.deliverable}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

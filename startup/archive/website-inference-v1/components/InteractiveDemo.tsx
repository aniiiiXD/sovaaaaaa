"use client";

import { useState } from "react";
import SovaLogo from "@/components/SovaLogo";
import styles from "./InteractiveDemo.module.css";

type Metric = "Cash flow" | "Runway" | "Spend";
type Horizon = "30 days" | "90 days";

const snapshots: Record<Metric, Record<Horizon, { value: string; change: string; label: string; values: number[] }>> = {
  "Cash flow": {
    "30 days": { value: "$248k", change: "+8.4%", label: "Projected net cash", values: [28, 35, 31, 45, 40, 55, 48, 62, 57, 73, 67, 81] },
    "90 days": { value: "$712k", change: "+5.2%", label: "Projected net cash", values: [25, 31, 29, 42, 39, 50, 46, 58, 54, 68, 65, 77] },
  },
  Runway: {
    "30 days": { value: "14.2 mo", change: "+1.1 mo", label: "Estimated runway", values: [77, 73, 74, 66, 68, 61, 64, 54, 57, 49, 51, 44] },
    "90 days": { value: "13.6 mo", change: "+0.6 mo", label: "Estimated runway", values: [78, 73, 74, 66, 67, 60, 61, 53, 54, 47, 49, 42] },
  },
  Spend: {
    "30 days": { value: "$82.6k", change: "−3.1%", label: "Monthly operating spend", values: [69, 62, 65, 56, 59, 51, 53, 47, 49, 42, 45, 38] },
    "90 days": { value: "$79.1k", change: "−4.8%", label: "Monthly operating spend", values: [72, 65, 67, 59, 61, 54, 55, 49, 50, 44, 46, 39] },
  },
};

const insights: Record<Metric, { title: string; detail: string }> = {
  "Cash flow": { title: "Collections could arrive ahead of plan", detail: "Example scenario based on hypothetical invoice timing." },
  Runway: { title: "Runway may hold above 13 months", detail: "Example scenario based on a hypothetical hiring plan." },
  Spend: { title: "Cloud costs could ease next month", detail: "Example scenario based on hypothetical service usage." },
};

export default function InteractiveDemo() {
  const [metric, setMetric] = useState<Metric>("Cash flow");
  const [horizon, setHorizon] = useState<Horizon>("30 days");
  const [insightOpen, setInsightOpen] = useState(false);
  const snapshot = snapshots[metric][horizon];

  return (
    <section className={styles.demo} aria-label="Interactive Sova product preview">
      <div className={styles.card}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <SovaLogo wordmarkClassName={styles.wordmark} oClassName={styles.wordO} />
          </div>
          <div className={styles.demoTag}><span /> Demo workspace</div>
          <button className={styles.more} aria-label="More dashboard options" type="button">···</button>
        </header>

        <div className={styles.content}>
          <div className={styles.headingRow}>
            <div>
              <p className={styles.eyebrow}>SAMPLE WORKSPACE · TUESDAY, OCTOBER 20, 2026</p>
              <h2>Good morning, Alex<span>.</span></h2>
              <p className={styles.subhead}>Here’s the shape of your business.</p>
            </div>
            <div className={styles.horizon} role="group" aria-label="Forecast period">
              {(["30 days", "90 days"] as Horizon[]).map((item) => (
                <button key={item} type="button" aria-pressed={horizon === item} onClick={() => setHorizon(item)}>{item}</button>
              ))}
            </div>
          </div>

          <div className={styles.metricTabs} role="tablist" aria-label="Financial metric">
            {(["Cash flow", "Runway", "Spend"] as Metric[]).map((item) => (
              <button key={item} role="tab" aria-selected={metric === item} className={metric === item ? styles.activeTab : ""} type="button" onClick={() => setMetric(item)}>{item}</button>
            ))}
          </div>

          <div className={styles.chartPanel}>
            <div className={styles.chartMeta}>
              <div><p>{snapshot.label}</p><strong>{snapshot.value}</strong></div>
              <span className={styles.change}>{snapshot.change} <span>vs. last period</span></span>
            </div>
            <div className={styles.chart} aria-label={`${metric} forecast trend for ${horizon}`} role="img">
              <div className={styles.gridline} /><div className={styles.gridline} /><div className={styles.gridline} />
              <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden="true">
                <defs><linearGradient id="sova-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
                <polygon points={`0,150 ${snapshot.values.map((v, i) => `${i * (600 / (snapshot.values.length - 1))},${150 - v * 1.55}`).join(" ")} 600,150`} fill="url(#sova-chart-fill)" />
                <polyline points={snapshot.values.map((v, i) => `${i * (600 / (snapshot.values.length - 1))},${150 - v * 1.55}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="600" cy={150 - snapshot.values.at(-1)! * 1.55} r="5" fill="var(--paper-bright)" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className={styles.axis}>{(horizon === "30 days" ? ["DAY 01", "DAY 10", "DAY 20", "DAY 30"] : ["DAY 01", "DAY 30", "DAY 60", "DAY 90"]).map((label) => <span key={label}>{label}</span>)}</div>
            </div>
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.insight}>
              <div className={styles.spark} aria-hidden="true">✳</div>
              <div><p className={styles.insightLabel}>HYPOTHETICAL EXAMPLE</p><strong>{insights[metric].title}</strong><p>{insights[metric].detail}</p></div>
              <button type="button" aria-label={insightOpen ? "Hide insight details" : "View insight details"} aria-expanded={insightOpen} onClick={() => setInsightOpen((open) => !open)}>{insightOpen ? "−" : "↗"}</button>
            </div>
            <div className={styles.sync}><span className={styles.syncDot} /> Illustrative workspace</div>
          </div>
          {insightOpen && <p className={styles.insightDetail}>This is a sample insight generated from the illustrative workspace data shown above.</p>}
          <p className={styles.disclaimer}>Illustrative demo data · Not a financial forecast</p>
        </div>
      </div>
    </section>
  );
}

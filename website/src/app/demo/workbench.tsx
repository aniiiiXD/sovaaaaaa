"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { demoCases, demoInstruction, metricDefinitions, type Brief, type DemoResult } from "@/lib/demo";
import { BOOKING_URL } from "@/lib/site";
import recordingsData from "@/lib/demo-recordings.json";
import s from "./workbench.module.css";

const recordings = recordingsData as Record<string, { document: string; instruction: string; result: DemoResult }>;
function recordedResult(caseId: string) {
  const recording = recordings[caseId];
  const sample = demoCases.find(item => item.id === caseId);
  return recording && recording.document === sample?.document && recording.instruction === demoInstruction ? recording.result : undefined;
}

function Glyph({ name, size = 20 }: { name: "play" | "document" | "download" | "check" | "spark"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "play" ? <path d="m9 5 11 7-11 7V5Z" /> : name === "document" ? <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v6h5M8 13h8M8 17h5" /></> : name === "download" ? <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></> : name === "check" ? <path d="m5 12 4 4L19 6" /> : <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>}
  </svg>;
}

function MetricGrid({ brief }: { brief: Brief }) {
  return <div className={s.metricGrid}>{metricDefinitions.map(metric => <div key={metric.key}>
    <span>{metric.label}</span><strong>{brief[metric.key] === null ? "Not provided" : `${brief[metric.key]! < 0 ? "−" : ""}${metric.unit === "$m" ? "$" : ""}${Math.abs(brief[metric.key]!).toLocaleString("en-US", { maximumFractionDigits: 2 })}${metric.unit === "$m" ? "m" : "%"}`}</strong>
  </div>)}</div>;
}

function ResultPanel({ result, loading, error, elapsed, baseline = false, recorded = false }: { result?: DemoResult; loading: boolean; error?: string; elapsed: number; baseline?: boolean; recorded?: boolean }) {
  const passed = result?.checks.filter(check => check.passed).length ?? 0;
  return <section className={`${s.resultPanel} ${baseline ? s.baselinePanel : ""}`} aria-label={baseline ? "Frontier result" : "Specialist result"}>
    <div className={s.panelHeading}><div className={s.modelIdentity}><span className={s.modelMark}>{baseline ? "G" : "S"}</span><div><h2>{baseline ? "Frontier baseline" : "Finance specialist"}</h2><p>{result?.model ?? (baseline ? "Bedrock baseline" : "Fin-o1-14B · Qwen3-based")}</p></div></div><span className={`${s.status} ${loading ? s.running : ""}`}>{loading ? "Running" : result ? recorded ? "Recorded run" : "Live result" : "Ready to run"}</span></div>
    {loading && <div className={s.runningLine} />}
    <div className={s.resultBody} aria-live="polite" aria-busy={loading}>
      {error ? <div className={s.error} role="alert"><strong>This run needs another try</strong><p>{error}</p></div> : result ? <>
        {!result.complete && <p className={s.error}>The response ended before normal completion ({result.finishReason}). Treat this output as incomplete.</p>}
        {result.brief ? <><MetricGrid brief={result.brief} /><div className={s.summary}><h3>Analyst brief</h3><p>{result.brief.summary}</p><div className={s.citations}>{result.brief.citations.map((id, i) => <span key={`${id}-${i}`}>[{id}]</span>)}</div></div></> : <div className={s.unstructured}><p>The model did not return the requested structured brief. Review its response below.</p><pre>{result.text}</pre></div>}
        <div className={s.checkHeading}><h3>Review the evidence</h3><span>{result.checks.length ? `${passed}/${result.checks.length} numerical checks` : "Human review required"}</span></div>
        {result.checks.length ? <div className={s.checks}>{result.checks.map(check => <div key={check.key}><span className={check.passed ? s.pass : s.fail}>{check.passed ? <Glyph name="check" size={14} /> : "!"}</span><span>{check.label}</span><span>{check.passed ? "Matches reference" : `Expected ${check.expected}; got ${check.actual ?? "no value"}`}</span></div>)}</div> : <p className={s.small}>Your document has no verified reference answer. Review the calculations and summary before relying on the result.</p>}
        <p className={s.checkNote}>{result.citationIdsValid ? "Referenced section IDs exist in the excerpt." : "Source references need review."} These checks do not validate every claim in the summary.</p>
        <details className={s.raw}><summary>Full model response</summary><pre>{result.text}</pre></details>
      </> : <div className={s.empty}>
        <div className={s.emptyDiagram}><div><Glyph name="document" size={30} /></div><span /><div><Glyph name="spark" size={28} /></div><span /><div><Glyph name="check" size={28} /></div></div>
        <h3>{loading ? "Reading, calculating, checking." : "Put the model to work."}</h3>
        <p>{loading ? "The complete answer will appear here with its token count and measured response time." : "Run the excerpt to see a concise financial brief and how its numbers compare with the reference."}</p>
        {loading ? <strong className={s.elapsed}>{elapsed.toFixed(1)}s elapsed</strong> : <div className={s.emptyFoot}><span>4 financial metrics</span><span>Source references</span><span>Verifiable calculations</span></div>}
      </div>}
    </div>
    <div className={s.telemetry}>
      <div><span>Full response</span><strong>{result ? `${(result.durationMs / 1000).toFixed(2)}s` : loading ? `${elapsed.toFixed(1)}s` : "—"}</strong></div>
      <div><span>Output tokens</span><strong>{result?.outputTokens?.toLocaleString() ?? "—"}</strong></div>
      <div><span>Effective output / sec</span><strong>{result?.outputTokens != null && result.durationMs > 0 ? (result.outputTokens / (result.durationMs / 1000)).toFixed(1) : "—"}</strong></div>
    </div>
    {recorded && result && <p className={s.recordingNote}>Actual model output recorded on {result.createdAt.slice(0, 10)}. Run the brief to measure a fresh response.</p>}
    <p className={s.billing}>{result?.billing ?? (baseline ? "Dollar cost will appear only when verified pricing is configured." : "$0.57 per active 5-minute window, per model copy. Capacity billing; not a per-answer price.")}</p>
  </section>;
}

export default function DemoWorkbench({ baselineConnected, liveEnabled }: { baselineConnected: boolean; liveEnabled: boolean }) {
  const [caseId, setCaseId] = useState("aster");
  const [custom, setCustom] = useState("");
  const [code, setCode] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const [results, setResults] = useState<Partial<Record<"specialist" | "baseline", DemoResult>>>(() => ({ specialist: recordedResult("aster") }));
  const [recorded, setRecorded] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<"specialist" | "baseline", string>>>({});
  const [busy, setBusy] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [warmAt, setWarmAt] = useState<string>();
  const [warmMessage, setWarmMessage] = useState("");
  const [runWarmAt, setRunWarmAt] = useState<string>();
  const [referenceOpen, setReferenceOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [pendingRun, setPendingRun] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = demoCases.find(item => item.id === caseId);
  const document = selected?.document ?? custom;
  const running = busy.length > 0;

  useEffect(() => {
    const runGeneration = generation;
    return () => { runGeneration.current++; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - start) / 1000), 100);
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => { if (accessOpen) inputRef.current?.focus(); }, [accessOpen]);

  function selectCase(value: string) { setPendingRun(null); setCaseId(value); const result = recordedResult(value); setResults(result ? { specialist: result } : {}); setRecorded(Boolean(result)); setErrors({}); setReferenceOpen(false); setRunWarmAt(undefined); }
  async function run(warmup = false) {
    if (!liveEnabled || running || controller.current) return;
    if (!code.trim()) { setPendingRun(warmup); setAccessOpen(true); return; }
    if (!warmup && (document.trim().length < 40 || new TextEncoder().encode(document.trim()).length > 10000)) return;
    setAccessOpen(false); setPendingRun(null);
    setElapsed(0); setErrors({}); setWarmMessage("");
    if (!warmup) { setResults({}); setRecorded(false); setRunWarmAt(warmAt); }
    const kinds: ("specialist" | "baseline")[] = compare && baselineConnected && !warmup ? ["specialist", "baseline"] : ["specialist"];
    setBusy(warmup ? ["warmup"] : kinds);
    const abort = new AbortController(); controller.current = abort;
    const id = ++generation.current;
    const timeout = window.setTimeout(() => abort.abort(), 245000);
    await Promise.all(kinds.map(async kind => {
      try {
        const response = await fetch("/api/demo/run", { method: "POST", signal: abort.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${code.trim()}` },
          body: JSON.stringify({ kind, caseId, document: selected ? undefined : custom, warmup }),
        });
        const data = await response.json().catch(() => null);
        if (generation.current !== id) return;
        abort.signal.throwIfAborted();
        if (response.status === 401) { setAccessOpen(true); setPendingRun(warmup); }
        if (!response.ok || !data) throw new Error(typeof data?.error === "string" ? data.error : "The server could not complete this request. Try again.");
        if (warmup) { setWarmAt(data.createdAt); setWarmMessage("Model responded. Run your brief now; idle models can sleep after five minutes."); }
        else setResults(previous => ({ ...previous, [kind]: data }));
      } catch (error) {
        if (generation.current !== id) return;
        const message = abort.signal.aborted ? "The request timed out. Try again; any inference already performed may still be billed." : error instanceof Error ? error.message : "Could not reach the model.";
        if (warmup) setWarmMessage(message);
        else setErrors(previous => ({ ...previous, [kind]: message }));
      } finally { if (generation.current === id) setBusy(previous => previous.filter(item => item !== (warmup ? "warmup" : kind))); }
    }));
    window.clearTimeout(timeout);
    if (generation.current === id) controller.current = null;
  }
  function stop() {
    generation.current++; controller.current?.abort(); controller.current = null;
    const message = "Run stopped. Any inference already performed may still be billed.";
    if (busy.includes("warmup")) setWarmMessage(message);
    else setErrors(previous => ({ ...previous, ...Object.fromEntries(busy.map(kind => [kind, message])) }));
    setBusy([]);
  }
  function download() {
    const payload = { workflow: "Financial brief", source: selected ? { company: selected.company, synthetic: true } : { company: "Custom document", synthetic: false },
      document, instruction: demoInstruction, maxOutputTokens: 2048, specialistWarmupAt: runWarmAt ?? null,
      results, errors, mode: recorded ? "recorded" : "live", notes: ["Single demonstration, not a benchmark. Numerical checks do not validate every summary claim.", "Server duration includes provider and network time; no first-token measurement.", "No customer-specific post-training has been performed for this demo.", "Cost savings are not calculated from capacity billing."] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `sova-${caseId}-run.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className={s.shell}>
    <header className={s.header}><Link href="/" className={s.logo}>Sova<span>Studio</span></Link><div className={s.headerRight}><span className={s.previewBadge}>Finance workflow demo</span><button className={s.accessButton} onClick={() => { setPendingRun(null); setAccessOpen(value => !value); }} aria-expanded={accessOpen}>Presenter access</button></div></header>
    {accessOpen && <section className={s.accessPanel} aria-label="Presenter access"><div><h2>Run the live models</h2><p>Use your demo access code. It stays in this tab’s memory.</p></div><form onSubmit={event => { event.preventDefault(); if (!code.trim()) return; if (pendingRun !== null) void run(pendingRun); else setAccessOpen(false); }}><label className={s.srOnly} htmlFor="access-code">Presenter access code</label><input id="access-code" ref={inputRef} type="password" value={code} onChange={event => setCode(event.target.value)} placeholder="Demo access code" autoComplete="off" required /><button type="submit" disabled={!code.trim() || running}>{pendingRun === null ? "Use code" : pendingRun ? "Prepare model" : "Run financial brief"}</button>{code && <button type="button" onClick={() => setCode("")}>Clear</button>}</form></section>}
    <div className={s.intro}><div><p className={s.introLabel}><span /> A workflow you can inspect</p><h1>Give your financial report<br className={s.desktopBreak} /> a specialist’s attention.</h1><p className={s.lead}>From source figures to a concise brief. Run the model, check the numbers, and see what a pilot on your data could look like.</p></div><div className={s.introNote}><Glyph name="document" size={24} /><p>One excerpt.<br />Four calculations.<br /><strong>Every result open to review.</strong></p></div></div>
    <section className={s.workspace} aria-label="Finance workflow workbench">
      <div className={s.toolbar}><div className={s.caseTabs} role="group" aria-label="Choose a financial excerpt">{demoCases.map(item => <button key={item.id} className={caseId === item.id ? s.selectedTab : ""} aria-pressed={caseId === item.id} disabled={running} onClick={() => selectCase(item.id)}>{item.company}</button>)}<button className={caseId === "custom" ? s.selectedTab : ""} aria-pressed={caseId === "custom"} disabled={running} onClick={() => selectCase("custom")}>Your excerpt</button></div><button className={s.exportButton} disabled={running || !Object.values(results).some(Boolean)} onClick={download}><Glyph name="download" size={16} /> Export run</button></div>
      <div className={s.workGrid}>
        <section className={s.sourcePanel} aria-label="Source excerpt"><div className={s.sourceHeading}><Glyph name="document" /><span>{selected ? "Example report" : "Your financial excerpt"}</span><span className={s.pageCount}>1 page</span></div>
          <div className={s.paper}>{selected ? <><div className={s.paperMasthead}><span>{selected.company}</span><small>FY2025</small></div><h2>{selected.title}</h2><p className={s.paperCaption}>Illustrative financial report · Fictional data</p><div className={s.documentText}>{selected.document.split("\n\n").slice(1).map((section, index) => <div key={index}><h3>{section.split("\n")[0]}</h3>{section.split("\n").slice(1).map((line, lineIndex) => <p key={lineIndex}>{line}</p>)}</div>)}</div><div className={s.paperFoot}>All amounts in USD millions</div></> : <><h2>Bring a prospect’s workflow.</h2><p className={s.paperCaption}>Paste a text excerpt with revenue, operating income, cash flow, debt and cash. Add [S1], [S2] labels for source references.</p><label className={s.srOnly} htmlFor="document">Financial excerpt</label><textarea id="document" value={custom} disabled={running} onChange={event => { setPendingRun(null); setCustom(event.target.value); setResults({}); setRecorded(false); setRunWarmAt(undefined); setErrors({}); }} maxLength={10000} placeholder="[S1] Income statement…" /><small>{new TextEncoder().encode(custom).length.toLocaleString()} / 10,000 bytes</small><p className={s.paperCaption}>Live runs send this excerpt to AWS Bedrock. This demo does not save your document to an application database.</p></>}</div>
          <div className={s.task}><h3>The assignment</h3><p>Calculate revenue growth, operating margin, free cash flow and net debt. Write a short brief with source references and one supported risk or limitation.</p></div>
        </section>
        <div className={s.outputColumn}><ResultPanel result={results.specialist} recorded={recorded} loading={busy.includes("specialist")} error={errors.specialist} elapsed={elapsed} />
          {compare && <ResultPanel baseline result={results.baseline} loading={busy.includes("baseline")} error={errors.baseline} elapsed={elapsed} />}
          {selected && <section className={s.reference}><button className={s.referenceToggle} onClick={() => setReferenceOpen(value => !value)} aria-expanded={referenceOpen}><span><Glyph name="check" size={17} /> Reference brief <small>Prepared reference</small></span><span>{referenceOpen ? "Hide" : "Inspect"}</span></button>{referenceOpen && <div className={s.referenceBody}><MetricGrid brief={selected.expected} /><p>{selected.expected.summary}</p><p className={s.small}>Used to check the four numerical fields. This reference answer is not sent to the model.</p></div>}</section>}
        </div>
      </div>
      <div className={s.runBar}><div className={s.runOptions}><label><input type="checkbox" checked={compare} onChange={event => { setCompare(event.target.checked); setResults(previous => previous.specialist ? { specialist: previous.specialist } : {}); setErrors(previous => previous.specialist ? { specialist: previous.specialist } : {}); }} disabled={!baselineConnected || running} /> Compare with frontier</label><p>{baselineConnected ? "Both models receive the same source and task." : "Baseline connection pending. Reference checks are available now."}</p></div><div className={s.runActions}><button className={s.prepareButton} disabled={running || !liveEnabled} onClick={() => run(true)}>{busy.includes("warmup") ? `Preparing · ${elapsed.toFixed(0)}s` : "Prepare model"}</button>{running ? <button className={s.runButton} onClick={stop}>Stop run</button> : <button className={s.runButton} disabled={!liveEnabled || (!selected && (custom.trim().length < 40 || new TextEncoder().encode(custom).length > 10000))} onClick={() => run()}><Glyph name="play" size={17} /> Run financial brief</button>}</div></div>
      {(warmMessage || !liveEnabled) && <p className={s.runMessage} role="status">{!liveEnabled ? "Live access is being configured. You can inspect the example reports and reference briefs." : warmMessage}</p>}
    </section>
    <div className={s.method}><p><strong>What this demonstrates</strong> A finance-tuned model on a specific workflow. These are single-run measurements, not a benchmark or a claim of customer-specific training.</p><p><strong>How to read the timings</strong> Full server response time includes model and network time. Reasoning tokens count toward output. Prepare the model before a warm run; cold starts can take minutes.</p></div>
    <section className={s.pilot}><div><span className={s.pilotLabel}>Your data is the next step.</span><h2>Make this your workflow.</h2><p>Bring a repetitive task, examples of good answers, and your current cost. We’ll scope a pilot with an agreed quality threshold and measurable latency and cost targets.</p></div><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Discuss a pilot <span aria-hidden="true">↗</span></a></section>
    <footer className={s.footer}><Link href="/">Sova</Link><span>Specialized models. Measurable work.</span><a href="https://huggingface.co/TheFinAI/Fin-o1-14B" target="_blank" rel="noopener noreferrer">About the demo model</a></footer>
  </main>;
}

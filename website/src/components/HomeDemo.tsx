"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { demoCases, demoInstruction, type DemoResult } from "@/lib/demo";
import recordings from "@/lib/demo-recordings.json";
import { BOOKING_URL } from "@/lib/site";
import s from "./HomeDemo.module.css";

const QUESTION = "What do Aster’s FY2025 results tell us about growth, profitability, cash flow and risk?";
const saved = recordings.aster;
const recording = saved.document === demoCases[0].document && saved.instruction === demoInstruction ? saved.result as DemoResult : null;
type Kind = "specialist" | "baseline";
type Outputs = Partial<Record<Kind, DemoResult>>;

export function DemoScrollCue() {
  return <a href="#live-demo" className={s.scrollCue} onClick={event => {
    const target = document.getElementById("live-demo");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    window.history.pushState(null, "", "#live-demo");
  }}>
    <span className={s.scrollTrack} aria-hidden="true"><span /></span><span>See it in action</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 4v16m-5-5 5 5 5-5" /></svg>
  </a>;
}

function Answer({ text, skip }: { text: string; skip: boolean }) {
  const words = text.split(" ");
  const [count, setCount] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const next = media.matches || skip ? words.length : Math.min(words.length, Math.ceil((now - start) / 42));
      setCount(next);
      if (next < words.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, words.length, skip]);
  return <><p className={s.answer} aria-hidden="true">{words.map((word, i) => <span key={i} className={i < count ? s.word : s.hiddenWord}>{word}{i === words.length - 1 ? "" : " "}</span>)}</p><p className={s.srOnly}>{text}</p></>;
}

export default function HomeDemo({ liveEnabled, baselineConnected, baselineLabel }: { liveEnabled: boolean; baselineConnected: boolean; baselineLabel: string }) {
  const [question, setQuestion] = useState(QUESTION);
  const [submitted, setSubmitted] = useState(QUESTION);
  const [results, setResults] = useState<Outputs>({});
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const [busy, setBusy] = useState<Kind[]>([]);
  const [recorded, setRecorded] = useState(true);
  const [revision, setRevision] = useState(0);
  const [skip, setSkip] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [code, setCode] = useState("");
  const section = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const played = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const running = busy.length > 0;
  const dirty = question.trim() !== submitted;
  const shown = dirty ? {} : results;
  const baselineName = shown.baseline?.model ?? "Comparison model";

  const replay = useCallback(() => {
    played.current = true;
    setRecorded(true); setSkip(false); setSubmitted(QUESTION); setQuestion(QUESTION);
    setResults(recording ? { specialist: recording } : {}); setErrors({}); setRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (!played.current && entries.some(entry => entry.isIntersecting)) replay();
    }, { threshold: 0 });
    if (section.current) observer.observe(section.current);
    const runGeneration = generation;
    return () => { observer.disconnect(); runGeneration.current++; controller.current?.abort(); };
  }, [replay]);

  useEffect(() => {
    if (accessOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [accessOpen]);

  async function runLive() {
    if (running || controller.current || !liveEnabled) return;
    if (!code.trim()) { setAccessOpen(true); return; }
    setAccessOpen(false); played.current = true;
    const prompt = question.trim();
    if (!prompt) return;
    const id = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    const kinds: Kind[] = baselineConnected ? ["specialist", "baseline"] : ["specialist"];
    setRecorded(false); setSkip(false); setSubmitted(prompt); setResults({}); setErrors({}); setBusy(kinds); setRevision(value => value + 1);
    const timeout = window.setTimeout(() => abort.abort(), 245000);
    await Promise.all(kinds.map(async kind => {
      try {
        const response = await fetch("/api/demo/run", {
          method: "POST", signal: abort.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${code.trim()}` },
          body: JSON.stringify({ kind, caseId: "aster", question: prompt }),
        });
        const data = await response.json().catch(() => null);
        if (generation.current !== id) return;
        abort.signal.throwIfAborted();
        if (response.status === 401) setAccessOpen(true);
        if (!response.ok || !data) throw new Error(typeof data?.error === "string" ? data.error : "This model could not respond. Try again.");
        if (generation.current === id && !abort.signal.aborted) setResults(previous => ({ ...previous, [kind]: data as DemoResult }));
      } catch (error) {
        if (generation.current === id) setErrors(previous => ({ ...previous, [kind]: abort.signal.aborted ? "The request timed out. Try again." : error instanceof Error ? error.message : "This model could not respond." }));
      } finally {
        if (generation.current === id) setBusy(previous => previous.filter(item => item !== kind));
      }
    }));
    window.clearTimeout(timeout);
    if (generation.current === id) controller.current = null;
  }

  function stop() {
    generation.current++; controller.current?.abort(); controller.current = null;
    setErrors(previous => ({ ...previous, ...Object.fromEntries(busy.map(kind => [kind, "Request stopped. Run again when you’re ready."])) })); setBusy([]);
  }

  function run() {
    played.current = true;
    if (running) { stop(); return; }
    if (question.trim() === QUESTION && !code.trim()) replay();
    else if (code.trim() && liveEnabled) void runLive();
    else setAccessOpen(true);
  }

  function value(kind: Kind, metric: "speed" | "time" | "accuracy") {
    const result = shown[kind];
    if (!result) return <span className={s.unmeasured}>—</span>;
    if (metric === "speed") return <><strong>{result.outputTokens !== null && result.durationMs > 0 ? (result.outputTokens / (result.durationMs / 1000)).toFixed(1) : "—"} <small>tok/s</small></strong><span>Effective output rate</span></>;
    if (metric === "time") return <><strong>{(result.durationMs / 1000).toFixed(1)} <small>seconds</small></strong><span>{recorded ? "Recorded response" : "Server response"}</span></>;
    return <><strong>{result.checks.length ? `${result.checks.filter(check => check.passed).length}/${result.checks.length}` : "—"}</strong><span>{result.checks.length ? "Calculation checks passed" : "Not evaluated"}</span></>;
  }

  return <section ref={section} id="live-demo" aria-labelledby="live-demo-title" className={s.section}>
    <div className="container-x">
      <div className={s.heading}><h2 id="live-demo-title" className={`display ${s.title}`}>See the work, up close.</h2><p>A financial question. The source. An answer you can inspect.</p></div>
      <div className={s.demo}>
        <form className={s.prompt} onSubmit={event => { event.preventDefault(); run(); }}>
          <label htmlFor="comparison-question" className={s.srOnly}>Ask both models about Aster’s financial results</label>
          <textarea id="comparison-question" rows={2} maxLength={1000} required value={question} disabled={running} onChange={event => { played.current = true; setQuestion(event.target.value); }} placeholder="Ask a question about Aster’s financial results…" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (question.trim()) run(); } }} />
          <button type="submit" className="btn btn-primary" disabled={!question.trim()}>{running ? "Stop" : question.trim() === QUESTION && !code.trim() ? "Replay" : "Run"}<span aria-hidden="true">{running ? "□" : "↑"}</span></button>
        </form>
        <div className={s.context}><details><summary>Aster FY2025 · sample financials</summary><p>{saved.document}</p></details><span>{dirty ? "New question" : recorded ? "Recorded example" : "Live request"}</span></div>
        <div className={s.panels}>
          {(["specialist", "baseline"] as const).map(kind => {
            const result = shown[kind];
            const loading = busy.includes(kind);
            const error = dirty ? undefined : errors[kind];
            return <section key={kind} aria-label={kind === "specialist" ? "Clove answer" : `${baselineLabel} answer`} className={s.panel}>
              <header className={s.panelHeader}><span className={kind === "specialist" ? s.sovaMark : s.gptMark} aria-hidden="true">{kind === "specialist" ? "C" : "↔"}</span><div><h3>{kind === "specialist" ? "Clove" : baselineLabel}</h3><p>{kind === "specialist" ? "Fin-o1 · Qwen-based finance model" : baselineName}</p></div><span className={s.panelStatus}>{loading ? "Answering" : result ? recorded ? "Recorded" : "Complete" : ""}</span></header>
              <div className={s.answerBody} aria-busy={loading}>
                {error ? <p className={s.error} role="alert">{error}</p> : result ? <>
                  <Answer key={`${kind}-${revision}`} text={result.brief?.summary ?? "The model did not return a structured brief. Open the response below to inspect it."} skip={skip} />
                  <details><summary>Full model response</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{result.text}</pre></details>
                  {!result.complete && <p className={s.error}>Response incomplete. These results need review.</p>}
                </> : <div className={s.empty}><span className={s.emptyIcon} aria-hidden="true">{loading ? "···" : kind === "specialist" ? "↳" : "↔"}</span><p>{loading ? "Reading the same question and source…" : dirty ? "Run your question to see the answer." : kind === "baseline" ? baselineConnected ? `Run live to see ${baselineLabel}’s answer.` : "The comparison model is not connected yet." : "Ask once. See both answers here."}</p>{!loading && !dirty && kind === "baseline" && <span>{baselineConnected ? "The same question and source go to both models." : "Its answer and measurements will appear here when connected."}</span>}</div>}
              </div>
            </section>;
          })}
        </div>
        <div className={s.playback}><span>Answer animation is a visual replay.</span>{Object.keys(shown).length > 0 && <button type="button" onClick={() => setSkip(true)}>Show full answers</button>}</div>
        <table className={s.comparison}>
          <caption className={s.srOnly}>Speed, response time and calculation accuracy comparison</caption>
          <thead><tr><th scope="col">Results</th><th scope="col">Clove</th><th scope="col">{baselineLabel}</th></tr></thead>
          <tbody><tr><th scope="row">Speed</th><td>{value("specialist", "speed")}</td><td>{value("baseline", "speed")}</td></tr><tr><th scope="row">Time to answer</th><td>{value("specialist", "time")}</td><td>{value("baseline", "time")}</td></tr><tr><th scope="row">Accuracy on task</th><td>{value("specialist", "accuracy")}</td><td>{value("baseline", "accuracy")}</td></tr></tbody>
        </table>
        <div className={s.footnotes}><details><summary>How we measure</summary><p>Checks cover four calculations in this fictional source, not overall accuracy. Effective speed is output tokens divided by full response time, including reasoning and waiting. The recorded Clove run took 11.083 seconds for 659 output tokens. There is no recorded frontier baseline yet. No comparative advantage has been established. Answer animations do not represent original token arrival times.</p></details><button type="button" onClick={() => setAccessOpen(true)}>Run live models ↗</button></div>
      </div>
      <div className={s.cta}><a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Talk to us <span aria-hidden="true">↗</span></a></div>
    </div>
    <dialog ref={dialog} className={s.dialog} aria-labelledby="comparison-access-title" onCancel={() => setAccessOpen(false)} onClose={() => setAccessOpen(false)}>
      <button type="button" className={s.close} aria-label="Close live access" onClick={() => setAccessOpen(false)}>×</button>
      <h3 id="comparison-access-title">Run your question live.</h3>
      {liveEnabled ? <><p>Use your presenter code to send this question to the connected models.</p><form onSubmit={event => { event.preventDefault(); void runLive(); }}><label htmlFor="comparison-code">Presenter access code</label><input id="comparison-code" type="password" autoComplete="off" required value={code} onChange={event => setCode(event.target.value)} /><button type="submit" className="btn btn-primary">Run question</button></form></> : <><p>Live inference is not configured for this deployment. You can still inspect saved model outputs and reference calculations in the demo.</p><a className="btn btn-primary" href="/demo">Inspect demo ↗</a></>}
    </dialog>
  </section>;
}

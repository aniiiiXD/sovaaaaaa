"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { PRODUCT_ORIGIN } from "@/lib/site";
import s from "./TaskApis.module.css";

const TASKS = [
  {
    label: "Financial analysis",
    model: "sova-finance",
    title: "Turn a financial question into an answer.",
    description: "Send the figures and the question together. Get an explanation you can put back into your workflow.",
    input: "Revenue increased from INR 80 lakh to INR 1 crore. What was the growth rate?",
    response: "Revenue grew by 25%. The increase was INR 20 lakh; 20 ÷ 80 × 100 = 25%.",
  },
  {
    label: "Engineering",
    model: "sova-code",
    title: "Give your engineering workflow a second pair of eyes.",
    description: "Bring a concrete implementation question. Get a focused response about the code and the edge cases that matter.",
    input: "How should a payment webhook handle retries safely, including duplicate events and signature verification?",
    response: "Verify the signature before processing. Persist the event ID with a unique constraint, acknowledge duplicates, and commit the event record with the state change. Retry transient failures with bounded exponential backoff.",
  },
  {
    label: "Reasoning",
    model: "sova-reason",
    title: "Work through the numbers, not just the wording.",
    description: "Ask a maths or logic question. Get the key steps and a clearly stated answer for the next part of your workflow.",
    input: "A portfolio gains 8%, then loses 8%. What is the net return?",
    response: "Starting from 100: 100 × 1.08 × 0.92 = 99.36. Answer: the net return is −0.64%.",
  },
] as const;

type Task = (typeof TASKS)[number];
type CopyStatus = "idle" | "copied" | "error";

function requestFor(task: Task) {
  const body = JSON.stringify({
    model: task.model,
    messages: [{ role: "user", content: task.input }],
    max_tokens: 256,
  }, null, 2);

  return String.raw`curl ${PRODUCT_ORIGIN}/api/v1/chat/completions \
  -H "Authorization: Bearer $SOVA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '${body.replace(/'/g, "'\\''")}'`;
}

function Arrow() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>;
}

export default function TaskApis() {
  const id = useId();
  const [active, setActive] = useState(0);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const revision = useRef(0);

  function select(index: number) {
    revision.current++;
    setActive(index);
    setCopyStatus("idle");
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TASKS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TASKS.length) % TASKS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TASKS.length - 1;
    else return;
    event.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  }

  async function copyRequest(task: Task) {
    const atRevision = revision.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(requestFor(task));
      if (revision.current === atRevision) setCopyStatus("copied");
    } catch {
      if (revision.current === atRevision) setCopyStatus("error");
    }
  }

  return (
    <div className={s.explorer}>
      <div role="tablist" aria-label="Explore Clove task APIs" className={s.tabs}>
        {TASKS.map((task, index) => <button
          key={task.model}
          type="button"
          role="tab"
          ref={element => { tabs.current[index] = element; }}
          id={`${id}-task-${index}`}
          aria-controls={`${id}-example-${index}`}
          aria-selected={active === index}
          tabIndex={active === index ? 0 : -1}
          className={`${s.tab} ${active === index ? s.selected : ""}`}
          onClick={() => select(index)}
          onKeyDown={event => navigate(event, index)}
        ><span className={s.tabDot} aria-hidden="true" />{task.label}<Arrow /></button>)}
      </div>

      {TASKS.map((task, index) => <div
        key={task.model}
        id={`${id}-example-${index}`}
        role="tabpanel"
        aria-labelledby={`${id}-task-${index}`}
        tabIndex={0}
        hidden={active !== index}
        className={s.panel}
      >
        <div className={s.intro}>
          <div><p className={s.model}>{task.model}</p><h3 className={s.title}>{task.title}</h3><p className={s.description}>{task.description}</p></div>
          <p className={s.preset}>Qwen3-4B · task preset</p>
        </div>

        <div className={s.example}>
          <div className={s.input}><p className={s.exampleLabel}>Your input</p><p className={s.exampleText}>{task.input}</p></div>
          <span className={s.flowArrow} aria-hidden="true"><Arrow /></span>
          <div className={s.output}><p className={s.exampleLabel}>Illustrative response</p><p className={s.exampleText}>{task.response}</p></div>
        </div>
        <p className={s.disclosure}>Illustrative responses. Live results depend on the model and your input.</p>

        <div className={s.request}>
          <div className={s.requestHeader}><p>Make the request</p><button type="button" className={s.copy} onClick={() => void copyRequest(task)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="1" /><path d="M16 8V3H3v13h5" /></svg>Copy request</button></div>
          <pre className={s.code} tabIndex={0} aria-label={`curl request for ${task.label}`}><code>{requestFor(task)}</code></pre>
          <p className={s.copyStatus} role="status" aria-live="polite">{copyStatus === "copied" ? "Request copied." : copyStatus === "error" ? "Copy is unavailable. Select the request above to copy it manually." : ""}</p>
        </div>

        <div className={s.links}><Link href={`${PRODUCT_ORIGIN}/docs/api-reference/chat-completions`}>Read the API reference <Arrow /></Link><Link href={`${PRODUCT_ORIGIN}/portal`}>Open the developer portal <Arrow /></Link></div>
      </div>)}
      <p className={s.catalogNote}>These task presets use a shared base model with server-side instructions. <Link href={`${PRODUCT_ORIGIN}/models`}>Explore the full model catalog.</Link></p>
    </div>
  );
}

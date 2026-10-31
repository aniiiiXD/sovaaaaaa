"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type TransitionEvent } from "react";
import styles from "./IndustryCarousel.module.css";

const industries = [
  {
    name: "Financial services",
    title: "Compliance answers, source attached.",
    description:
      "Agents that read your policies, check the evidence across systems, and answer regulated questions with the citation included.",
    tasks: ["Compliance Q&A + citations", "KYC document review", "Report summarization", "Dispute triage"],
    image: "/images/finance.jpg",
    alt: "Modern financial district buildings viewed from below",
  },
  {
    name: "Manufacturing",
    title: "Machine histories, answered in seconds.",
    description:
      "Agents that search equipment logs, maintenance procedures, and production data to answer the questions the floor asks every day.",
    tasks: ["Manuals & SOP Q&A", "Defect log triage", "RFQ drafting", "Maintenance summaries"],
    image: "/images/manufacturing.jpg",
    alt: "Engineer reviewing technical drawings at a workbench",
  },
  {
    name: "Supply chain & logistics",
    title: "Exceptions triaged before they escalate.",
    description:
      "Agents that catch delays, mismatched orders, and supplier questions early, and draft the next step for a human to approve.",
    tasks: ["Shipment exception triage", "Supplier follow-ups", "Customs doc checks", "Order mismatch alerts"],
    image: "/images/logistics.jpg",
    alt: "Aerial view of a shipping container terminal",
  },
  {
    name: "Healthcare & life sciences",
    title: "Dense documents, pre-read and summarized.",
    description:
      "Agents that work through clinical and research paperwork and draft the summary your specialists check and sign off.",
    tasks: ["Clinical doc pre-read", "Literature summaries", "Prior-auth paperwork", "Draft letters for review"],
    image: "/images/healthcare.jpg",
    alt: "Exterior of a healthcare facility",
  },
];

const industryCount = industries.length;
const middleCopyStart = industryCount;
const carouselItems = [...industries, ...industries, ...industries];

function wrapIndex(index: number) {
  return (index % industryCount + industryCount) % industryCount;
}

export default function IndustryCarousel() {
  const [position, setPosition] = useState(middleCopyStart);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [motionOverride, setMotionOverride] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const activeIndex = wrapIndex(position);
  const formattedIndex = String(activeIndex + 1).padStart(2, "0");

  function moveTo(index: number) {
    setPosition(middleCopyStart + wrapIndex(index));
  }

  function moveBy(amount: number) {
    setPosition((currentPosition) => currentPosition + amount);
  }

  function handleIndustryKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextIndex = activeIndex;
    if (event.key === "ArrowRight") nextIndex = wrapIndex(activeIndex + 1);
    else if (event.key === "ArrowLeft") nextIndex = wrapIndex(activeIndex - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = industryCount - 1;
    else return;

    event.preventDefault();
    moveTo(nextIndex);
    document.getElementById(`industry-jump-${nextIndex}`)?.focus();
  }

  function togglePlayback() {
    setIsPlaying((playing) => {
      const nextPlaying = !playing;
      if (nextPlaying) setMotionOverride(true);
      return nextPlaying;
    });
  }

  function handleTrackTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;

    if (position < middleCopyStart || position >= middleCopyStart + industryCount) {
      setIsSnapping(true);
      setPosition(position < middleCopyStart ? position + industryCount : position - industryCount);
      window.requestAnimationFrame(() => setIsSnapping(false));
    }
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const measureCardStep = () => {
      const card = track.querySelector<HTMLElement>("[data-industry-card]");
      if (!card) return;
      const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
      setStep(card.getBoundingClientRect().width + gap);
    };

    measureCardStep();
    const observer = new ResizeObserver(measureCardStep);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setPrefersReducedMotion(motionQuery.matches);
      if (motionQuery.matches) setIsPlaying(false);
    };

    updateMotionPreference();
    motionQuery.addEventListener("change", updateMotionPreference);
    return () => motionQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!isPlaying || (prefersReducedMotion && !motionOverride)) return;

    const interval = window.setInterval(() => moveBy(1), 4800);
    return () => window.clearInterval(interval);
  }, [isPlaying, prefersReducedMotion, motionOverride]);

  return (
    <div
      className={styles.explorer}
    >
      <div className={styles.explorerTop}>
        <div className={styles.industryJumps} role="group" aria-label="Start with an industry">
          {industries.map((industry, index) => (
            <button
              aria-controls="industry-track"
              aria-pressed={index === activeIndex}
              className={`${styles.tab} ${index === activeIndex ? styles.activeTab : ""}`}
              id={`industry-jump-${index}`}
              key={industry.name}
              onClick={() => moveTo(index)}
              onKeyDown={handleIndustryKeyDown}
              tabIndex={index === activeIndex ? 0 : -1}
              type="button"
            >
              <span className={styles.tabIndex}>{String(index + 1).padStart(2, "0")}</span>
              <span>{industry.name}</span>
              <span className={styles.tabSignal} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div className={styles.controls} role="group" aria-label="Carousel controls">
          <span className={styles.counter} aria-label={`Industry ${activeIndex + 1} of ${industryCount}`} aria-live="off">
            <strong>{formattedIndex}</strong> <span>/ {String(industryCount).padStart(2, "0")}</span>
          </span>
          <button
            aria-label={isPlaying ? "Pause automatic carousel" : "Play automatic carousel"}
            className={`button button--outline button--small ${styles.playControl}`}
            onClick={togglePlayback}
            type="button"
          >
            <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button aria-label="Previous industry" className="button button--control" onClick={() => moveBy(-1)} type="button">
            <span aria-hidden="true">←</span>
          </button>
          <button aria-label="Next industry" className="button button--control" onClick={() => moveBy(1)} type="button">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className={styles.viewport} id="industry-track" ref={viewportRef} role="region" aria-label="Industries" aria-roledescription="carousel">
        <div
          className={`${styles.track} ${isSnapping ? styles.trackSnapping : ""}`}
          onTransitionEnd={handleTrackTransitionEnd}
          ref={trackRef}
          style={{ transform: `translate3d(-${position * step}px, 0, 0)` }}
        >
          {carouselItems.map((industry, index) => {
            const isDuplicate = index < industryCount || index >= industryCount * 2;
            const industryIndex = index % industryCount;

            return (
              <article
                aria-hidden={isDuplicate || undefined}
                aria-label={`Industry ${industryIndex + 1} of ${industryCount}: ${industry.name}`}
                aria-roledescription="slide"
                className={styles.card}
                data-industry-card
                key={`${industry.name}-${index}`}
                role="group"
              >
                <figure className={styles.cardImage}>
                  <Image
                    alt={isDuplicate ? "" : industry.alt}
                    className={styles.image}
                    fill
                    priority={index === industryCount}
                    sizes="(max-width: 980px) 50vw, 33vw"
                    src={industry.image}
                  />
                  <figcaption className={styles.cardCaption}>
                    <div className={styles.cardMeta}>
                      <span>FIELD NOTE</span>
                      <span>{String(industryIndex + 1).padStart(2, "0")} / {String(industryCount).padStart(2, "0")}</span>
                    </div>
                    <div className={styles.cardCopy}>
                      <span className={styles.cardName}>{industry.name}</span>
                      <h3>{industry.title}</h3>
                      <p>{industry.description}</p>
                      <p className={styles.tasksLabel}>BETTER AT</p>
                      <ul className={styles.cardTasks}>
                        {industry.tasks.map((task) => (
                          <li key={task}>{task}</li>
                        ))}
                      </ul>
                    </div>
                    <span className={styles.cardArrow} aria-hidden="true">↗</span>
                  </figcaption>
                </figure>
              </article>
            );
          })}
        </div>
      </div>

      <p className={styles.note}>Illustrative applications. No customer results implied.</p>
    </div>
  );
}

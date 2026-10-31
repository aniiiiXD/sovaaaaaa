"use client";

import { useEffect, useRef } from "react";

/**
 * HeroVideo — full-bleed looping background video with a custom JS fade system:
 * a 500ms fade-in once the clip is genuinely playing, a 500ms fade-out 0.55s
 * before the end, then a hard reset-and-replay for a seamless loop. Each fade
 * cancels the running animation frame and resumes from the current opacity so
 * fades never compete. Muted autoplay works for most browsers; if a context
 * blocks it, playback starts on the first user interaction.
 */
const FADE_MS = 500;
const FADE_OUT_LEAD = 0.55;

export default function HeroVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadingOutRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.style.opacity = "0";

    const cancelFade = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const fade = (to: number, duration: number) => {
      cancelFade();
      const from = parseFloat(video.style.opacity || "0");
      let startTs: number | null = null;
      const step = (ts: number) => {
        if (startTs === null) startTs = ts;
        const t = duration <= 0 ? 1 : Math.min(1, (ts - startTs) / duration);
        video.style.opacity = String(from + (to - from) * t);
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else rafRef.current = null;
      };
      rafRef.current = requestAnimationFrame(step);
    };

    // If autoplay is blocked, start on the first user interaction.
    let removeGesture: (() => void) | null = null;
    const GESTURES = ["pointerdown", "touchstart", "keydown", "scroll"] as const;
    const armGestureFallback = () => {
      if (removeGesture) return;
      const onGesture = () => {
        video.play().catch(() => {});
      };
      GESTURES.forEach((e) =>
        window.addEventListener(e, onGesture, { once: true, passive: true }),
      );
      removeGesture = () =>
        GESTURES.forEach((e) => window.removeEventListener(e, onGesture));
    };
    const tryPlay = () => {
      video.play().catch(() => armGestureFallback());
    };

    const onLoaded = () => {
      fadingOutRef.current = false;
      tryPlay();
    };

    // Fade in only once playback is actually running — never a paused dark frame.
    const onPlaying = () => {
      if (!fadingOutRef.current) fade(1, FADE_MS);
    };

    const onTime = () => {
      if (!Number.isFinite(video.duration)) return;
      if (video.duration - video.currentTime <= FADE_OUT_LEAD && !fadingOutRef.current) {
        fadingOutRef.current = true;
        fade(0, FADE_MS);
      }
    };

    const onEnded = () => {
      cancelFade();
      video.style.opacity = "0";
      window.setTimeout(() => {
        video.currentTime = 0;
        fadingOutRef.current = false;
        tryPlay();
      }, 100);
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    if (video.readyState >= 2) tryPlay();

    return () => {
      cancelFade();
      removeGesture?.();
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style={{ opacity: 0 }}
      muted
      autoPlay
      playsInline
      preload="auto"
      aria-hidden
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

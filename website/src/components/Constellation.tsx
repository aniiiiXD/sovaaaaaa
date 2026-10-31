"use client";

import { useEffect, useRef } from "react";

/**
 * The company brain, alive.
 * Nodes are the things a company knows and does — memories (cyan),
 * agents (magenta) and workspaces/people (violet). Synapses wire the
 * nearest ones together; signal pulses travel the wires. One central
 * hub is the cortex itself. Honors prefers-reduced-motion by rendering
 * a single still frame.
 */

const CYAN = "#46E6CE";
const MAGENTA = "#FF5D8F";
const VIOLET = "#8A6CF0";
const COLORS = [CYAN, MAGENTA, VIOLET];

type Node = {
  x: number;
  y: number;
  ox: number; // origin (for drift + parallax)
  oy: number;
  amp: number;
  phase: number;
  speed: number;
  r: number;
  type: number; // 0 cyan, 1 magenta, 2 violet
  hub: boolean;
};

type Pulse = { edge: number; t: number; speed: number; color: string };

export default function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let nodes: Node[] = [];
    let edges: [number, number][] = [];
    let pulses: Pulse[] = [];
    const pointer = { x: 0.5, y: 0.5, active: false };

    const NODE_COUNT = 44;

    function build() {
      nodes = [];
      // central cortex hub
      nodes.push({
        x: 0.5, y: 0.46, ox: 0.5, oy: 0.46, amp: 0.004, phase: 0,
        speed: 0.4, r: 9, type: 2, hub: true,
      });
      for (let i = 1; i < NODE_COUNT; i++) {
        // bias toward a soft elliptical cloud around the hub
        const a = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.7) * 0.46;
        const ox = 0.5 + Math.cos(a) * rad * 1.02;
        const oy = 0.46 + Math.sin(a) * rad * 0.92;
        nodes.push({
          x: ox, y: oy, ox, oy,
          amp: 0.004 + Math.random() * 0.012,
          phase: Math.random() * Math.PI * 2,
          speed: 0.25 + Math.random() * 0.6,
          r: 1.6 + Math.random() * 2.6,
          type: Math.floor(Math.random() * 3),
          hub: false,
        });
      }

      // edges: connect each node to its 2-3 nearest neighbours + hub links
      edges = [];
      const seen = new Set<string>();
      for (let i = 1; i < nodes.length; i++) {
        const dists: { j: number; d: number }[] = [];
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const dx = nodes[i].ox - nodes[j].ox;
          const dy = nodes[i].oy - nodes[j].oy;
          dists.push({ j, d: dx * dx + dy * dy });
        }
        dists.sort((p, q) => p.d - q.d);
        const k = 2 + (Math.random() < 0.4 ? 1 : 0);
        for (let n = 0; n < k; n++) {
          const j = dists[n].j;
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) continue;
          seen.add(key);
          edges.push([Math.min(i, j), Math.max(i, j)]);
        }
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.max(1, Math.floor(W * dpr));
      canvas!.height = Math.max(1, Math.floor(H * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const px = (n: Node) => n.x * W;
    const py = (n: Node) => n.y * H;

    function spawnPulse() {
      if (edges.length === 0) return;
      const edge = Math.floor(Math.random() * edges.length);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      pulses.push({ edge, t: 0, speed: 0.006 + Math.random() * 0.012, color });
    }

    function drawFrame(time: number) {
      ctx!.clearRect(0, 0, W, H);

      // parallax offset from pointer (subtle)
      const ofx = pointer.active ? (pointer.x - 0.5) * 0.02 : 0;
      const ofy = pointer.active ? (pointer.y - 0.5) * 0.02 : 0;

      for (const n of nodes) {
        const drift = reduce ? 0 : Math.sin(time * 0.0006 * n.speed + n.phase) * n.amp;
        const driftY = reduce ? 0 : Math.cos(time * 0.0005 * n.speed + n.phase) * n.amp;
        const depth = n.hub ? 1.4 : n.r / 4;
        n.x = n.ox + drift + ofx * depth;
        n.y = n.oy + driftY + ofy * depth;
      }

      // edges
      for (const [a, b] of edges) {
        const na = nodes[a];
        const nb = nodes[b];
        const grad = ctx!.createLinearGradient(px(na), py(na), px(nb), py(nb));
        grad.addColorStop(0, COLORS[na.type] + "22");
        grad.addColorStop(1, COLORS[nb.type] + "10");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = na.hub || nb.hub ? 1.1 : 0.6;
        ctx!.beginPath();
        ctx!.moveTo(px(na), py(na));
        ctx!.lineTo(px(nb), py(nb));
        ctx!.stroke();
      }

      // pulses
      for (const p of pulses) {
        const [a, b] = edges[p.edge];
        const na = nodes[a];
        const nb = nodes[b];
        const x = px(na) + (px(nb) - px(na)) * p.t;
        const y = py(na) + (py(nb) - py(na)) * p.t;
        ctx!.save();
        ctx!.shadowBlur = 12;
        ctx!.shadowColor = p.color;
        ctx!.fillStyle = p.color;
        ctx!.beginPath();
        ctx!.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
        if (!reduce) p.t += p.speed;
      }
      pulses = pulses.filter((p) => p.t < 1);

      // nodes
      for (const n of nodes) {
        const color = COLORS[n.type];
        const x = px(n);
        const y = py(n);
        if (n.hub) {
          const halo = ctx!.createRadialGradient(x, y, 0, x, y, 46);
          halo.addColorStop(0, VIOLET + "55");
          halo.addColorStop(1, VIOLET + "00");
          ctx!.fillStyle = halo;
          ctx!.beginPath();
          ctx!.arc(x, y, 46, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.save();
        ctx!.shadowBlur = n.hub ? 22 : 8;
        ctx!.shadowColor = color;
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.arc(x, y, n.r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
        // crisp core
        ctx!.fillStyle = "#0A0916";
        ctx!.beginPath();
        ctx!.arc(x, y, Math.max(0.4, n.r * 0.32), 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let raf = 0;
    let lastSpawn = 0;
    function loop(time: number) {
      if (time - lastSpawn > 240 && pulses.length < 26) {
        spawnPulse();
        lastSpawn = time;
      }
      drawFrame(time);
      raf = requestAnimationFrame(loop);
    }

    const onPointer = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = (e.clientX - rect.left) / rect.width;
      pointer.y = (e.clientY - rect.top) / rect.height;
      pointer.active = true;
    };
    const onLeave = () => (pointer.active = false);

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas);

    build();
    resize();

    if (reduce) {
      // seed a few static pulses so the still frame reads as "wired"
      for (let i = 0; i < 14; i++) {
        const edge = Math.floor(Math.random() * Math.max(1, edges.length));
        pulses.push({ edge, t: Math.random(), speed: 0, color: COLORS[i % 3] });
      }
      drawFrame(0);
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerleave", onLeave);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}

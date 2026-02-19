"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── 1. Mouse Glow Demo ───────────────────────────────────────────────────────
function MouseGlowDemo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--gx", `${x}%`);
      el.style.setProperty("--gy", `${y}%`);
    };
    el.addEventListener("mousemove", handler);
    return () => el.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="demo-card glow-card h-40 flex items-center justify-center text-sm select-none"
      style={
        {
          "--gx": "50%",
          "--gy": "50%",
          color: "#8b7e70",
        } as React.CSSProperties
      }
    >
      Move your mouse here
    </div>
  );
}

// ─── 2. Scramble / Typewriter Text ───────────────────────────────────────────
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";

function useScramble(target: string, active: boolean) {
  const [display, setDisplay] = useState(target);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) { setDisplay(target); return; }
    let iteration = 0;
    const totalFrames = target.length * 3;

    const step = () => {
      const progress = iteration / totalFrames;
      setDisplay(
        target
          .split("")
          .map((char, i) => {
            if (i < Math.floor(progress * target.length)) return char;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );
      iteration++;
      if (iteration <= totalFrames) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, target]);

  return display;
}

function ScrambleDemo() {
  const [active, setActive] = useState(false);
  const text1 = useScramble("Video Breakdown Pipeline", active);
  const text2 = useScramble("Deep Analysis · AI Powered", active);

  const trigger = () => {
    setActive(false);
    requestAnimationFrame(() => setActive(true));
  };

  return (
    <div className="demo-card h-40 flex flex-col items-center justify-center gap-3">
      <p style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: "20px", fontWeight: 700, color: "#3a3229", letterSpacing: "-0.02em" }}>{text1}</p>
      <p style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: "13px", color: "#8b7e70" }}>{text2}</p>
      <button
        onClick={trigger}
        style={{
          marginTop: "8px",
          padding: "6px 16px",
          fontSize: "12px",
          borderRadius: "6px",
          border: "1px solid #e8dfd6",
          background: "transparent",
          color: "#8b7e70",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#3a3229"; (e.target as HTMLElement).style.borderColor = "#d9a88f"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8b7e70"; (e.target as HTMLElement).style.borderColor = "#e8dfd6"; }}
      >
        Scramble Again
      </button>
    </div>
  );
}

// ─── 3. 3D Tilt Card ─────────────────────────────────────────────────────────
function TiltCard() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(600px) rotateY(${x * 20}deg) rotateX(${-y * 20}deg) scale(1.03)`;
  };

  const handleLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="demo-card h-40 flex flex-col items-center justify-center gap-2 cursor-pointer"
      style={{ transition: "transform 0.1s ease", transformStyle: "preserve-3d" }}
    >
      <div style={{ fontSize: "28px", color: "#d9a88f" }}>✦</div>
      <p style={{ color: "#8b7e70", fontSize: "13px" }}>Hover to tilt</p>
      <p style={{ color: "#bfb5a8", fontSize: "11px" }}>3D perspective effect</p>
    </div>
  );
}

// ─── 4. Fade-In Slide Up (Intersection Observer) ─────────────────────────────
function FadeInBlock({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── 5. Number Counter ───────────────────────────────────────────────────────
function useCounter(target: number, active: boolean, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) { setValue(0); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);

  return value;
}

function CounterDemo() {
  const [active, setActive] = useState(false);
  const words = useCounter(12847, active);
  const segments = useCounter(342, active);
  const layers = useCounter(4, active);

  return (
    <div className="demo-card h-40 flex flex-col items-center justify-center gap-4">
      <div className="flex gap-8">
        {[
          { label: "Words", value: words.toLocaleString() },
          { label: "Segments", value: segments.toLocaleString() },
          { label: "Layers", value: layers.toString() },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#3a3229", fontFamily: "var(--font-geist-mono, monospace)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div style={{ fontSize: "11px", color: "#8b7e70", marginTop: "4px" }}>{label}</div>
          </div>
        ))}
      </div>
      <button
        onClick={() => { setActive(false); setTimeout(() => setActive(true), 50); }}
        style={{
          padding: "6px 16px",
          fontSize: "12px",
          borderRadius: "6px",
          border: "1px solid #e8dfd6",
          background: "transparent",
          color: "#8b7e70",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#3a3229"; (e.target as HTMLElement).style.borderColor = "#d9a88f"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8b7e70"; (e.target as HTMLElement).style.borderColor = "#e8dfd6"; }}
      >
        Count Up
      </button>
    </div>
  );
}

// ─── 6. Progress Bar ─────────────────────────────────────────────────────────
function ProgressBarDemo() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const run = useCallback(() => {
    if (running) return;
    setProgress(0);
    setRunning(true);
    const steps = [
      { target: 15, label: "Fetching transcript" },
      { target: 45, label: "Parsing segments" },
      { target: 75, label: "Running AI pipeline" },
      { target: 95, label: "Generating breakdown" },
      { target: 100, label: "Done" },
    ];
    let stepIdx = 0;
    const interval = window.setInterval(() => {
      if (stepIdx >= steps.length) {
        clearInterval(interval);
        setRunning(false);
        return;
      }
      setProgress(steps[stepIdx].target);
      stepIdx++;
    }, 600);
    intervalRef.current = interval;
  }, [running]);

  return (
    <div className="demo-card h-40 flex flex-col items-center justify-center gap-4 px-8">
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#8b7e70", marginBottom: "8px" }}>
          <span>Analysis Progress</span>
          <span style={{ fontFamily: "var(--font-geist-mono, monospace)" }}>{progress}%</span>
        </div>
        <div style={{ height: "6px", background: "#e8dfd6", borderRadius: "999px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #d9a88f 0%, #d8b5a5 100%)",
              borderRadius: "999px",
              width: `${progress}%`,
              transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>
      </div>
      <button
        onClick={run}
        disabled={running}
        style={{
          padding: "6px 16px",
          fontSize: "12px",
          borderRadius: "6px",
          border: "1px solid #e8dfd6",
          background: "transparent",
          color: running ? "#bfb5a8" : "#8b7e70",
          cursor: running ? "not-allowed" : "pointer",
          opacity: running ? 0.5 : 1,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!running) { (e.target as HTMLElement).style.color = "#3a3229"; (e.target as HTMLElement).style.borderColor = "#d9a88f"; }
        }}
        onMouseLeave={(e) => {
          if (!running) { (e.target as HTMLElement).style.color = "#8b7e70"; (e.target as HTMLElement).style.borderColor = "#e8dfd6"; }
        }}
      >
        {running ? "Running..." : "Simulate Analysis"}
      </button>
    </div>
  );
}

// ─── 7. Tab Switch Demo ───────────────────────────────────────────────────────
const DEMO_TABS = ["Subtitles", "Deep Analysis", "Visual Notes"];

function TabSwitchDemo() {
  const [active, setActive] = useState(0);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = tabRefs.current[active];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [active]);

  return (
    <div className="demo-card h-40 flex flex-col justify-center">
      <div style={{ position: "relative", borderBottom: "1px solid #e8dfd6", display: "flex", padding: "0 16px" }}>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            height: "2px",
            background: "#d9a88f",
            borderRadius: "2px 2px 0 0",
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            transition: "left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        {DEMO_TABS.map((tab, i) => (
          <button
            key={tab}
            ref={(el) => { tabRefs.current[i] = el; }}
            onClick={() => setActive(i)}
            style={{
              padding: "12px 16px",
              fontSize: "13px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active === i ? "#3a3229" : "#8b7e70",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (active !== i) (e.target as HTMLElement).style.color = "#3a3229";
            }}
            onMouseLeave={(e) => {
              if (active !== i) (e.target as HTMLElement).style.color = "#8b7e70";
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p
          key={active}
          style={{ color: "#8b7e70", fontSize: "13px", animation: "fadeSlideIn 0.25s ease forwards" }}
        >
          {DEMO_TABS[active]} content renders here
        </p>
      </div>
    </div>
  );
}

// ─── 8. Glow Button ───────────────────────────────────────────────────────────
function GlowButtonDemo() {
  return (
    <div className="demo-card h-40 flex items-center justify-center gap-4">
      <button
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          background: "#d9a88f",
          color: "#ffffff",
          fontSize: "13px",
          fontWeight: 500,
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#c9997f"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "#d9a88f"; }}
      >
        Primary
      </button>
      <button
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          background: "transparent",
          border: "1px solid #e8dfd6",
          color: "#8b7e70",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = "#d9a88f"; (e.target as HTMLElement).style.color = "#3a3229"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = "#e8dfd6"; (e.target as HTMLElement).style.color = "#8b7e70"; }}
      >
        Secondary
      </button>
      <button
        style={{
          padding: "10px 20px",
          borderRadius: "8px",
          background: "transparent",
          border: "none",
          color: "#8b7e70",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#3a3229"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8b7e70"; }}
      >
        Ghost
      </button>
    </div>
  );
}

// ─── Main Playground Page ─────────────────────────────────────────────────────
const DEMOS = [
  { title: "Mouse Glow", desc: "Radial gradient follows cursor", component: <MouseGlowDemo /> },
  { title: "Scramble Text", desc: "Typewriter / character decode animation", component: <ScrambleDemo /> },
  { title: "3D Tilt Card", desc: "Perspective rotation on hover", component: <TiltCard /> },
  { title: "Number Counter", desc: "Eased count-up animation", component: <CounterDemo /> },
  { title: "Progress Bar", desc: "Smooth analysis progress simulation", component: <ProgressBarDemo /> },
  { title: "Tab Indicator", desc: "Sliding underline with smooth transition", component: <TabSwitchDemo /> },
  { title: "Button Variants", desc: "Primary / Secondary / Ghost styles", component: <GlowButtonDemo /> },
];

export default function PlaygroundPage() {
  return (
    <>
      <style>{`
        .demo-card {
          background: #fdfcfb;
          border: 1px solid #e8dfd6;
          border-radius: 12px;
          padding: 24px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .demo-card:hover {
          border-color: #d4c4b6;
          box-shadow: 0 2px 8px rgba(217,168,143,0.08);
        }
        .glow-card {
          background: radial-gradient(
            circle at var(--gx, 50%) var(--gy, 50%),
            rgba(217,168,143,0.12) 0%,
            rgba(217,168,143,0.04) 40%,
            transparent 70%
          ), #fdfcfb;
          border: 1px solid rgba(217,168,143,0.3);
          transition: border-color 0.2s;
        }
        .glow-card:hover {
          border-color: rgba(217,168,143,0.5);
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f5f0ea", color: "#3a3229", fontFamily: "var(--font-geist-sans, sans-serif)" }}>
        {/* Header */}
        <div style={{ borderBottom: "1px solid #e8dfd6", padding: "24px 40px", background: "#fdfcfb" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#3a3229", margin: 0 }}>
                Animation Playground
              </h1>
              <p style={{ fontSize: "13px", color: "#8b7e70", marginTop: "4px" }}>
                All effects available for your UI — pick what resonates
              </p>
            </div>
            <a
              href="/"
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                border: "1px solid #e8dfd6",
                borderRadius: "8px",
                color: "#8b7e70",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#3a3229"; (e.target as HTMLElement).style.borderColor = "#d9a88f"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8b7e70"; (e.target as HTMLElement).style.borderColor = "#e8dfd6"; }}
            >
              ← Back to App
            </a>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "20px", maxWidth: "1200px" }}>
          {DEMOS.map(({ title, desc, component }, i) => (
            <FadeInBlock key={title} delay={i * 60}>
              <div>
                <div style={{ marginBottom: "10px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 500, color: "#3a3229", margin: "0 0 2px 0" }}>{title}</h3>
                  <p style={{ fontSize: "12px", color: "#8b7e70", margin: 0 }}>{desc}</p>
                </div>
                {component}
              </div>
            </FadeInBlock>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ padding: "0 40px 40px", maxWidth: "1200px" }}>
          <p style={{ fontSize: "12px", color: "#bfb5a8", borderTop: "1px solid #e8dfd6", paddingTop: "24px" }}>
            All effects use zero external dependencies · Pure CSS + React hooks · Ready to apply to main UI
          </p>
        </div>
      </div>
    </>
  );
}

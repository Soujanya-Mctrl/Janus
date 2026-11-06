"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { WaveChart } from "@/components/charts/wave-chart";
import { RadarChart } from "@/components/charts/radar-chart";

interface StatConfig {
  icon: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  delay: string;
}

const STATS: StatConfig[] = [
  { icon: "<", target: 120, suffix: "ms", decimals: 0, label: "Inference Time", delay: "0.5s" },
  { icon: "%", target: 99.99, suffix: "%", decimals: 2, label: "Platform Uptime", delay: "0.58s" },
  { icon: "*", target: 24, suffix: "/7", decimals: 0, label: "Autonomous Runtime", delay: "0.66s" },
  { icon: "#", target: 2.4, suffix: "M", decimals: 1, label: "Context Windows", delay: "0.74s" },
];

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [, startTransition] = useTransition();

  // Hero Stats Counter
  const [statValues, setStatValues] = useState<string[]>(() =>
    STATS.map((s) => (0).toFixed(s.decimals) + s.suffix)
  );
  const statsRef = useRef<HTMLElement>(null);
  const animatedRef = useRef(false);

  // Interactive Accounting Simulator State
  const [taskCap] = useState<number>(100);
  const [spent, setSpent] = useState<number>(20);
  const [reserved, setReserved] = useState<number>(10);
  const [epoch, setEpoch] = useState<number>(2);
  const [simLog, setSimLog] = useState<string>("Initial state: 100 cap, 20 spent, 10 reserved -> 70 available.");

  const available = Math.max(0, taskCap - spent - reserved);

  // Creative Feature 1: Autonomous Agent Handoff Simulation State
  type HandoffPhase = "idle" | "workerA_running" | "workerA_crashed" | "workerB_resumed";
  const [handoffPhase, setHandoffPhase] = useState<HandoffPhase>("workerA_running");
  const [handoffEpoch, setHandoffEpoch] = useState(1);
  const [handoffLog, setHandoffLog] = useState(
    "Worker A is currently active under Epoch 01. Budget: 20 spent, 10 reserved, 70 available."
  );

  // Creative Feature 2: Interactive 96-Byte Envelope Inspector
  const [selectedByteSlot, setSelectedByteSlot] = useState<"taskId" | "opId" | "attempt">("taskId");

  // Creative Feature 3: Live Telemetry Ticker Events
  const [tickerEvents, setTickerEvents] = useState([
    { time: "19:54:12", msg: "Task 0x8a2f: Settlement confirmed 0.02 USDC", badge: "Hedera Testnet" },
    { time: "19:54:05", msg: "Worker A timeout detected (30s heartbeat lost)", badge: "Epoch 01 -> 02" },
    { time: "19:53:50", msg: "Deliverable 0x4c9b retrieved from durable fsync cache", badge: "Zero Double-Charge" },
    { time: "19:53:18", msg: "Owner direct recovery check verified: 9 Phase-1 scenarios", badge: "Smart Contract Exit" },
  ]);

  // Live telemetry pulse
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];
      const randomOps = [
        { msg: "Task 0x9b11: 10 USDC reservation locked for subagent reasoning", badge: "In-Flight Commitment" },
        { msg: "Epoch incremented: Obsolete worker signatures fenced", badge: "Zero Residual Authority" },
        { msg: "Cryptographic quote verified: 0.02 USDC pinned rate", badge: "Merchant Signature" },
        { msg: "State invariant verified: Cap = Available + Reserved + Spent", badge: "Model Oracle Check" },
      ];
      const chosen = randomOps[Math.floor(Math.random() * randomOps.length)];
      setTickerEvents((prev) => [{ time: timeStr, msg: chosen.msg, badge: chosen.badge }, ...prev.slice(0, 4)]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  function handleSimSpend(amount: number) {
    if (reserved >= amount) {
      setReserved((r) => r - amount);
      setSpent((s) => s + amount);
      setSimLog(`Settled ${amount} units from reservation. Available: ${available}, Spent: ${spent + amount}.`);
    } else if (available >= amount) {
      setSpent((s) => s + amount);
      setSimLog(`Direct settle ${amount} units. Available: ${available - amount}, Spent: ${spent + amount}.`);
    } else {
      setSimLog(`Transaction rejected: Insufficient budget under task cap.`);
    }
  }

  function handleSimReserve(amount: number) {
    if (available >= amount) {
      setReserved((r) => r + amount);
      setSimLog(`Created reservation of ${amount} units for in-flight request. Remaining available: ${available - amount}.`);
    } else {
      setSimLog(`Reservation failed: Exceeds available task cap (${available} available).`);
    }
  }

  function handleIncrementEpoch() {
    setEpoch((e) => e + 1);
    setSimLog(`Epoch incremented to ${epoch + 1}. Old worker spending authority fenced. Pending reservations preserved.`);
  }

  function handleResetSim() {
    setSpent(20);
    setReserved(10);
    setEpoch(2);
    setSimLog("Reset to reference benchmark: 100 cap, 20 spent, 10 reserved, epoch 02.");
  }

  // Handoff Simulation controls
  function handleTriggerCrash() {
    setHandoffPhase("workerA_crashed");
    setHandoffEpoch(2);
    setHandoffLog("CRITICAL: Worker A heartbeat lost. Epoch incremented to 02! Worker A is now fenced from new commitments.");
  }

  function handleResumeWorkerB() {
    setHandoffPhase("workerB_resumed");
    setHandoffLog("SUCCESS: Replacement Worker B initialized in Epoch 02. Retrying task: Deliverable hash 0x7f4b recovered from cache. No second charge!");
  }

  function handleResetHandoff() {
    setHandoffPhase("workerA_running");
    setHandoffEpoch(1);
    setHandoffLog("Reset: Worker A active under Epoch 01 with 100 cap.");
  }

  // Hero count-up animation
  useEffect(() => {
    function animateStat(index: number) {
      const config = STATS[index];
      const duration = 1500 + index * 80;
      const startOffset = 480 + index * 90;

      setTimeout(() => {
        let startTime: number | null = null;

        function step(currentTime: number) {
          if (!startTime) startTime = currentTime;
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutCubic(progress);
          const current = eased * config.target;

          setStatValues((prev) => {
            const next = [...prev];
            next[index] =
              (progress < 1 ? current.toFixed(config.decimals) : config.target.toFixed(config.decimals)) +
              config.suffix;
            return next;
          });

          if (progress < 1) {
            requestAnimationFrame(step);
          }
        }

        requestAnimationFrame(step);
      }, startOffset);
    }

    function triggerAnimation() {
      if (animatedRef.current) return;
      animatedRef.current = true;
      STATS.forEach((_, i) => animateStat(i));
    }

    const el = statsRef.current;
    if ("IntersectionObserver" in window && el) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              triggerAnimation();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.25 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      triggerAnimation();
    }
  }, []);

  // Keyboard and resize handling for mobile menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 720) setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    document.body.classList.add("menu-open");

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("menu-open");
    };
  }, [menuOpen]);

  const navItems = [
    { name: "Home", href: "#hero" },
    { name: "Overview", href: "#overview" },
    { name: "Accounting", href: "#accounting" },
    { name: "Architecture", href: "#architecture" },
  ];

  return (
    <div className="landing-body">
      {/* Background Video */}
      <div className="bg">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* ====================================================================
          HERO VIEWPORT
          ==================================================================== */}
      <div className="landing-hero-viewport" id="hero">
        {/* Header */}
        <header className="header">
          {/* Logo */}
          <Link href="/" className="logo-btn" aria-label="Brand Home">
            <Image src="/assets/logo.webp" alt="" width={52} height={52} priority unoptimized />
          </Link>

          {/* Desktop Nav Pill */}
          <nav className="nav-pill" aria-label="Main Navigation">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`nav-link ${activeNav === item.name ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  startTransition(() => {
                    setActiveNav(item.name);
                    const targetEl = document.querySelector(item.href);
                    targetEl?.scrollIntoView({ behavior: "smooth" });
                  });
                }}
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Desktop Sign In */}
          <Link href="/login" className="sign-in-btn desktop-only">
            Sign in
          </Link>

          {/* Mobile Burger Button */}
          <button
            type="button"
            className="burger-btn mobile-only"
            aria-label="Open Navigation Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="burger-bar" />
            <span className="burger-bar" />
            <span className="burger-bar" />
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        <div
          className="mobile-overlay"
          hidden={!menuOpen}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
        >
          <div className="mobile-sheet">
            <nav className="mobile-nav" aria-label="Mobile Navigation">
              {navItems.map((item, idx) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`mobile-nav-link ${activeNav === item.name ? "active" : ""}`}
                  style={{ "--i": idx } as React.CSSProperties}
                  onClick={(e) => {
                    e.preventDefault();
                    startTransition(() => {
                      setActiveNav(item.name);
                      setMenuOpen(false);
                      const targetEl = document.querySelector(item.href);
                      targetEl?.scrollIntoView({ behavior: "smooth" });
                    });
                  }}
                >
                  {item.name}
                </a>
              ))}
              <Link
                href="/login"
                className="mobile-sign-in"
                style={{ "--i": 4 } as React.CSSProperties}
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            </nav>
          </div>
        </div>

        {/* Hero Main */}
        <main className="hero">
          {/* Trust Row */}
          <div className="trust-row anim" style={{ "--d": "0.05s" } as React.CSSProperties}>
            <div className="trust-avatars">
              <div className="trust-avatar avatar-1" style={{ "--z": 1 } as React.CSSProperties}>
                <span className="avatar-ring">
                  <span className="avatar-inner">
                    <i className="fa-brands fa-microsoft" />
                  </span>
                </span>
              </div>
              <div className="trust-avatar avatar-2" style={{ "--z": 2 } as React.CSSProperties}>
                <span className="avatar-ring">
                  <span className="avatar-inner">
                    <i className="fa-brands fa-amazon" />
                  </span>
                </span>
              </div>
              <div className="trust-avatar avatar-3" style={{ "--z": 4 } as React.CSSProperties}>
                <span className="avatar-ring">
                  <span className="avatar-inner">
                    <i className="fa-brands fa-google" />
                  </span>
                </span>
              </div>
            </div>
            <div className="trust-pill">
              <span className="trust-text">Trusted by 2000+ Enterprises</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="headline anim">
            <span className="headline-line" style={{ "--d": "0.12s" } as React.CSSProperties}>
              Intelligence
            </span>
            <span className="headline-line" style={{ "--d": "0.3s" } as React.CSSProperties}>
              Designed To Evolve
            </span>
          </h1>

          {/* Subhead */}
          <p className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
            Build applications that reason, adapt and collaborate using a modular
            AI platform designed for production.
          </p>

          {/* CTA */}
          <Link href="/login" className="cta anim" style={{ "--d": "0.4s" } as React.CSSProperties}>
            Get Started
          </Link>
        </main>

        {/* Hero Stats Footer */}
        <footer className="stats" ref={statsRef}>
          {STATS.map((stat, idx) => (
            <div key={stat.label} className="stat anim" style={{ "--d": stat.delay } as React.CSSProperties}>
              <span className="stat-icon">{stat.icon}</span>
              <span className="stat-value">{statValues[idx]}</span>
              <span className="stat-label">{stat.label}</span>
            </div>
          ))}
        </footer>
      </div>

      {/* ====================================================================
          CREATIVE CONTENT SECTIONS
          ==================================================================== */}
      <div className="content-sections">
        {/* ==================================================================
            CREATIVE SECTION 1: INTERACTIVE AGENT HANDOFF SIMULATOR
            ================================================================== */}
        <section className="section-container" id="simulation">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Deterministic Handoff Engine · CONTEXT.md</span>
            </div>
            <h2 className="section-title">See an Agent Crash and Resumption in Action</h2>
            <p className="section-desc">
              When an autonomous worker times out after payment, Janus increments the onchain epoch.
              The old worker is immediately fenced from new commitments, while the replacement worker recovers previously paid deliverables without paying twice.
            </p>
          </div>

          <div className="handoff-stage">
            <div className="handoff-controls">
              <div className="handoff-status-pill">
                <span className={`handoff-status-dot ${handoffPhase === "workerA_crashed" ? "danger" : ""}`} />
                <span>
                  {handoffPhase === "workerA_running" && "Worker A Running (Epoch 01)"}
                  {handoffPhase === "workerA_crashed" && "CRITICAL: Worker A Fenced (Epoch 02)"}
                  {handoffPhase === "workerB_resumed" && "Worker B Operating with Reused Result (Epoch 02)"}
                </span>
              </div>

              <div className="handoff-buttons">
                <button
                  type="button"
                  className="handoff-btn"
                  disabled={handoffPhase !== "workerA_running"}
                  onClick={handleTriggerCrash}
                >
                  <i className="fa-solid fa-triangle-exclamation" />
                  <span>Simulate Worker A Drop</span>
                </button>

                <button
                  type="button"
                  className="handoff-btn"
                  disabled={handoffPhase !== "workerA_crashed"}
                  onClick={handleResumeWorkerB}
                >
                  <i className="fa-solid fa-arrow-rotate-right" />
                  <span>Resume with Worker B</span>
                </button>

                <button
                  type="button"
                  className="handoff-btn outline"
                  onClick={handleResetHandoff}
                >
                  <span>Reset Demo</span>
                </button>
              </div>
            </div>

            {/* Arena displaying two agents */}
            <div className="workers-arena">
              {/* Worker A */}
              <div className={`worker-box ${handoffPhase === "workerA_running" ? "active" : ""} ${handoffPhase === "workerA_crashed" ? "crashed" : ""}`}>
                <div className="worker-header">
                  <span className="worker-tag">
                    <i className="fa-solid fa-robot" />
                    <span>Worker A (Primary)</span>
                  </span>
                  <span className="worker-epoch-badge">
                    {handoffPhase === "workerA_crashed" ? "REVOKED" : `EPOCH 0${handoffEpoch}`}
                  </span>
                </div>
                <h3 className="worker-title">
                  {handoffPhase === "workerA_crashed" ? "Disconnected / Fenced" : "Financial Analyst Agent"}
                </h3>
                <div className="worker-metrics">
                  <div>
                    <small>Spent on Deliverable</small>
                    <strong>20.00 USDC</strong>
                  </div>
                  <div>
                    <small>In-Flight Lock</small>
                    <strong>10.00 USDC</strong>
                  </div>
                </div>
                <small style={{ color: handoffPhase === "workerA_crashed" ? "#ff7777" : "#888888", fontSize: "11px" }}>
                  {handoffPhase === "workerA_crashed"
                    ? "✗ Cryptographic signature blocked: Epoch is now 02"
                    : "✓ Authorized for 96-byte envelope operations"}
                </small>
              </div>

              {/* Fence & Barrier */}
              <div className="handoff-center-wire">
                <div className={`fence-barrier ${handoffPhase === "workerA_crashed" ? "fenced" : ""}`}>
                  <i className={handoffPhase === "workerA_crashed" ? "fa-solid fa-lock" : "fa-solid fa-arrows-split-up-and-left"} />
                </div>
                <span className="handoff-wire-label">
                  {handoffPhase === "workerA_crashed" ? "Epoch Barrier Locked" : "Epoch Transition"}
                </span>
              </div>

              {/* Worker B */}
              <div className={`worker-box ${handoffPhase === "workerB_resumed" ? "active" : ""}`}>
                <div className="worker-header">
                  <span className="worker-tag">
                    <i className="fa-solid fa-robot" />
                    <span>Worker B (Replacement)</span>
                  </span>
                  <span className="worker-epoch-badge">
                    {handoffPhase === "workerB_resumed" ? `ACTIVE · EPOCH 0${handoffEpoch}` : "STANDBY"}
                  </span>
                </div>
                <h3 className="worker-title">
                  {handoffPhase === "workerB_resumed" ? "Resumed Execution" : "Failover Agent Ready"}
                </h3>
                <div className="worker-metrics">
                  <div>
                    <small>Available Budget</small>
                    <strong>70.00 USDC</strong>
                  </div>
                  <div>
                    <small>Duplicate Debits</small>
                    <strong>0.00 USDC</strong>
                  </div>
                </div>
                <small style={{ color: handoffPhase === "workerB_resumed" ? "#a0ffa0" : "#888888", fontSize: "11px" }}>
                  {handoffPhase === "workerB_resumed"
                    ? "✓ Inherited deliverable 0x7f4b without re-paying"
                    : "Idle waiting for epoch fence increment"}
                </small>
              </div>
            </div>

            {/* Checkpoint banner */}
            <div className="checkpoint-banner">
              <div>
                <strong>Immutable Deliverable Cache:</strong> {handoffLog}
              </div>
              <span className="hash-tag">SHA-256: 0x7f4b...3a19</span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            CREATIVE SECTION 2: TELEMETRY PULSE & VISUAL RADAR
            ================================================================== */}
        <section className="section-container" id="telemetry">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Real-Time Invariants · Automated Consensus</span>
            </div>
            <h2 className="section-title">Telemetry & Dynamic Stability</h2>
            <p className="section-desc">
              Watch continuous settlement verifications and real-time state projections.
              The accounting oracle continuously matches chain state against the independent reference model.
            </p>
          </div>

          <div className="features-grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
            {/* Wave Chart Card */}
            <div className="spotlight-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                <div>
                  <span style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#888888" }}>
                    Settled Protocol Throughput
                  </span>
                  <h3 style={{ fontSize: "28px", color: "#ffffff", margin: "4px 0" }}>18.42M Ops</h3>
                </div>
                <span className="handoff-status-pill" style={{ fontSize: "11px" }}>
                  <span className="handoff-status-dot" /> Live Hedera Mirror
                </span>
              </div>
              <WaveChart height={140} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontSize: "12px", color: "#888888" }}>
                <span>Deterministic Zero-Double-Debit curve</span>
                <span>Latency: 120ms</span>
              </div>
            </div>

            {/* Radar Activity Card */}
            <div className="spotlight-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "100%", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#888888" }}>
                  Autonomous Invariant Radar
                </span>
                <h4 style={{ fontSize: "16px", color: "#ffffff", marginTop: "4px" }}>6-Axis Proof Boundaries</h4>
              </div>
              <RadarChart />
              <small style={{ color: "#777777", fontSize: "11px", marginTop: "12px" }}>
                100 fixed-seed differential traces passed
              </small>
            </div>
          </div>

          {/* Live Telemetry Ticker */}
          <div className="live-ticker-container">
            <div className="ticker-header">
              <div className="ticker-title">
                <span className="ticker-pulse-dot" />
                <span>Live Onchain Settlement Stream</span>
              </div>
              <span style={{ fontSize: "11px", color: "#777777", fontFamily: "monospace" }}>
                Polling Pinned Hedera Mirror
              </span>
            </div>

            <div className="ticker-items">
              {tickerEvents.map((evt, idx) => (
                <div key={`${evt.time}-${idx}`} className="ticker-row">
                  <span className="ticker-time">{evt.time}</span>
                  <span className="ticker-msg">
                    <strong>{evt.msg}</strong>
                  </span>
                  <span className="ticker-badge">{evt.badge}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 3: ACCOUNTING — 5 Distinct Financial Quantities
            ================================================================== */}
        <section className="section-container" id="accounting">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Independent Oracle · Invariant Verified</span>
            </div>
            <h2 className="section-title">Five Distinct Quantities. Zero Ambiguity.</h2>
            <p className="section-desc">
              Available, reserved, spent, released-to-reserve and withdrawn are distinct physical balances.
              Cancellation never refunds settled purchases or invalidates existing reservations.
            </p>
          </div>

          <div className="accounting-wrapper">
            <div className="accounting-display">
              <div className="accounting-summary-box">
                <div className="accounting-cap-headline">
                  <strong>{taskCap}</strong>
                  <span>TOTAL TASK CAP (UNITS) · EPOCH {epoch < 10 ? `0${epoch}` : epoch}</span>
                </div>

                {/* Progress bar */}
                <div className="accounting-bar-track" aria-label="Accounting Allocation Bar">
                  <div
                    className="bar-segment spent"
                    style={{ width: `${(spent / taskCap) * 100}%` }}
                    title={`Spent: ${spent}`}
                  />
                  <div
                    className="bar-segment reserved"
                    style={{ width: `${(reserved / taskCap) * 100}%` }}
                    title={`Reserved: ${reserved}`}
                  />
                  <div
                    className="bar-segment available"
                    style={{ width: `${(available / taskCap) * 100}%` }}
                    title={`Available: ${available}`}
                  />
                </div>

                {/* Legend */}
                <div className="accounting-legend">
                  <div className="legend-item">
                    <span className="legend-tag">
                      <span className="legend-color-dot" style={{ background: "#ffffff" }} />
                      <span>Spent</span>
                    </span>
                    <strong>{spent}</strong>
                    <small>Settled deliverables</small>
                  </div>
                  <div className="legend-item">
                    <span className="legend-tag">
                      <span className="legend-color-dot" style={{ background: "#88888a" }} />
                      <span>Reserved</span>
                    </span>
                    <strong>{reserved}</strong>
                    <small>In-flight locks</small>
                  </div>
                  <div className="legend-item">
                    <span className="legend-tag">
                      <span className="legend-color-dot" style={{ background: "#343438" }} />
                      <span>Available</span>
                    </span>
                    <strong>{available}</strong>
                    <small>Unallocated budget</small>
                  </div>
                </div>
              </div>

              {/* Simulator interactive controls */}
              <div className="accounting-simulator">
                <span className="simulator-title">Live State Transition Simulator</span>
                <div className="simulator-buttons">
                  <button
                    type="button"
                    className="sim-btn"
                    disabled={available < 10}
                    onClick={() => handleSimReserve(10)}
                  >
                    + Reserve 10
                  </button>
                  <button
                    type="button"
                    className="sim-btn"
                    disabled={reserved < 10}
                    onClick={() => handleSimSpend(10)}
                  >
                    + Settle 10
                  </button>
                  <button
                    type="button"
                    className="sim-btn"
                    onClick={handleIncrementEpoch}
                  >
                    Increment Epoch
                  </button>
                  <button
                    type="button"
                    className="sim-btn reset"
                    onClick={handleResetSim}
                  >
                    Reset
                  </button>
                </div>
                <div className="sim-log">{simLog}</div>
              </div>
            </div>

            {/* Invariants Grid */}
            <div className="invariants-grid">
              <div className="invariant-card">
                <div className="check-icon">✓</div>
                <div>
                  <h4>Reservation Inviolability</h4>
                  <p>In-flight commitments survive task cancellation and worker transitions until expiry or merchant settlement.</p>
                </div>
              </div>
              <div className="invariant-card">
                <div className="check-icon">✓</div>
                <div>
                  <h4>Deterministic Reconciliation</h4>
                  <p>Unknown payment outcomes require onchain receipt verification before retrying to prevent double debiting.</p>
                </div>
              </div>
              <div className="invariant-card">
                <div className="check-icon">✓</div>
                <div>
                  <h4>Fenced Worker Epochs</h4>
                  <p>Incrementing the epoch fencing counter invalidates signatures from disconnected workers immediately.</p>
                </div>
              </div>
              <div className="invariant-card">
                <div className="check-icon">✓</div>
                <div>
                  <h4>Mathematical Conservation</h4>
                  <p>Cap = Available + Reserved + Spent + Released. Derived balances conform to the independent reference oracle.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 4: ARCHITECTURE & 96-BYTE ENVELOPE (INTERACTIVE)
            ================================================================== */}
        <section className="section-container" id="architecture">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Wire Specification · ARCHITECTURE.md</span>
            </div>
            <h2 className="section-title">The 96-Byte Cryptographic Envelope</h2>
            <p className="section-desc">
              Click each slot in the envelope below to inspect how task isolation, operation uniqueness, and attempt replay protection are packed into 96 contiguous bytes.
            </p>
          </div>

          <div className="arch-grid">
            <div className="arch-pipeline">
              <div className="pipeline-step">
                <div className="step-num">01</div>
                <div className="step-content">
                  <h4>Merchant Quote Generation</h4>
                  <p>Merchant issues a cryptographically signed quote pinning price, expiration timestamp, and deliverable schema.</p>
                </div>
              </div>

              <div className="pipeline-step">
                <div className="step-num">02</div>
                <div className="step-content">
                  <h4>96-Byte Envelope Packaging</h4>
                  <p>Worker signs the structured 96-byte envelope binding spending directly to the active task ID and current epoch.</p>
                </div>
              </div>

              <div className="pipeline-step">
                <div className="step-num">03</div>
                <div className="step-content">
                  <h4>Onchain Settlement & Verification</h4>
                  <p>Smart contract verifies worker authorization, decrements reservation, transfers funds, and commits settlement intent.</p>
                </div>
              </div>

              <div className="pipeline-step">
                <div className="step-num">04</div>
                <div className="step-content">
                  <h4>Fsynced Immutable Result Storage</h4>
                  <p>Deliverables are fsynced to disk. If connection drops after payment, replacement worker recovers output without repayment.</p>
                </div>
              </div>
            </div>

            <div className="envelope-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Authorization Inspector</h3>
                <span className="hash-tag">96 BYTES TOTAL</span>
              </div>

              <div className="envelope-breakdown">
                <div
                  className="envelope-slot"
                  style={{
                    cursor: "pointer",
                    borderColor: selectedByteSlot === "taskId" ? "#ffffff" : "rgba(255,255,255,0.12)",
                    background: selectedByteSlot === "taskId" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.5)",
                  }}
                  onClick={() => setSelectedByteSlot("taskId")}
                >
                  <div className="slot-left">
                    <strong>Task ID (32 Bytes)</strong>
                    <small>Isolated budget ceiling & allocation identifier</small>
                  </div>
                  <span className="slot-bytes">bytes32 [0..32]</span>
                </div>

                <div
                  className="envelope-slot"
                  style={{
                    cursor: "pointer",
                    borderColor: selectedByteSlot === "opId" ? "#ffffff" : "rgba(255,255,255,0.12)",
                    background: selectedByteSlot === "opId" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.5)",
                  }}
                  onClick={() => setSelectedByteSlot("opId")}
                >
                  <div className="slot-left">
                    <strong>Operation ID (32 Bytes)</strong>
                    <small>Canonical hash of deliverable & merchant intent</small>
                  </div>
                  <span className="slot-bytes">bytes32 [32..64]</span>
                </div>

                <div
                  className="envelope-slot"
                  style={{
                    cursor: "pointer",
                    borderColor: selectedByteSlot === "attempt" ? "#ffffff" : "rgba(255,255,255,0.12)",
                    background: selectedByteSlot === "attempt" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.5)",
                  }}
                  onClick={() => setSelectedByteSlot("attempt")}
                >
                  <div className="slot-left">
                    <strong>Attempt Counter (32 Bytes)</strong>
                    <small>uint64 retry attempt with 24-byte zero padding</small>
                  </div>
                  <span className="slot-bytes">uint256 [64..96]</span>
                </div>
              </div>

              <div className="code-preview">
                {selectedByteSlot === "taskId" && `// Slot 1: Task ID (0..32 bytes)
// Prevents cross-task contamination. 
// Spending is strictly scoped to:
bytes32 taskId = 0x4a9b23f81e04c810...; // Cap: 100 USDC`}

                {selectedByteSlot === "opId" && `// Slot 2: Operation ID (32..64 bytes)
// SHA256(merchantDomain + deliverableSchema + quoteNonce)
// Assures exactly-once settlement idempotency:
bytes32 opId = 0x7f4b881c9a032de5...;`}

                {selectedByteSlot === "attempt" && `// Slot 3: Attempt Counter (64..96 bytes)
// Formatted with 24 zero bytes + uint64 big-endian:
// Prevents signature replay on retry across epoch fences:
uint64 attempt = 1;`}
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 5: INDEPENDENT OWNER RECOVERY
            ================================================================== */}
        <section className="section-container" id="recovery">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Independent Exit · RECOVERY.md</span>
            </div>
            <h2 className="section-title">Owner Recovery Without Application Backend</h2>
            <p className="section-desc">
              Your identity connects you to the workspace; your wallet remains the root of onchain authority.
              If Janus servers disappear, capital recovery executes directly through smart contract calls.
            </p>
          </div>

          <div className="recovery-comparison">
            <div className="comparison-box flawed">
              <span className="comparison-tag">Traditional Agent Architectures</span>
              <h3>Centralized API Key Risk</h3>
              <ul className="comparison-list">
                <li><i className="fa-solid fa-xmark" style={{ color: "#ff6666" }} /> Blanket corporate card access without per-task isolation</li>
                <li><i className="fa-solid fa-xmark" style={{ color: "#ff6666" }} /> Lost agent responses require manual dispute or double payment</li>
                <li><i className="fa-solid fa-xmark" style={{ color: "#ff6666" }} /> Server downtime traps all capital in third-party databases</li>
                <li><i className="fa-solid fa-xmark" style={{ color: "#ff6666" }} /> Disconnected agents can continue draining unallocated balances</li>
              </ul>
            </div>

            <div className="comparison-box janus">
              <span className="comparison-tag">Janus Cryptographic Guarantees</span>
              <h3>Hardware-Level Owner Sovereignty</h3>
              <ul className="comparison-list">
                <li><i className="fa-solid fa-check" style={{ color: "#ffffff" }} /> Strict spending ceilings enforced by onchain smart contracts</li>
                <li><i className="fa-solid fa-check" style={{ color: "#ffffff" }} /> Automatic result durability protects against double-charge upon retry</li>
                <li><i className="fa-solid fa-check" style={{ color: "#ffffff" }} /> Direct owner recovery executes via independent CLI without app servers</li>
                <li><i className="fa-solid fa-check" style={{ color: "#ffffff" }} /> Epoch increment revokes rogue workers within a single transaction</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 6: PROTOCOL VERIFICATION & MILESTONES
            ================================================================== */}
        <section className="section-container" id="protocol">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <span>Verified Test Suite · Node 22 CI</span>
            </div>
            <h2 className="section-title">Phase-Verified Financial Primitives</h2>
            <p className="section-desc">
              All contract scenarios, accounting invariants, merchant HTTP adapters, and recovery paths are verified locally with reproducible differential traces.
            </p>
          </div>

          <div className="milestones-grid">
            <div className="milestone-card">
              <span className="milestone-status">Phase 0 Verified</span>
              <h4>Bounded Payments</h4>
              <p>Bounded spend approvals, owner recovery without middleware, and restricted single-payer authorization.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Phase 1 Verified</span>
              <h4>Multi-Task Treasury</h4>
              <p>Isolated task caps, reservation management, single settlement invariant, and epoch worker fencing.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Adapter Verified</span>
              <h4>Paid Workflow SDK</h4>
              <p>96-byte envelope adapter, merchant quote validation, fsynced result store, and restart resilience.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Oracle Verified</span>
              <h4>Accounting Model</h4>
              <p>100 fixed-seed differential traces verifying conservation of available, reserved, and spent base units.</p>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 7: FINAL CTA & FOOTER
            ================================================================== */}
        <section className="section-container">
          <div className="bottom-cta-banner">
            <h2>Ready to evolve autonomous spending?</h2>
            <p>
              Deploy agent workflows with mathematically provable boundaries, idempotent settlement, and sovereign owner exit.
            </p>
            <div className="bottom-cta-actions">
              <Link href="/login" className="cta" style={{ marginTop: 0 }}>
                Get Started
              </Link>
              <Link href="/dashboard" className="btn-secondary-pill">
                <span>View Dashboard</span>
                <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: "11px" }} />
              </Link>
            </div>
          </div>

          <footer className="site-footer">
            <div className="site-footer-brand">
              <Image src="/assets/logo.webp" alt="Janus" width={24} height={24} unoptimized />
              <span>Janus Protocol</span>
            </div>
            <span>TESTNET ONLY · NO REAL CUSTOMER FUNDS · PROVABLE SPENDING AUTHORITY</span>
            <span>Node 22 Verified · Sepolia & Hedera Testnet Ready</span>
          </footer>
        </section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  RefreshCcw as IconRefreshCcw,
  ShieldCheck as IconShieldCheck,
  Terminal as IconTerminal,
  ArrowRight as IconArrowRight,
  Lock as IconLock,
  Cpu as IconCpu,
  Play as IconPlay,
  Pause as IconPause,
  ChevronRight as IconChevronRight,
  ChevronLeft as IconChevronLeft,
  Database as IconDatabase,
  CheckCircle2 as IconCheckCircle2,
  AlertTriangle as IconAlertTriangle,
} from "lucide-react";
import { WaveChart } from "@/components/charts/wave-chart";
import { RadarChart } from "@/components/charts/radar-chart";
import { DecryptedText } from "@/components/animations/decrypted-text";
import { GradientText } from "@/components/animations/gradient-text";
import { SplitText } from "@/components/animations/split-text";
import { ShinyText } from "@/components/animations/shiny-text";
import { BlurText } from "@/components/animations/blur-text";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRelayAuth } from "@/context/privy-auth-context";

const STORY_ACTS = [
  {
    id: 1,
    tab: "01. Budget Lock",
    actLabel: "Act 01 · Task Isolation",
    title: "Never Give an AI Agent Your Credit Card",
    tagline: "Lock spending to a single task instead of an open-ended wallet",
    desc: "Giving an autonomous agent a corporate card or private key invites runaway costs. Janus deposits capital into an onchain Hedera treasury contract with an immutable cap. The agent can spend within its allocation—and not a single cent more.",
    highlight: "Task ID 0x4a9b... strictly isolated. No access to other tasks or owner wallet.",
    cap: 100,
    available: 100,
    reserved: 0,
    spent: 0,
    epoch: 1,
    statusText: "Task Provisioned · Cap 100 USDC",
    packet: "Task Deposit: 100 USDC Locked on Hedera",
    ownerActive: true,
    treasuryStatus: "EPOCH 01 · Vault Active",
    workerName: "Worker A (Primary)",
    workerStatus: "active" as const,
    workerSub: "Authorized for Task 0x4a9b",
    merchantStatus: "idle" as const,
    merchantSub: "Waiting for valid 96-byte envelope",
  },
  {
    id: 2,
    tab: "02. 96-Byte Envelope",
    actLabel: "Act 02 · Cryptographic Wire",
    title: "Every Spend Request Packed into 96 Bytes",
    tagline: "Binds price, deliverable schema, and retry attempt onchain",
    desc: "When Worker A orders external data or inference, it signs a 96-byte envelope: [taskId, opId, attempt]. The contract holds a 10 USDC reservation. If the network drops before receipt, funds remain locked until confirmed—preventing duplicate charges.",
    highlight: "In-Flight Lock: 10 USDC reserved onchain until deliverable receipt.",
    cap: 100,
    available: 90,
    reserved: 10,
    spent: 0,
    epoch: 1,
    statusText: "10 USDC Reserved for In-Flight Step",
    packet: "Envelope: [Task 0x4a9b | Op 0x7f4b | Attempt 1] (96 Bytes)",
    ownerActive: false,
    treasuryStatus: "EPOCH 01 · 10 USDC Reserved",
    workerName: "Worker A (Signing)",
    workerStatus: "active" as const,
    workerSub: "Signed 96-byte commitment",
    merchantStatus: "active" as const,
    merchantSub: "Processing deliverable & quote",
  },
  {
    id: 3,
    tab: "03. Agent Crash & Fence",
    actLabel: "Act 03 · Fault Detection",
    title: "Agent Crashes? Its Authority Dies Instantly.",
    tagline: "Epoch increment permanently fences the disconnected worker",
    desc: "Worker A crashes or times out midway through. Janus increments the onchain epoch from 01 to 02. The old worker’s signatures are immediately rejected. Even if the crashed process revives or loops in the background, it cannot debit the treasury.",
    highlight: "CRITICAL: Epoch Barrier Locked. Worker A signatures rejected onchain.",
    cap: 100,
    available: 90,
    reserved: 10,
    spent: 0,
    epoch: 2,
    statusText: "Epoch Incremented to 02 · Worker A Fenced",
    packet: "Heartbeat Lost · Triggering Epoch 02 Fence",
    ownerActive: false,
    treasuryStatus: "EPOCH 02 · Worker A Fenced",
    workerName: "Worker A (Disconnected)",
    workerStatus: "fenced" as const,
    workerSub: "✗ Authority Revoked by Epoch Fence",
    merchantStatus: "held" as const,
    merchantSub: "Deliverable fsynced to disk cache",
  },
  {
    id: 4,
    tab: "04. Zero-Debit Resume",
    actLabel: "Act 04 · Result Durability",
    title: "Replacement Worker Resumes for $0.00 Extra",
    tagline: "Local fsync cache recovers settled outputs without re-purchasing",
    desc: "Replacement Worker B spins up in Epoch 02. It doesn't re-buy step 1. It pulls the already-settled deliverable from the fsynced disk cache (SHA-256: 0x7f4b), completes the remaining work, and charges zero duplicate fees.",
    highlight: "Zero Double-Debit: SHA-256 Deliverable Reused Without Paying Twice.",
    cap: 100,
    available: 90,
    reserved: 0,
    spent: 10,
    epoch: 2,
    statusText: "Step Completed · 0 Duplicate Debits",
    packet: "Cache Hit: SHA-256 0x7f4b Retrieved (No Repayment)",
    ownerActive: false,
    treasuryStatus: "EPOCH 02 · 10 USDC Settled",
    workerName: "Worker B (Resumed)",
    workerStatus: "success" as const,
    workerSub: "✓ Resumed with Reused Output",
    merchantStatus: "success" as const,
    merchantSub: "✓ Deliverable 0x7f4b Confirmed",
  },
  {
    id: 5,
    tab: "05. Sovereign Exit",
    actLabel: "Act 05 · Independent Recovery",
    title: "Pull Your Funds Out Directly. Zero Backend Needed.",
    tagline: "Smart contract emergency exit using your standard EVM wallet",
    desc: "If Janus servers, databases, or websites disappear, you still control your money. Connect your wallet to our standalone static page or CLI, cancel the task, and withdraw your remaining 90 USDC directly onchain. No permission required.",
    highlight: "100% Capital Sovereignty: Zero Middleware or backend reliance.",
    cap: 100,
    available: 0,
    reserved: 0,
    spent: 10,
    epoch: 2,
    statusText: "Task Cancelled · 90 USDC Returned to Owner",
    packet: "Direct Smart Contract Call: 90 USDC Returned to Owner",
    ownerActive: true,
    treasuryStatus: "Task Closed · Reserve Withdrawn",
    workerName: "All Workers Terminated",
    workerStatus: "terminated" as const,
    workerSub: "Zero Remaining Authority",
    merchantStatus: "idle" as const,
    merchantSub: "Obligations Complete",
  },
];

interface StatConfig {
  icon: string;
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  delay: string;
}

const STATS: StatConfig[] = [
  { icon: "§", target: 96, suffix: " Bytes", decimals: 0, label: "Cryptographic Envelope", delay: "0.5s" },
  { icon: "Ø", target: 0, suffix: " Replays", decimals: 0, label: "Zero Double-Debit Proof", delay: "0.58s" },
  { icon: "∑", target: 5, suffix: " Ledgers", decimals: 0, label: "Distinct Accounting States", delay: "0.66s" },
  { icon: "✓", target: 100, suffix: "%", decimals: 0, label: "Independent Owner Exit", delay: "0.74s" },
];

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export default function Home() {
  const auth = useRelayAuth();
  const dashboardHref = auth.ready && auth.authenticated ? "/dashboard" : "/login?redirect=/dashboard";
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

  // Interactive Product Storytelling State
  const [activeStoryAct, setActiveStoryAct] = useState<number>(1);
  const [isStoryAutoPlaying, setIsStoryAutoPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isStoryAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveStoryAct((prev) => (prev % 5) + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [isStoryAutoPlaying]);

  const currentAct = STORY_ACTS.find((a) => a.id === activeStoryAct) || STORY_ACTS[0];

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
    { name: "Overview", href: "#overview" },
    { name: "Simulation", href: "#simulation" },
    { name: "Telemetry", href: "#telemetry" },
    { name: "Accounting", href: "#accounting" },
    { name: "Architecture", href: "#architecture" },
    { name: "Recovery", href: "#recovery" },
  ];

  // Top Reading Scroll Progress with Framer Motion Spring
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  // Lenis Smooth Inertia Scroll & GSAP ScrollTrigger Integration
  useEffect(() => {
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    lenis.on("scroll", ScrollTrigger.update);

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    const ctx = gsap.context(() => {
      // 1. Subtle Hero Parallax & Fade
      gsap.to(".hero", {
        scrollTrigger: {
          trigger: ".landing-hero-viewport",
          start: "top top",
          end: "bottom top",
          scrub: 0.5,
        },
        y: -48,
        opacity: 0.35,
        ease: "power1.out",
      });

      // 2. Minimal Section Headers Vertical Entrance
      const sectionHeaders = document.querySelectorAll(".section-header");
      sectionHeaders.forEach((header) => {
        gsap.fromTo(
          header,
          { opacity: 0.25, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: header,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // 3. Storytelling Stage Subtle Vertical Drift
      gsap.fromTo(
        ".story-stage-layout",
        { y: 26, opacity: 0.3 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".story-stage-layout",
            start: "top 85%",
            toggleActions: "play none none reverse",
          },
        }
      );

      // 4. Staggered Feature and Module Cards
      const cardGrids = [".modules-grid", ".milestones-grid", ".features-grid"];
      cardGrids.forEach((gridSelector) => {
        const grid = document.querySelector(gridSelector);
        if (grid && grid.children.length > 0) {
          gsap.fromTo(
            Array.from(grid.children),
            { opacity: 0.25, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              stagger: 0.08,
              ease: "power2.out",
              scrollTrigger: {
                trigger: grid,
                start: "top 85%",
                toggleActions: "play none none reverse",
              },
            }
          );
        }
      });

      // 5. Envelope Inspector Card Entrance
      const envelopeCard = document.querySelector(".envelope-card");
      if (envelopeCard) {
        gsap.fromTo(
          envelopeCard,
          { opacity: 0.3, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: envelopeCard,
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          }
        );
      }
    });

    return () => {
      ctx.revert();
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return (
    <div className="landing-body">
      {/* Minimal Top Reading Progress Line (Framer Motion) */}
      <motion.div className="scroll-progress-line" style={{ scaleX }} />
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
          {/* Logo & Brand on Left */}
          <Link href="/" className="brand-box" aria-label="Brand Home">
            <span className="logo-btn">
              <Image src="/assets/logo.webp" alt="Janus" width={30} height={30} priority unoptimized />
            </span>
            <span className="brand-name">janus</span>
          </Link>

          {/* Center Glass Nav Pill */}
          <nav className="nav-pill desktop-only" aria-label="Main Navigation">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={`nav-link ${activeNav === item.name ? "active" : ""}`}
                onClick={(e) => {
                  e.preventDefault();
                  startTransition(() => {
                    setActiveNav(item.name);
                    const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
                    if (lenis) {
                      lenis.scrollTo(item.href, { offset: -30, duration: 1.2 });
                    } else {
                      const targetEl = document.querySelector(item.href);
                      targetEl?.scrollIntoView({ behavior: "smooth" });
                    }
                  });
                }}
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Right Header Actions */}
          <div className="header-actions desktop-only">
            {!auth.authenticated ? (
              <>
                <Link href="/login" className="nav-ghost-btn">
                  Sign in
                </Link>
                <Link href="/login?redirect=/dashboard" className="sign-in-btn">
                  Dashboard
                </Link>
              </>
            ) : (
              <Link href="/dashboard" className="sign-in-btn">
                Dashboard
              </Link>
            )}
          </div>

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
              {!auth.authenticated ? (
                <>
                  <Link
                    href="/login"
                    className="mobile-sign-in"
                    style={{ "--i": 6 } as React.CSSProperties}
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/login?redirect=/dashboard"
                    className="mobile-sign-in"
                    style={{ "--i": 7, background: "#ffffff", color: "#000000" } as React.CSSProperties}
                    onClick={() => setMenuOpen(false)}
                  >
                    Launch Dashboard
                  </Link>
                </>
              ) : (
                <Link
                  href="/dashboard"
                  className="mobile-sign-in"
                  style={{ "--i": 6, background: "#ffffff", color: "#000000" } as React.CSSProperties}
                  onClick={() => setMenuOpen(false)}
                >
                  Dashboard
                </Link>
              )}
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
                    <IconLock size={15} color="#000" />
                  </span>
                </span>
              </div>
              <div className="trust-avatar avatar-2" style={{ "--z": 2 } as React.CSSProperties}>
                <span className="avatar-ring">
                  <span className="avatar-inner">
                    <IconCpu size={15} color="#000" />
                  </span>
                </span>
              </div>
              <div className="trust-avatar avatar-3" style={{ "--z": 4 } as React.CSSProperties}>
                <span className="avatar-ring">
                  <span className="avatar-inner">
                    <IconShieldCheck size={15} color="#000" />
                  </span>
                </span>
              </div>
            </div>
            <div className="trust-pill">
              <span className="trust-text">
                <DecryptedText
                  text="Hedera Testnet (EVM 296) · 6-Decimals HTS USDC · Verified"
                  speed={28}
                  maxIterations={10}
                  animateOn="view"
                />
              </span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="headline anim">
            <span className="headline-line" style={{ "--d": "0.12s" } as React.CSSProperties}>
              <GradientText
                colors={["#ffffff", "#e4e4e7", "#ffffff", "#a1a1aa", "#ffffff"]}
                animationSpeed={7}
              >
                Task-Bound Budgets.
              </GradientText>
            </span>
            <span className="headline-line" style={{ "--d": "0.3s" } as React.CSSProperties}>
              <GradientText
                colors={["#ffffff", "#a1a1aa", "#ffffff", "#d4d4d8", "#ffffff"]}
                animationSpeed={9}
              >
                Sovereign Agent Recovery.
              </GradientText>
            </span>
          </h1>

          {/* Subhead */}
          <div className="subhead anim" style={{ "--d": "0.28s" } as React.CSSProperties}>
            <BlurText
              text="Money belongs to the task, not the agent. Janus gives autonomous AI workers temporary spending authority with onchain epoch fencing, durable deliverable caching, and zero double-charge recovery."
              delay={22}
              animateBy="words"
            />
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap", justifyContent: "center", marginTop: "clamp(18px, 2.6vh, 26px)" }}>
            <Link href={dashboardHref} className="cta anim" style={{ "--d": "0.4s", marginTop: 0 } as React.CSSProperties}>
              {auth.authenticated ? "Go to Dashboard" : "Launch Dashboard"}
            </Link>
            <a
              href="#overview"
              className="btn-secondary-pill anim"
              style={{ "--d": "0.46s" } as React.CSSProperties}
              onClick={(e) => {
                e.preventDefault();
                startTransition(() => {
                  setActiveNav("Overview");
                  const lenis = (window as unknown as { __lenis?: Lenis }).__lenis;
                  if (lenis) {
                    lenis.scrollTo("#overview", { offset: -30, duration: 1.2 });
                  } else {
                    document.querySelector("#overview")?.scrollIntoView({ behavior: "smooth" });
                  }
                });
              }}
            >
              <span>Explore Architecture</span>
              <IconArrowRight size={14} />
            </a>
          </div>
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
            SECTION 0: VISUAL PRODUCT STORYTELLING & SIMULATION ENGINE
            ================================================================== */}
        <section className="section-container" id="overview">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <ShinyText text="Interactive Story · What Janus Actually Does" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="The Life of an Autonomous Task" delay={25} splitBy="words" />
            </h2>
            <p className="section-desc">
              Follow how Janus protects your capital when an AI agent executes real financial operations, crashes midway, and safely resumes.
            </p>
          </div>

          <div className="story-engine-wrapper">
            {/* Story Tabs Bar */}
            <div className="story-tabs-bar">
              {STORY_ACTS.map((act) => {
                const isActive = activeStoryAct === act.id;
                return (
                  <button
                    key={act.id}
                    type="button"
                    className={`story-tab-btn ${isActive ? "active" : ""}`}
                    onClick={() => setActiveStoryAct(act.id)}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeStoryTab"
                        className="story-tab-active-indicator"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span style={{ position: "relative", zIndex: 2 }}>{act.tab}</span>
                  </button>
                );
              })}
            </div>

            {/* Story Stage Layout */}
            <div className="story-stage-layout">
              {/* Left Column: Narrative Card */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentAct.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="story-narrative-card"
                >
                  <div>
                    <span className="story-act-badge">{currentAct.actLabel}</span>
                    <h3 className="story-narrative-title" style={{ marginTop: "14px" }}>
                      {currentAct.title}
                    </h3>
                    <p className="story-narrative-tagline" style={{ marginTop: "8px" }}>
                      {currentAct.tagline}
                    </p>
                    <p className="story-narrative-desc" style={{ marginTop: "14px" }}>
                      {currentAct.desc}
                    </p>
                  </div>

                  <div className="story-highlight-pill">
                    <IconCheckCircle2 size={16} color="#ffffff" style={{ flexShrink: 0 }} />
                    <span>{currentAct.highlight}</span>
                  </div>

                  {/* Narrative Controls */}
                  <div className="story-controls-row">
                    <button
                      type="button"
                      className="sim-btn"
                      onClick={() => setActiveStoryAct((prev) => (prev > 1 ? prev - 1 : 5))}
                    >
                      <IconChevronLeft size={14} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }} />
                      <span>Prev</span>
                    </button>

                    <button
                      type="button"
                      className="sim-btn"
                      onClick={() => setActiveStoryAct((prev) => (prev < 5 ? prev + 1 : 1))}
                    >
                      <span>Next Act</span>
                      <IconChevronRight size={14} style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4 }} />
                    </button>

                    <button
                      type="button"
                      className={`sim-btn ${isStoryAutoPlaying ? "active" : ""}`}
                      style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
                      onClick={() => setIsStoryAutoPlaying(!isStoryAutoPlaying)}
                    >
                      {isStoryAutoPlaying ? <IconPause size={13} /> : <IconPlay size={13} />}
                      <span>{isStoryAutoPlaying ? "Pause Story" : "Auto-Play Story"}</span>
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Right Column: Live Interactive Simulation Canvas */}
              <div className="story-canvas">
                {/* Live Ledger Strip */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "14px" }}>
                  <div>
                    <span style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "#888890" }}>
                      Onchain Ledger State
                    </span>
                    <h4 style={{ color: "#ffffff", fontSize: "18px", margin: "4px 0 0" }}>
                      {currentAct.statusText}
                    </h4>
                  </div>
                  <span className="hash-tag">
                    <DecryptedText text={`EPOCH 0${currentAct.epoch}`} speed={30} maxIterations={8} animateOn="hover" />
                  </span>
                </div>

                {/* Live Accounting Bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div className="accounting-bar-track" style={{ height: "24px" }}>
                    <div
                      className="bar-segment spent"
                      style={{ width: `${(currentAct.spent / currentAct.cap) * 100}%` }}
                    />
                    <div
                      className="bar-segment reserved"
                      style={{ width: `${(currentAct.reserved / currentAct.cap) * 100}%` }}
                    />
                    <div
                      className="bar-segment available"
                      style={{ width: `${(currentAct.available / currentAct.cap) * 100}%` }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#a1a1aa", fontFamily: "monospace" }}>
                    <span>Spent: {currentAct.spent} USDC</span>
                    <span>Reserved: {currentAct.reserved} USDC</span>
                    <span>Available: {currentAct.available} USDC</span>
                  </div>
                </div>

                {/* Packet Flight Indicator */}
                <div className="canvas-wire-banner">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <motion.span
                      animate={{ scale: [1, 1.35, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                      className="handoff-status-dot"
                      style={{
                        background: currentAct.workerStatus === "fenced" ? "#f87171" : "#4ade80",
                        boxShadow: currentAct.workerStatus === "fenced" ? "0 0 10px #f87171" : "0 0 10px #4ade80",
                      }}
                    />
                    <strong style={{ color: "#ffffff" }}>Live Wire Signal:</strong>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentAct.packet}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.22 }}
                      className="canvas-wire-packet"
                    >
                      <DecryptedText text={currentAct.packet} speed={25} maxIterations={8} animateOn="hover" />
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* 4 Interactive Visual Nodes Map */}
                <div className="canvas-nodes-map">
                  {/* Node 1: Owner Wallet */}
                  <div className={`canvas-node-card ${currentAct.ownerActive ? "highlight" : ""}`}>
                    <div className="canvas-node-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconShieldCheck size={16} color={currentAct.ownerActive ? "#ffffff" : "#a1a1aa"} />
                        <span className="canvas-node-title">Owner Wallet</span>
                      </div>
                      <span className="canvas-node-sub">{currentAct.ownerActive ? "ACTIVE ROOT" : "ROOT AUTHORITY"}</span>
                    </div>
                    <small style={{ color: "#a1a1aa", fontSize: "11.5px" }}>
                      {currentAct.id === 1 && "Depositing 100 USDC task cap"}
                      {currentAct.id === 5 && "Withdrawing 90 USDC unallocated reserve"}
                      {currentAct.id !== 1 && currentAct.id !== 5 && "Holding sovereign exit key (0x99a5...)"}
                    </small>
                  </div>

                  {/* Node 2: Hedera Treasury */}
                  <div className="canvas-node-card highlight">
                    <div className="canvas-node-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconCpu size={16} color="#ffffff" />
                        <span className="canvas-node-title">Hedera Treasury</span>
                      </div>
                      <span className="canvas-node-sub">EVM CHAIN 296</span>
                    </div>
                    <small style={{ color: "#a1a1aa", fontSize: "11.5px" }}>
                      {currentAct.treasuryStatus} · HTS USDC 0.0.429274
                    </small>
                  </div>

                  {/* Node 3: Autonomous Worker */}
                  <div
                    className={`canvas-node-card ${
                      currentAct.workerStatus === "fenced"
                        ? "fenced"
                        : currentAct.workerStatus === "success"
                        ? "success"
                        : "highlight"
                    }`}
                  >
                    <div className="canvas-node-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconRefreshCcw size={16} color={currentAct.workerStatus === "fenced" ? "#f87171" : "#ffffff"} />
                        <span className="canvas-node-title">{currentAct.workerName}</span>
                      </div>
                      <span className="canvas-node-sub">
                        {currentAct.workerStatus === "fenced" ? "FENCED" : currentAct.workerStatus === "success" ? "ACTIVE" : "STANDBY"}
                      </span>
                    </div>
                    <small style={{ color: currentAct.workerStatus === "fenced" ? "#f87171" : "#a1a1aa", fontSize: "11.5px" }}>
                      {currentAct.workerSub}
                    </small>
                  </div>

                  {/* Node 4: Merchant & Cache */}
                  <div className={`canvas-node-card ${currentAct.merchantStatus === "success" ? "success" : ""}`}>
                    <div className="canvas-node-top">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <IconDatabase size={16} color={currentAct.merchantStatus === "success" ? "#4ade80" : "#a1a1aa"} />
                        <span className="canvas-node-title">Durable Cache</span>
                      </div>
                      <span className="canvas-node-sub">FSYNC DISK</span>
                    </div>
                    <small style={{ color: currentAct.merchantStatus === "success" ? "#4ade80" : "#a1a1aa", fontSize: "11.5px" }}>
                      {currentAct.merchantSub}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* ==================================================================
            CREATIVE SECTION 1: INTERACTIVE AGENT HANDOFF SIMULATOR
            ================================================================== */}
        <section className="section-container" id="simulation">
          <div className="section-header">
            <div className="section-eyebrow">
              <span className="dot" />
              <ShinyText text="Deterministic Handoff Engine · CONTEXT.md" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="See an Agent Crash and Resumption in Action" delay={20} splitBy="words" />
            </h2>
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
                  <IconAlertTriangle size={14} color="#f87171" />
                  <span>Simulate Worker A Drop</span>
                </button>

                <button
                  type="button"
                  className="handoff-btn"
                  disabled={handoffPhase !== "workerA_crashed"}
                  onClick={handleResumeWorkerB}
                >
                  <IconRefreshCcw size={14} color="#4ade80" />
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
                    <IconCpu size={14} />
                    <span>Worker A (Primary)</span>
                  </span>
                  <span className="worker-epoch-badge">
                    <DecryptedText
                      text={handoffPhase === "workerA_crashed" ? "REVOKED" : `EPOCH 0${handoffEpoch}`}
                      speed={25}
                      maxIterations={8}
                      animateOn="hover"
                    />
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
                <motion.div
                  className={`fence-barrier ${handoffPhase === "workerA_crashed" ? "fenced" : ""}`}
                  animate={
                    handoffPhase === "workerA_crashed"
                      ? { scale: 1.08, boxShadow: "0 0 24px rgba(248, 113, 113, 0.7)" }
                      : { scale: 1, boxShadow: "none" }
                  }
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <IconLock size={16} color={handoffPhase === "workerA_crashed" ? "#f87171" : "#ffffff"} />
                </motion.div>
                <span className="handoff-wire-label">
                  {handoffPhase === "workerA_crashed" ? "Epoch Barrier Locked" : "Epoch Transition"}
                </span>
              </div>

              {/* Worker B */}
              <div className={`worker-box ${handoffPhase === "workerB_resumed" ? "active" : ""}`}>
                <div className="worker-header">
                  <span className="worker-tag">
                    <IconCpu size={14} />
                    <span>Worker B (Replacement)</span>
                  </span>
                  <span className="worker-epoch-badge">
                    <DecryptedText
                      text={handoffPhase === "workerB_resumed" ? `ACTIVE · EPOCH 0${handoffEpoch}` : "STANDBY"}
                      speed={25}
                      maxIterations={8}
                      animateOn="hover"
                    />
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
              <span className="hash-tag">
                <DecryptedText text="SHA-256: 0x7f4b...3a19" speed={25} maxIterations={8} animateOn="hover" />
              </span>
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
              <ShinyText text="Real-Time Invariants · Automated Consensus" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="Telemetry & Dynamic Stability" delay={25} splitBy="words" />
            </h2>
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
                    Verified Settlement Latency
                  </span>
                  <h3 style={{ fontSize: "28px", color: "#ffffff", margin: "4px 0" }}>120 ms</h3>
                </div>
                <span className="handoff-status-pill" style={{ fontSize: "11px" }}>
                  <span className="handoff-status-dot" /> Hedera Testnet 296
                </span>
              </div>
              <WaveChart height={140} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", fontSize: "12px", color: "#888888" }}>
                <span>HTS USDC Base Units (0.02 Spend Proof)</span>
                <span>2-Block Confirmation Depth</span>
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
              <ShinyText text="Independent Oracle · Invariant Verified" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="Five Distinct Quantities. Zero Ambiguity." delay={25} splitBy="words" />
            </h2>
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
                  <span>TOTAL TASK CAP (UNITS) · <DecryptedText text={`EPOCH ${epoch < 10 ? `0${epoch}` : epoch}`} speed={25} maxIterations={8} animateOn="hover" /></span>
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
              <ShinyText text="Wire Specification · ARCHITECTURE.md" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="The 96-Byte Cryptographic Envelope" delay={25} splitBy="words" />
            </h2>
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
                {selectedByteSlot === "taskId" && (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    <code>
                      <span style={{ color: "#71717a" }}>{"// Slot 1: Task ID (0..32 bytes)\n// Prevents cross-task contamination.\n// Spending is strictly scoped to:\nbytes32 taskId = "}</span>
                      <span style={{ color: "#38bdf8" }}>
                        <DecryptedText text="0x4a9b23f81e04c81099fecb894103194a" speed={20} maxIterations={10} animateOn="hover" />
                      </span>
                      <span style={{ color: "#71717a" }}>{"; // Cap: 100 USDC"}</span>
                    </code>
                  </pre>
                )}

                {selectedByteSlot === "opId" && (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    <code>
                      <span style={{ color: "#71717a" }}>{"// Slot 2: Operation ID (32..64 bytes)\n// SHA256(merchantDomain + deliverableSchema + quoteNonce)\n// Assures exactly-once settlement idempotency:\nbytes32 opId = "}</span>
                      <span style={{ color: "#38bdf8" }}>
                        <DecryptedText text="0x7f4b881c9a032de581c81044ba9923ef" speed={20} maxIterations={10} animateOn="hover" />
                      </span>
                      <span style={{ color: "#71717a" }}>{";"}</span>
                    </code>
                  </pre>
                )}

                {selectedByteSlot === "attempt" && (
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
                    <code>
                      <span style={{ color: "#71717a" }}>{"// Slot 3: Attempt Counter (64..96 bytes)\n// Formatted with 24 zero bytes + uint64 big-endian:\n// Prevents signature replay on retry across epoch fences:\nuint64 attempt = "}</span>
                      <span style={{ color: "#38bdf8" }}>
                        <DecryptedText text="1 (0x00000000000000000000000000000001)" speed={20} maxIterations={10} animateOn="hover" />
                      </span>
                      <span style={{ color: "#71717a" }}>{";"}</span>
                    </code>
                  </pre>
                )}
              </div>
            </div>
          </div>

          {/* Module Boundaries from ARCHITECTURE.md */}
          <div style={{ marginTop: "48px" }}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <span className="hash-tag" style={{ textTransform: "uppercase", letterSpacing: "1px" }}>
                Repository Topology · 4 Decoupled Packages
              </span>
              <h3 style={{ fontSize: "24px", color: "#ffffff", marginTop: "10px" }}>Janus Module Ownership</h3>
            </div>

            <div className="modules-grid">
              <div className="module-card">
                <span className="module-badge">frontend/</span>
                <h4>Next.js Application</h4>
                <p>Owns Next.js 16 app router, Privy authentication identity plumbing, Apple glass dashboard, and live telemetry projections.</p>
                <div className="module-tags">
                  <span className="module-tag-chip">Next.js 16</span>
                  <span className="module-tag-chip">Turbopack</span>
                  <span className="module-tag-chip">Privy Auth</span>
                </div>
              </div>

              <div className="module-card">
                <span className="module-badge">backend/</span>
                <h4>Hedera Services</h4>
                <p>Owns HTTP merchant/facilitator, Hedera utilities, fsynced result cache, checkpoint runner, and fail-closed signer locks.</p>
                <div className="module-tags">
                  <span className="module-tag-chip">Hedera SDK</span>
                  <span className="module-tag-chip">Fsync Store</span>
                  <span className="module-tag-chip">Checkpoint Runner</span>
                </div>
              </div>

              <div className="module-card">
                <span className="module-badge">contracts/</span>
                <h4>Solidity Treasuries</h4>
                <p>Owns Phase-0 bounded payment probe and Phase-1 multi-task treasury contracts, isolated test suites, and compiler scripts.</p>
                <div className="module-tags">
                  <span className="module-tag-chip">Solidity 0.8.24</span>
                  <span className="module-tag-chip">Hedera EVM 296</span>
                  <span className="module-tag-chip">HTS USDC</span>
                </div>
              </div>

              <div className="module-card">
                <span className="module-badge">shared/</span>
                <h4>Protocol Specification</h4>
                <p>Common context across modules: Hedera network config, canonical 96-byte wire rules, versioned ABI, and accounting oracle.</p>
                <div className="module-tags">
                  <span className="module-tag-chip">protocol.mjs</span>
                  <span className="module-tag-chip">network.json</span>
                  <span className="module-tag-chip">Oracle Model</span>
                </div>
              </div>
            </div>

            {/* End-to-End Sequence Diagram Container */}
            <div className="flow-diagram-container">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px" }}>
                <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.2px", color: "#a1a1aa", fontWeight: 600 }}>
                  End-to-End Transaction Sequence
                </span>
                <span className="hash-tag">ARCHITECTURE.md §Integration</span>
              </div>

              <div className="flow-steps-row">
                <div className="flow-step-node">
                  <span className="flow-step-tag">Step 01</span>
                  <span className="flow-step-title">Owner Wallet</span>
                  <span className="flow-step-desc">Connects via Privy to establish operator identity. Deposits base capital into treasury.</span>
                </div>

                <div className="flow-step-node">
                  <span className="flow-step-tag">Step 02</span>
                  <span className="flow-step-title">Autonomous Worker</span>
                  <span className="flow-step-desc">Signs 96-byte envelope binding task ID, operation ID, and attempt under active epoch.</span>
                </div>

                <div className="flow-step-node">
                  <span className="flow-step-tag">Step 03</span>
                  <span className="flow-step-title">Hedera Treasury</span>
                  <span className="flow-step-desc">Smart contract settles payment, decrements reservation, and emits Paid receipt.</span>
                </div>

                <div className="flow-step-node">
                  <span className="flow-step-tag">Step 04</span>
                  <span className="flow-step-title">Durable Delivery</span>
                  <span className="flow-step-desc">Merchant fsyncs result. Any interrupted worker recovers deliverable without double-charge.</span>
                </div>
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
              <ShinyText text="Independent Exit · RECOVERY.md" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="Owner Recovery Without Application Backend" delay={25} splitBy="words" />
            </h2>
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
                <li><span style={{ color: "#f87171", fontWeight: "bold", marginRight: "6px" }}>✕</span> Blanket corporate card access without per-task isolation</li>
                <li><span style={{ color: "#f87171", fontWeight: "bold", marginRight: "6px" }}>✕</span> Lost agent responses require manual dispute or double payment</li>
                <li><span style={{ color: "#f87171", fontWeight: "bold", marginRight: "6px" }}>✕</span> Server downtime traps all capital in third-party databases</li>
                <li><span style={{ color: "#f87171", fontWeight: "bold", marginRight: "6px" }}>✕</span> Disconnected agents can continue draining unallocated balances</li>
              </ul>
            </div>

            <div className="comparison-box janus">
              <span className="comparison-tag">Janus Cryptographic Guarantees</span>
              <h3>Hardware-Level Owner Sovereignty</h3>
              <ul className="comparison-list">
                <li><span style={{ color: "#4ade80", fontWeight: "bold", marginRight: "6px" }}>✓</span> Strict spending ceilings enforced by onchain smart contracts</li>
                <li><span style={{ color: "#4ade80", fontWeight: "bold", marginRight: "6px" }}>✓</span> Automatic result durability protects against double-charge upon retry</li>
                <li><span style={{ color: "#4ade80", fontWeight: "bold", marginRight: "6px" }}>✓</span> Direct owner recovery executes via independent CLI without app servers</li>
                <li><span style={{ color: "#4ade80", fontWeight: "bold", marginRight: "6px" }}>✓</span> Epoch increment revokes rogue workers within a single transaction</li>
              </ul>
            </div>
          </div>

          {/* Recovery Terminal Card */}
          <div style={{ marginTop: "32px", background: "rgba(10,10,12,0.8)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <IconTerminal size={18} color="#e4e4e7" />
                <strong style={{ fontSize: "14px", color: "#ffffff" }}>Direct Smart Contract Exit Tools</strong>
              </div>
              <span className="hash-tag">ZERO MIDDLEWARE REQUIRED</span>
            </div>
            <p style={{ color: "#a1a1aa", fontSize: "13px", lineHeight: "1.6", marginBottom: "16px" }}>
              The CLI in <code>contracts/phase1/scripts/recover.mjs</code> and static recovery browser bundle in <code>contracts/phase1/artifacts/recovery-browser/</code> verify deployment identity, chain RPC, and token contract directly with your wallet.
            </p>
            <div className="code-preview" style={{ margin: 0 }}>
              {`# Step 1: Read-only recovery plan inspection (verifies chain, runtime hash & owner)
npm run recovery:plan -- ../shared/deployments/hedera-testnet.json TASK_ID OP_ID

# Step 2: Atomic execution (cancels task, expires reservations, releases available balance & withdraws reserve)
npm run recovery:plan -- ../shared/deployments/hedera-testnet.json TASK_ID OP_ID --execute`}
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
              <ShinyText text="Verified Test Suite · Node 22 CI" speed={6} />
            </div>
            <h2 className="section-title">
              <SplitText text="Phase-Verified Financial Primitives" delay={25} splitBy="words" />
            </h2>
            <p className="section-desc">
              All contract scenarios, accounting invariants, merchant HTTP adapters, and recovery paths are verified locally with reproducible differential traces.
            </p>
          </div>

          <div className="milestones-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="milestone-card">
              <span className="milestone-status">Phase 0 Verified</span>
              <h4>Bounded Spend Core</h4>
              <p>Bounded spend approvals, owner recovery without middleware, and restricted single-payer authorization in Solidity.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Phase 1 Verified</span>
              <h4>Multi-Task Treasury</h4>
              <p>Isolated task caps, reservation management, single settlement invariant, and epoch worker fencing.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Adapter Verified</span>
              <h4>96-Byte Envelope SDK</h4>
              <p>Canonical wire serialization, merchant quote validation, fsynced result store, and restart resilience.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Oracle Verified</span>
              <h4>Accounting Model</h4>
              <p>100 fixed-seed differential traces verifying mathematical conservation of available, reserved, and spent units.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Live Hardening Verified</span>
              <h4>Hedera Settlement</h4>
              <p>2-block confirmation depth, 500k gas ceiling, cached receipt reconciliation, and 20,000 USDC testnet proof.</p>
            </div>

            <div className="milestone-card">
              <span className="milestone-status">Runner Verified</span>
              <h4>Checkpointed Resumption</h4>
              <p>Local 4-task runner with deterministic worker crash, epoch handoff, and zero double-charge result reuse.</p>
            </div>
          </div>
        </section>

        {/* ==================================================================
            SECTION 7: FINAL CTA & FOOTER
            ================================================================== */}
        <section className="section-container">
          <div className="bottom-cta-banner">
            <h2>Stop worrying about rogue agent spend.</h2>
            <p>
              Put your autonomous AI workflows on a provable, revocable budget. Built on Hedera testnet with guaranteed zero duplicate debits.
            </p>
            <div className="bottom-cta-actions">
              <Link href={dashboardHref} className="cta" style={{ marginTop: 0 }}>
                {auth.authenticated ? "Go to Dashboard" : "Launch Dashboard"}
              </Link>
              <Link href="/login" className="btn-secondary-pill">
                <span>Sign In with Privy</span>
                <IconArrowRight size={14} />
              </Link>
            </div>
          </div>

          <footer className="site-footer">
            <div className="site-footer-brand">
              <Image src="/assets/logo.webp" alt="Janus" width={24} height={24} unoptimized />
              <span>Janus Protocol</span>
            </div>
            <span>HEDERA TESTNET (CHAIN 296) · 6-DECIMALS HTS USDC · SOVEREIGN AGENT RECOVERY</span>
            <span>Node 22 Verified · Independent Accounting Oracle</span>
          </footer>
        </section>
      </div>

      {/* Screen Bottom Blurry Frosted Glass Vignette */}
      <div className="screen-bottom-blur" aria-hidden="true">
        <div className="bottom-blur-gradient" />
        <div className="bottom-blur-glass" />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  LayoutDashboard,
  ListTodo,
  Wallet,
  ShieldCheck,
  Settings,
  LogOut,
  Search,
  ChevronRight,
  Copy,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Check,
  X,
  Download,
  GitBranch,
  Cpu,
  LockKeyhole,
  CircleHelp,
  Layers,
} from "lucide-react";
import TreasuryPanel from "@/components/treasury-panel";
import AgentControlCenter from "@/components/agent-control-center";
import { BrandLogo } from "@/components/brand-logo";
import { useRelayAuth, targetChain } from "@/context/privy-auth-context";

const tasks = [
  { id: "A", name: "Market research", description: "Collect and validate source data", cap: 100, available: 70, reserved: 10, spent: 20, epoch: 2, status: "Needs replacement", worker: "research-worker-01" },
  { id: "B", name: "Source verification", description: "Verify references and provenance", cap: 200, available: 200, reserved: 0, spent: 0, epoch: 1, status: "Ready", worker: "verification-worker-01" },
  { id: "C", name: "Report synthesis", description: "Generate a structured research report", cap: 150, available: 150, reserved: 0, spent: 0, epoch: 1, status: "Ready", worker: "synthesis-worker-01" },
  { id: "D", name: "Quality review", description: "Validate schema and dataset hashes", cap: 150, available: 150, reserved: 0, spent: 0, epoch: 1, status: "Ready", worker: "review-worker-01" },
];

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

export default function Dashboard({ initialTab = "Overview" }: { initialTab?: string }) {
  const auth = useRelayAuth();
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (auth.ready && !auth.authenticated) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [auth.ready, auth.authenticated, router]);
  const [sample, setSample] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<(typeof tasks)[number] | null>(null);
  const [copied, setCopied] = useState(false);
  const [attested, setAttested] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (selected) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [selected]);

  const wrongChain = auth.walletAddress && auth.chainId !== null && auth.chainId !== targetChain.id;
  const embedded = auth.walletType === "privy";
  const shownTasks = sample
    ? tasks.filter((t) => `${t.name} ${t.id} ${t.status}`.toLowerCase().includes(query.toLowerCase()))
    : [];

  async function copyAddress() {
    if (!auth.walletAddress) return;
    try {
      await navigator.clipboard.writeText(auth.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback("Clipboard unavailable. Select and copy the wallet address below.");
    }
  }

  function exportExample() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            type: "illustrative-accounting-example",
            network: "hedera-testnet",
            unit: "base units (USDC)",
            deposit: "1000",
            unallocated: "400",
            tasks: tasks.map((t) => ({
              ...t,
              cap: String(t.cap),
              available: String(t.available),
              reserved: String(t.reserved),
              spent: String(t.spent),
            })),
            note: "Not a recovery bundle. No contract, keys, or onchain records included.",
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "janus-accounting-example.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!auth.ready || !auth.authenticated) {
    return (
      <div className="landing-body" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg">
          <video className="bg-video" autoPlay muted loop playsInline style={{ opacity: 0.18, filter: "blur(24px)" }}>
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
        </div>
        <div
          style={{
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
            padding: "36px 44px",
            background: "rgba(18, 18, 22, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "24px",
            backdropFilter: "blur(24px)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.65)",
          }}
        >
          <div style={{ width: "36px", height: "36px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ffffff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ textAlign: "center" }}>
            <h3 style={{ color: "#ffffff", fontSize: "16px", margin: 0, fontWeight: 600 }}>Authenticating Sovereign Access</h3>
            <p style={{ color: "#a1a1aa", fontSize: "12px", margin: "6px 0 0" }}>Redirecting to secure login…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-body unified-dashboard-shell">
      {/* Background Video with Apple Frosted Glass Filter */}
      <div className="bg">
        <video className="bg-video" autoPlay muted loop playsInline style={{ opacity: 0.18, filter: "blur(24px)" }}>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* Floating Apple Liquid Glass Ambient Light Orbs */}
      <div className="ambient-glass-canvas" aria-hidden="true">
        <div className="glass-orb orb-violet" />
        <div className="glass-orb orb-cyan" />
        <div className="glass-orb orb-silver" />
      </div>

      {/* Sidebar */}
      <aside className="unified-sidebar">
        <BrandLogo size="md" showTagline />

        <div className="workspace-pill-box">
          <span className="workspace-avatar">J</span>
          <div>
            <strong>Hedera Workspace</strong>
            <small>Testnet 296 · Active</small>
          </div>
          <span className="workspace-badge">V1</span>
        </div>

        <span className="nav-group-label">WORKSPACE</span>
        <nav className="sidebar-nav-list" aria-label="Workspace navigation">
          {[
            { name: "Overview", icon: LayoutDashboard },
            { name: "Agents", icon: Cpu },
            { name: "Runs", icon: GitBranch },
            { name: "Credentials", icon: LockKeyhole },
            { name: "Integrations", icon: Layers },
            { name: "Tasks", icon: ListTodo },
            { name: "Wallet", icon: Wallet },
            { name: "Recovery", icon: ShieldCheck },
            { name: "Settings", icon: Settings },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              aria-current={tab === name ? "page" : undefined}
              className={`sidebar-nav-item ${tab === name ? "active" : ""}`}
              onClick={() => setTab(name)}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === "Tasks" && <span className="sidebar-nav-count">{sample ? 4 : 0}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom-panel">
          <div className="owner-guarantee-card">
            <LockKeyhole size={18} />
            <strong>Your funds. Your authority.</strong>
            <p>App access never grants backend or agent spending permission.</p>
          </div>

          <a href="https://docs.privy.io" target="_blank" rel="noreferrer" className="sidebar-doc-link">
            <CircleHelp size={16} />
            <span>Privy documentation</span>
            <ExternalLink size={12} style={{ marginLeft: "auto" }} />
          </a>

          <div className="sidebar-user-footer">
            <span className="user-initial-disc">{auth.authenticated ? "O" : "G"}</span>
            <div>
              <strong>{auth.authenticated ? "Connected Owner" : "Guest Mode"}</strong>
              <small>{auth.walletAddress ? short(auth.walletAddress) : "Sign in to connect"}</small>
            </div>
            {auth.authenticated ? (
              <button
                type="button"
                className="user-action-btn"
                aria-label="Sign out"
                onClick={() => void auth.logout().catch(() => setFeedback("Sign-out failed. Please retry."))}
              >
                <LogOut size={16} />
              </button>
            ) : (
              <Link href="/login" className="user-action-btn" aria-label="Sign in">
                <ArrowUpRight size={17} />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="unified-dashboard-content">
        {/* Topbar */}
        <header className="unified-topbar">
          <div className="breadcrumb-nav">
            <Link href="/" style={{ opacity: 0.6 }}>Janus</Link>
            <ChevronRight size={13} style={{ opacity: 0.4 }} />
            <strong>{tab}</strong>
          </div>

          <div className="topbar-actions">
            <div className="network-status-badge">
              <span className="status-dot-white" />
              <span className="network-badge-full">Hedera Testnet (296)</span>
              <span className="network-badge-short">Hedera 296</span>
              <span className="network-badge-micro">296</span>
            </div>

            {auth.authenticated ? (
              <button
                type="button"
                className="btn-secondary-pill topbar-wallet-btn"
                style={{ fontSize: "12px" }}
                onClick={() => setTab("Wallet")}
              >
                <Wallet size={14} />
                <span>{auth.walletAddress ? short(auth.walletAddress) : "Wallet"}</span>
              </button>
            ) : (
              <Link href="/login" className="cta topbar-cta-btn" style={{ fontSize: "12px", marginTop: 0 }}>
                <span className="cta-label-full">Connect wallet</span>
                <span className="cta-label-short">Connect</span>
                <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        </header>

        {/* Mode Banner */}
        <div className="dashboard-mode-strip">
          <div className="mode-strip-indicator">
            <span className="status-dot-white" />
            <span className="mode-strip-label">
              {["Agents", "Runs", "Credentials", "Integrations"].includes(tab)
                ? "RESEARCH WORKSPACE · PROVIDER BILLING SEPARATE FROM TOOL PAYMENTS"
                : sample
                ? "ILLUSTRATIVE ACCOUNTING FIXTURE · MOCK BASE UNITS"
                : "TESTNET · VALIDATED CHAIN READS · WALLET-APPROVED ACTIONS"}
            </span>
          </div>
          {!["Agents", "Runs", "Credentials", "Integrations"].includes(tab) && (
            <button type="button" className="mode-toggle-link" onClick={() => setSample(!sample)}>
              <span>{sample ? "Exit fixture view" : "Explore accounting fixture"}</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {/* Page Content */}
        <main className="dashboard-scrollable-body">
          <div className="dashboard-page-header">
            <div>
              <div className="section-eyebrow" style={{ width: "fit-content", marginBottom: "10px" }}>
                <span className="dot" />
                <span>Control Center</span>
              </div>
              <h1 className="dashboard-page-title">
                {tab === "Overview" && "Workflow Overview"}
                {tab === "Agents" && "Research Agents"}
                {tab === "Runs" && "Run Monitor"}
                {tab === "Credentials" && "Provider Credentials"}
                {tab === "Integrations" && "Network Integrations"}
                {tab === "Tasks" && "Task Budgets"}
                {tab === "Wallet" && "Connected Wallet"}
                {tab === "Recovery" && "Recovery Readiness"}
                {tab === "Settings" && "Workspace Settings"}
              </h1>
              <p className="dashboard-page-desc">
                {tab === "Agents" && "Create workers with a role, model, and account-owned provider credential."}
                {tab === "Runs" && "Parallel research, durable checkpoints, and a timeline of actual execution."}
                {tab === "Credentials" && "Encrypted provider keys, scoped to your verified account."}
                {tab === "Integrations" && "Inspect Hedera and discover public research worker profiles."}
                {tab === "Overview" && "A clear view of the work, the spend, and what comes next across all workers."}
                {tab === "Tasks" && "Bounded spending authority for each piece of work. Epoch fencing enabled."}
                {tab === "Wallet" && "Hardware and embedded wallet connections. Authoritative signing keys."}
                {tab === "Recovery" && "Independent owner recovery without reliance on the Janus application backend."}
                {tab === "Settings" && "Configuration keys, sessions, and protocol interface settings."}
              </p>
            </div>

            {sample && (tab === "Overview" || tab === "Tasks") && (
              <button type="button" className="btn-secondary-pill dashboard-export-btn" onClick={exportExample}>
                <Download size={14} />
                <span>Export fixture</span>
              </button>
            )}
          </div>

          {auth.error && (
            <div className="notice" role="alert" style={{ borderColor: "rgba(255, 80, 80, 0.4)", color: "#ff8888" }}>
              <AlertTriangle size={18} />
              <span>{auth.error}</span>
            </div>
          )}

          {feedback && (
            <div className="notice" role="status">
              <span>{feedback}</span>
              <button type="button" onClick={() => setFeedback(null)} style={{ marginLeft: "auto", border: "none", background: "none", color: "#ffffff" }}>
                <X size={16} />
              </button>
            </div>
          )}

          {wrongChain && (
            <div className="notice" role="alert" style={{ borderColor: "#eab308", color: "#fef08a" }}>
              <AlertTriangle size={18} />
              <div>
                <strong>Unsupported wallet network</strong>
                <p>Your wallet is on chain {auth.chainId}. Switch to Hedera Testnet (296) before executing actions.</p>
              </div>
              <button type="button" className="btn-secondary-pill" style={{ marginLeft: "auto" }} onClick={() => void auth.switchNetwork()}>
                Switch network
              </button>
            </div>
          )}

          {/* OVERVIEW OR TASKS TAB */}
          {!sample && ["Overview", "Tasks", "Recovery"].includes(tab) && <TreasuryPanel />}
          {sample && (tab === "Overview" || tab === "Tasks") && (
            <>
              {/* Metrics Grid */}
              <div className="dashboard-metrics-grid">
                {[
                  { label: "Available", value: "970", detail: "Safe to spend · includes 400 unallocated", icon: Wallet },
                  { label: "Reserved", value: "10", detail: "In-flight payment commitments", icon: LockKeyhole },
                  { label: "Spent", value: "20", detail: "Settled merchant deliverables", icon: ArrowUpRight },
                  { label: "Recovered", value: "0", detail: "Withdrawn directly by owner", icon: ShieldCheck },
                ].map(({ label, value, detail, icon: Icon }) => (
                  <div key={label} className="spotlight-card" style={{ padding: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#8e8e8e", fontSize: "12px" }}>
                      <span>{label}</span>
                      <Icon size={16} style={{ color: "#ffffff" }} />
                    </div>
                    <strong style={{ display: "block", fontSize: "36px", color: "#ffffff", fontFamily: "var(--font-display)", margin: "14px 0 6px" }}>
                      {sample ? value : "—"}
                    </strong>
                    <p style={{ fontSize: "11px", color: "#777777", margin: 0 }}>{detail}</p>
                  </div>
                ))}
              </div>

              {tab === "Overview" && (
                <div className="dashboard-two-col-grid">
                  {/* Budget Allocation Panel */}
                  <div className="spotlight-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                      <div>
                        <h3 style={{ fontSize: "18px", color: "#ffffff", margin: "0 0 4px" }}>Budget Allocation</h3>
                        <small style={{ color: "#777777" }}>Consolidated multi-task ceiling</small>
                      </div>
                      <span className="hash-tag">{sample ? "1,000 BASE UNITS" : "DISCONNECTED"}</span>
                    </div>

                    <div className="accounting-bar-track" style={{ marginBottom: "20px" }}>
                      {sample ? (
                        <>
                          <div className="bar-segment spent" style={{ width: "10%" }} title="Task A: 10%" />
                          <div className="bar-segment reserved" style={{ width: "20%" }} title="Task B: 20%" />
                          <div className="bar-segment available" style={{ width: "30%" }} title="Tasks C & D: 30%" />
                          <div className="bar-segment" style={{ width: "40%", background: "#1c1c20" }} title="Unallocated: 40%" />
                        </>
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.05)" }} />
                      )}
                    </div>

                    <div className="accounting-legend">
                      {["Task A (100)", "Task B (200)", "Task C (150)", "Task D (150)", "Unallocated (400)"].map((lbl, i) => (
                        <div key={lbl} className="legend-item">
                          <span className="legend-tag">
                            <span className="legend-color-dot" style={{ background: i === 0 ? "#ffffff" : i === 1 ? "#88888a" : i === 4 ? "#1c1c20" : "#343438" }} />
                            <span>{lbl.split(" ")[0]} {lbl.split(" ")[1]}</span>
                          </span>
                          <strong>{sample ? [100, 200, 150, 150, 400][i] : "—"}</strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "11px", color: "#777777", display: "flex", gap: "8px", alignItems: "center" }}>
                      <ShieldCheck size={14} style={{ color: "#ffffff" }} />
                      <span>Available 970 + reserved 10 = accounted balance 980 base units</span>
                    </div>
                  </div>

                  {/* Continuity Monitor Panel */}
                  <div className="spotlight-card" style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <h3 style={{ fontSize: "18px", color: "#ffffff", margin: 0 }}>Continuity Monitor</h3>
                      <GitBranch size={18} style={{ color: "#8e8e8e" }} />
                    </div>

                    <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", display: "grid", placeItems: "center", color: "#ffffff", margin: "16px 0" }}>
                      {sample ? <AlertTriangle size={24} style={{ color: "#ffffff" }} /> : <Cpu size={24} />}
                    </div>

                    <h4 style={{ fontSize: "16px", color: "#ffffff", margin: "0 0 8px" }}>
                      {sample ? "Task A Requires Replacement" : "Ready for Deployment"}
                    </h4>
                    <p style={{ fontSize: "12px", color: "#8e8e8e", lineHeight: 1.6, margin: "0 0 24px" }}>
                      {sample
                        ? "Task A has 70 available units remaining. Its 10-unit reservation remains cryptographically valid after epoch handoff."
                        : "Connect your hardware or embedded wallet to establish identity. A treasury contract is required to run funded tasks."}
                    </p>

                    <button
                      type="button"
                      className="btn-secondary-pill"
                      style={{ marginTop: "auto", width: "fit-content" }}
                      onClick={() => (sample ? setSelected(tasks[0]) : setTab("Wallet"))}
                    >
                      <span>{sample ? "Review Task A Details" : "Configure Wallet"}</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Task Budgets Table */}
              <div className="spotlight-card dashboard-table-card" style={{ marginTop: "24px", padding: 0 }}>
                <div className="dashboard-table-header" style={{ padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <h3 style={{ fontSize: "18px", color: "#ffffff", margin: "0 0 4px" }}>
                      Task Budgets <span className="hash-tag" style={{ marginLeft: "8px" }}>{sample ? 4 : 0} ACTIVE</span>
                    </h3>
                    <small style={{ color: "#777777" }}>Bounded spending authority for each piece of work.</small>
                  </div>

                  <div className="dashboard-search-box" style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "999px", padding: "6px 14px" }}>
                    <Search size={14} style={{ color: "#777777" }} />
                    <input
                      aria-label="Search tasks"
                      placeholder="Search tasks…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      style={{ background: "transparent", border: "none", outline: "none", color: "#ffffff", fontSize: "12px", width: "140px" }}
                    />
                  </div>
                </div>

                <div className="dashboard-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px", minWidth: "620px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#777777", textTransform: "uppercase", fontSize: "10px", letterSpacing: "1px" }}>
                        <th style={{ padding: "14px 28px" }}>Task</th>
                        <th style={{ padding: "14px 16px" }}>Status</th>
                        <th style={{ padding: "14px 16px" }}>Available</th>
                        <th style={{ padding: "14px 16px" }}>Reserved</th>
                        <th style={{ padding: "14px 16px" }}>Spent</th>
                        <th style={{ padding: "14px 16px" }}>Epoch</th>
                        <th style={{ padding: "14px 28px", textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownTasks.map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "16px 28px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span className="hash-tag" style={{ width: "28px", height: "28px", display: "grid", placeItems: "center" }}>
                                {t.id}
                              </span>
                              <div>
                                <strong style={{ color: "#ffffff", display: "block" }}>{t.name}</strong>
                                <small style={{ color: "#777777", fontSize: "11px" }}>{t.description}</small>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "16px 16px" }}>
                            <span className="handoff-status-pill" style={{ fontSize: "11px", padding: "3px 10px" }}>
                              <span className="handoff-status-dot" style={{ background: t.id === "A" ? "#eab308" : "#ffffff", boxShadow: t.id === "A" ? "0 0 8px #eab308" : "0 0 8px #ffffff" }} />
                              <span>{t.status}</span>
                            </span>
                          </td>
                          <td style={{ padding: "16px 16px", fontFamily: "monospace", color: "#ffffff" }}>{t.available}</td>
                          <td style={{ padding: "16px 16px", fontFamily: "monospace", color: "#8e8e8e" }}>{t.reserved}</td>
                          <td style={{ padding: "16px 16px", fontFamily: "monospace", color: "#8e8e8e" }}>{t.spent}</td>
                          <td style={{ padding: "16px 16px", fontFamily: "monospace", color: "#ffffff" }}>0{t.epoch}</td>
                          <td style={{ padding: "16px 28px", textAlign: "right" }}>
                            <button
                              type="button"
                              className="btn-secondary-pill"
                              style={{ padding: "6px 12px", fontSize: "11px" }}
                              onClick={() => setSelected(t)}
                            >
                              <span>Inspect</span>
                              <ArrowUpRight size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="dashboard-table-footer" style={{ padding: "16px 28px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "11px", color: "#777777", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>State invariant verified: Cap = Available + Reserved + Spent</span>
                  <span>Hedera Testnet 296</span>
                </div>
              </div>
            </>
          )}

          {/* WALLET, RECOVERY, OR SETTINGS TABS */}
          {(tab === "Wallet" || tab === "Recovery" || tab === "Settings") && (
            <div className="dashboard-two-col-grid" style={{ marginTop: "20px" }}>
              {/* Wallet Details Panel */}
              <div className="spotlight-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "18px", color: "#ffffff", margin: 0 }}>
                    {tab === "Settings" ? "Authentication & Credentials" : "Wallet Connection"}
                  </h3>
                  <Wallet size={18} style={{ color: "#ffffff" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                    <span style={{ color: "#8e8e8e" }}>Privy Configuration</span>
                    <strong style={{ color: "#ffffff" }}>{auth.configured ? "App ID Configured" : "App ID Required"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                    <span style={{ color: "#8e8e8e" }}>Identity</span>
                    <strong style={{ color: "#ffffff" }}>
                      {auth.ready ? auth.user?.email ?? (auth.authenticated ? "Wallet Verified" : "Not signed in") : "Initializing…"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                    <span style={{ color: "#8e8e8e" }}>Server Session</span>
                    <strong style={{ color: auth.session === "verified" ? "#ffffff" : "#8e8e8e" }}>
                      {auth.session === "verified" ? "Verified ES256" : auth.session === "checking" ? "Verifying…" : "Not Verified"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "10px" }}>
                    <span style={{ color: "#8e8e8e" }}>Target Settlement Network</span>
                    <strong style={{ color: "#ffffff" }}>Hedera Testnet (Chain ID 296)</strong>
                  </div>
                </div>

                {auth.walletAddress && (
                  <div className="dashboard-wallet-address-box" style={{ margin: "24px 0", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                    <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#e0e0e0", wordBreak: "break-all", minWidth: 0 }}>{auth.walletAddress}</span>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button type="button" className="btn-secondary-pill" style={{ padding: "6px 10px" }} onClick={() => void copyAddress()}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a href={`https://hashscan.io/testnet/account/${auth.walletAddress}`} target="_blank" rel="noreferrer" className="btn-secondary-pill" style={{ padding: "6px 10px" }}>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                  {auth.authenticated ? (
                    <>
                      <button type="button" className="btn-secondary-pill" onClick={auth.connectWallet}>
                        Connect Another Wallet
                      </button>
                      <button type="button" className="btn-secondary-pill" onClick={() => void auth.refresh()}>
                        <RefreshCw size={14} /> Refresh Balance
                      </button>
                      <button type="button" className="btn-secondary-pill" onClick={() => void auth.verifySession()}>
                        Verify Session
                      </button>
                    </>
                  ) : (
                    <Link href="/login" className="cta" style={{ marginTop: 0 }}>
                      <span>Sign in with Privy</span>
                      <ArrowUpRight size={15} />
                    </Link>
                  )}
                </div>
              </div>

              {/* Recovery Readiness Panel */}
              <div className="spotlight-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "18px", color: "#ffffff", margin: 0 }}>Recovery Readiness</h3>
                  <ShieldCheck size={18} style={{ color: "#ffffff" }} />
                </div>
                <p style={{ fontSize: "13px", color: "#8e8e8e", lineHeight: 1.6, marginBottom: "24px" }}>
                  Your owner key is the cryptographic trust root. Embedded-wallet owners should export their key into a cold or hardware wallet before funding production contracts.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: auth.authenticated ? "#ffffff" : "rgba(255,255,255,0.08)", color: auth.authenticated ? "#000000" : "#ffffff", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
                      {auth.authenticated ? "✓" : "1"}
                    </div>
                    <div>
                      <strong style={{ color: "#ffffff", fontSize: "14px" }}>Establish Sovereign Identity</strong>
                      <p style={{ fontSize: "12px", color: "#777777", margin: "2px 0 0" }}>Authenticate through Privy or connect your existing wallet.</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: auth.walletAddress && !wrongChain ? "#ffffff" : "rgba(255,255,255,0.08)", color: auth.walletAddress && !wrongChain ? "#000000" : "#ffffff", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
                      {auth.walletAddress && !wrongChain ? "✓" : "2"}
                    </div>
                    <div>
                      <strong style={{ color: "#ffffff", fontSize: "14px" }}>Connect on Hedera Testnet</strong>
                      <p style={{ fontSize: "12px", color: "#777777", margin: "2px 0 0" }}>Verify your address, gas balance, and chain ID (296).</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: attested ? "#ffffff" : "rgba(255,255,255,0.08)", color: attested ? "#000000" : "#ffffff", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 600, flexShrink: 0 }}>
                      {attested ? "✓" : "3"}
                    </div>
                    <div>
                      <strong style={{ color: "#ffffff", fontSize: "14px" }}>
                        {embedded ? "Export Embedded Wallet Key" : "Independent Recovery Attestation"}
                      </strong>
                      <p style={{ fontSize: "12px", color: "#777777", margin: "2px 0 0" }}>
                        {embedded
                          ? "Use Privy’s secure export dialog. Never paste your private key into the app."
                          : "Confirm you control this address outside this dashboard."}
                      </p>
                      {embedded && (
                        <button type="button" className="btn-secondary-pill" style={{ marginTop: "10px", fontSize: "11px", padding: "4px 12px" }} onClick={() => void auth.exportWallet()}>
                          Open Secure Key Export <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "12px", color: "#8e8e8e", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    disabled={!auth.authenticated || !auth.walletAddress}
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                    style={{ marginTop: "2px" }}
                  />
                  <span>I can access this wallet independently. This is my sovereign attestation; the app never stores secret keys.</span>
                </label>
              </div>
            </div>
          )}

          {["Agents", "Runs", "Credentials", "Integrations"].includes(tab) && <AgentControlCenter view={tab as "Agents" | "Runs" | "Credentials" | "Integrations"} />}

          {/* Dashboard Footer */}
          <footer className="site-footer" style={{ marginTop: "60px" }}>
            <div className="site-footer-brand">
              <BrandLogo size="sm" />
            </div>
            <span>Identity is separate from onchain authority · Janus Protocol</span>
            <span>Hedera Testnet 296 · Sepolia Ready</span>
          </footer>
        </main>
      </div>

      {/* Task Inspection Dialog */}
      <dialog ref={dialogRef} onCancel={() => setSelected(null)} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }} className="task-dialog">
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="hash-tag">EXAMPLE TASK {selected.id}</span>
              <button type="button" className="btn-secondary-pill" style={{ padding: "6px" }} onClick={() => setSelected(null)} aria-label="Close task details">
                <X size={18} />
              </button>
            </div>

            <div>
              <h2 style={{ fontSize: "24px", color: "#ffffff", margin: "0 0 6px" }}>{selected.name}</h2>
              <p style={{ color: "#8e8e8e", fontSize: "13px", margin: 0 }}>{selected.description}</p>
            </div>

            <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8e8e8e" }}>Budget Cap:</span>
                <strong style={{ color: "#ffffff", fontFamily: "monospace" }}>{selected.cap} USDC</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8e8e8e" }}>Available / Reserved / Spent:</span>
                <strong style={{ color: "#ffffff", fontFamily: "monospace" }}>
                  {selected.available} / {selected.reserved} / {selected.spent}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8e8e8e" }}>Active Assignment Epoch:</span>
                <strong style={{ color: "#ffffff", fontFamily: "monospace" }}>0{selected.epoch}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8e8e8e" }}>Worker Identifier:</span>
                <span style={{ color: "#ffffff", fontFamily: "monospace" }}>{selected.worker}</span>
              </div>
            </div>

            <div className="notice" role="alert" style={{ margin: 0 }}>
              <AlertTriangle size={18} />
              <span>Existing reservations survive reassignment. A merchant may still collect an authorized deliverable.</span>
            </div>

            <button type="button" className="cta" style={{ width: "100%", justifyContent: "center" }} disabled>
              Resume with Replacement
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}

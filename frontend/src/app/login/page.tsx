"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Wallet, Mail, AlertCircle, LoaderCircle, LockKeyhole } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useRelayAuth } from "@/context/privy-auth-context";

export default function LoginPage() {
  const auth = useRelayAuth();
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const isReady = auth.ready || timedOut;

  useEffect(() => {
    if (auth.ready && auth.authenticated) {
      router.replace("/dashboard");
    }
  }, [auth.ready, auth.authenticated, router]);

  return (
    <div className="landing-body" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Background Video */}
      <div className="bg">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* Login Shell */}
      <main className="unified-login-shell">
        {/* Left Side: Brand Story */}
        <section className="unified-login-story">
          <BrandLogo size="lg" showTagline />

          <div className="story-content">
            <div className="section-eyebrow" style={{ width: "fit-content", marginBottom: "16px" }}>
              <span className="dot" />
              <span>Built for the second attempt</span>
            </div>

            <h1 className="story-heading">
              Keep the work moving.
              <br />
              <span>Keep control.</span>
            </h1>

            <p className="story-desc">
              Your identity connects you to the workspace. Your wallet stays the sovereign root of onchain spending authority.
            </p>

            <div className="story-principles">
              <div className="principle-item">
                <ShieldCheck size={18} />
                <span>Task-scoped spending boundaries</span>
              </div>
              <div className="principle-item">
                <LockKeyhole size={18} />
                <span>Independent owner recovery by design</span>
              </div>
            </div>
          </div>

          <div className="story-footer">
            <span>JANUS V1 · HEDERA TESTNET · SEPOLIA TESTNET</span>
          </div>
        </section>

        {/* Right Side: Authentication Box */}
        <section className="unified-login-form-area">
          <Link href="/" className="back-link">
            <ArrowLeft size={16} />
            <span>Back to overview</span>
          </Link>

          <div className="unified-auth-card">
            <div className="auth-card-icon">
              <Wallet size={24} />
            </div>

            <div className="auth-card-eyebrow">YOUR WORKSPACE AWAITS</div>
            <h2 className="auth-card-title">Welcome to Janus.</h2>
            <p className="auth-card-desc">
              Sign in with email or an existing Ethereum wallet. Email sign-in creates an embedded wallet if you don’t already have one.
            </p>

            {!auth.configured && (
              <div className="notice" role="status">
                <AlertCircle size={18} />
                <div>
                  <strong>Privy setup required</strong>
                  <p>
                    Add your public App ID to <code>NEXT_PUBLIC_PRIVY_APP_ID</code> in <code>.env.local</code>. Sign-in is disabled until configured.
                  </p>
                </div>
              </div>
            )}

            {auth.error && (
              <div className="notice" role="alert" style={{ borderColor: "rgba(255, 80, 80, 0.4)", color: "#ff8888" }}>
                <AlertCircle size={18} />
                <span>{auth.error}</span>
              </div>
            )}

            <button
              type="button"
              className="cta"
              style={{ width: "100%", justifyContent: "center", gap: "10px", marginTop: "10px" }}
              disabled={!auth.configured || !isReady || auth.authenticated}
              onClick={() => auth.login("email")}
            >
              <Mail size={18} />
              <span>Continue with email</span>
              <ArrowUpRight size={16} style={{ marginLeft: "auto" }} />
            </button>

            <div className="auth-divider-line">
              <span />
              <small>OR</small>
              <span />
            </div>

            <button
              type="button"
              className="btn-secondary-pill"
              style={{ width: "100%", justifyContent: "center", gap: "10px", height: "46px" }}
              disabled={!auth.configured || !isReady || auth.authenticated}
              onClick={() => auth.login("wallet")}
            >
              <Wallet size={18} />
              <span>Connect a wallet</span>
              <ArrowUpRight size={16} style={{ marginLeft: "auto" }} />
            </button>

            {!auth.ready && !timedOut && (
              <p className="auth-loading-text">
                <LoaderCircle size={15} className="spin" />
                <span>Initializing secure sign-in…</span>
              </p>
            )}

            <p className="auth-disclosure-text">
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                Authentication & wallet connection by Privy. Privy processes your login identifier and wallet address. Public-chain activity is public.
              </span>
            </p>
          </div>

          <span className="login-bottom-footnote">TESTNET ONLY · NO REAL CUSTOMER FUNDS</span>
        </section>
      </main>
    </div>
  );
}

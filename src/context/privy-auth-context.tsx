"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { PrivyProvider, usePrivy, useWallets, useLogin } from "@privy-io/react-auth";
import { sepolia } from "viem/chains";
import { formatEther } from "viem";

export const targetChain = sepolia;
type AuthState = {
  configured: boolean; ready: boolean; authenticated: boolean;
  user: { id: string; email?: string } | null;
  walletAddress: string | null; walletType: string | null; chainId: number | null;
  balance: string | null; error: string | null;
  session: "idle" | "checking" | "verified" | "error";
  login: (method?: "email" | "wallet") => void;
  logout: () => Promise<void>; connectWallet: () => void;
  selectWallet: (address: string) => void;
  wallets: { address: string; walletClientType: string }[];
  switchNetwork: () => Promise<void>; refresh: () => Promise<void>;
  verifySession: () => Promise<void>; exportWallet: () => Promise<void>;
};
const empty: AuthState = {
  configured: false, ready: true, authenticated: false, user: null,
  walletAddress: null, walletType: null, chainId: null, balance: null, error: null, session: "idle",
  login: () => {}, logout: async () => {}, connectWallet: () => {}, selectWallet: () => {},
  wallets: [], switchNetwork: async () => {}, refresh: async () => {}, verifySession: async () => {}, exportWallet: async () => {},
};
const AuthContext = createContext<AuthState>(empty);
export const useRelayAuth = () => useContext(AuthContext);

function PrivyBridge({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  const { getAccessToken } = privy;
  const { wallets, ready: walletsReady } = useWallets();
  const [selected, selectWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthState["session"]>("idle");
  const { login } = useLogin({ onError: () => setError("Sign-in was not completed. Please try again.") });
  const wallet = wallets.find(w => w.address === selected) ?? wallets.find(w => w.address === privy.user?.wallet?.address) ?? wallets[0];

  const refresh = useCallback(async () => {
    setBalance(null); setChainId(null);
    if (!wallet || !privy.authenticated) return;
    try {
      const provider = await wallet.getEthereumProvider();
      const chain = await provider.request({ method: "eth_chainId" });
      const id = Number(chain);
      setChainId(id);
      if (id !== targetChain.id) return;
      const value = await provider.request({ method: "eth_getBalance", params: [wallet.address, "latest"] });
      setBalance(formatEther(BigInt(value as string)));
    } catch { setError("Could not read your wallet. Check its connection and retry."); }
  }, [wallet, privy.authenticated]);

  const verifySession = useCallback(async () => {
    setSession("checking"); setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Your session expired. Sign in again.");
      const response = await fetch("/api/session", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Session verification failed.");
      setSession("verified");
    } catch (e) { setSession("error"); setError(e instanceof Error ? e.message : "Session verification failed."); }
  }, [getAccessToken]);

  useEffect(() => {
    if (!privy.authenticated) return;
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 15000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [privy.authenticated, refresh]);
  useEffect(() => {
    if (!privy.authenticated) return;
    const timer = setTimeout(() => void verifySession(), 0);
    return () => clearTimeout(timer);
  }, [privy.authenticated, verifySession]);

  async function switchNetwork() {
    setError(null);
    try { await wallet?.switchChain(targetChain.id); await refresh(); }
    catch { setError("Network switch was declined or failed. Select Sepolia in your wallet and retry."); }
  }
  async function exportWallet() {
    setError(null);
    try { if (wallet?.walletClientType === "privy") await privy.exportWallet({ address: wallet.address }); }
    catch { setError("Wallet export was not completed. Please try again."); }
  }
  return <AuthContext.Provider value={{
    configured: true, ready: privy.ready && walletsReady, authenticated: privy.authenticated,
    user: privy.user ? { id: privy.user.id, email: privy.user.email?.address } : null,
    walletAddress: wallet?.address ?? null, walletType: wallet?.walletClientType ?? null,
    chainId: privy.authenticated ? chainId : null, balance: privy.authenticated ? balance : null,
    error, session: privy.authenticated ? session : "idle", wallets,
    login: (method) => { setError(null); login(method ? { loginMethods: [method] } : undefined); },
    logout: async () => { await privy.logout(); setSession("idle"); setBalance(null); setChainId(null); selectWallet(null); setError(null); },
    connectWallet: () => privy.connectWallet(), selectWallet, switchNetwork, refresh, verifySession, exportWallet,
  }}>{children}</AuthContext.Provider>;
}

export function PrivyAuthWrapper({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  if (!appId || appId.includes("your-") || appId.includes("replace-")) {
    return <AuthContext.Provider value={empty}>{children}</AuthContext.Provider>;
  }
  return <PrivyProvider appId={appId} config={{
    appearance: { theme: "dark", accentColor: "#c5f277", walletChainType: "ethereum-only" },
    loginMethods: ["email", "wallet"], defaultChain: targetChain, supportedChains: [targetChain],
    embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
  }}><PrivyBridge>{children}</PrivyBridge></PrivyProvider>;
}

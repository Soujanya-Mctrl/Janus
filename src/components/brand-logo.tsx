import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function BrandLogo({ className = "", size = "md", showTagline = false }: { className?: string; size?: "sm" | "md" | "lg"; showTagline?: boolean }) {
  return <Link href="/" aria-label="RelayBudget home" className={`relay-logo ${size === "lg" ? "logo-lg" : ""} ${className}`}><span className="logo-mark"><ArrowUpRight size={23} strokeWidth={2.5}/></span><span>relay<span className="logo-light">budget</span>{showTagline && <small>AGENT PAYMENT INFRASTRUCTURE</small>}</span></Link>;
}

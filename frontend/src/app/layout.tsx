import type { Metadata } from "next";
import "./globals.css";
import { PrivyAuthWrapper } from "@/context/privy-auth-context";

export const metadata: Metadata = {
  title: "Janus · Sovereign Payment Infrastructure for Autonomous Agents",
  description: "Payment-aware recovery for agent workflows. Task budgets stay with the work while worker spending authority can be safely reassigned.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrivyAuthWrapper>
          {children}
        </PrivyAuthWrapper>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import "./globals.css";
import { PrivyAuthWrapper } from "@/context/privy-auth-context";

export const metadata: Metadata = {
  title: "Janus | Keep the work moving. Keep control.",
  description: "Payment-aware recovery for agent workflows. Scoped budgets, explicit accounting, and owner-controlled authority.",
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
    <html
      lang="en"
    >
      <body>
        <PrivyAuthWrapper>
          {children}
        </PrivyAuthWrapper>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PrivyAuthWrapper } from "@/context/privy-auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RelayBudget | Keep the work moving. Keep control.",
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
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <PrivyAuthWrapper>
          {children}
        </PrivyAuthWrapper>
      </body>
    </html>
  );
}


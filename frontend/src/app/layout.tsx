import type { Metadata } from "next";
import "./globals.css";
import { PrivyAuthWrapper } from "@/context/privy-auth-context";

export const metadata: Metadata = {
  title: "Intelligence Designed To Evolve",
  description: "Build applications that reason, adapt and collaborate using a modular AI platform designed for production.",
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


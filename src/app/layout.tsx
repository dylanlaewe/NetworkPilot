import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetworkPilot — Simulation Dashboard",
  description: "A private workspace for thoughtful professional outreach planning.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

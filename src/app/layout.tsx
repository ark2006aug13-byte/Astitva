import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareerPilot AI — Autonomous Job Application SaaS",
  description:
    "Empowering candidates with autonomous agents that find and apply to matching roles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body suppressHydrationWarning className="font-sans bg-[#F7F8FB] text-[#475569] antialiased min-h-screen selection:bg-cyan-500/20 selection:text-cyan-900">
        {children}
      </body>
    </html>
  );
}

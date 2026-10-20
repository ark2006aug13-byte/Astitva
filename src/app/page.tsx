"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Dynamic client import with ssr: false eliminates SSR hydration mismatches
// caused by browser extensions injecting attributes (e.g. fdprocessedid) onto buttons/inputs
const ModernAnimatedSignIn = dynamic(
  () =>
    import("@/components/ModernAnimatedSignIn").then(
      (mod) => mod.ModernAnimatedSignIn
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F8FB]">
        <div className="w-96 p-8 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm space-y-4">
          <div className="h-8 bg-slate-100 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-11 bg-cyan-600/30 rounded-xl animate-pulse" />
        </div>
      </div>
    ),
  }
);

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen relative flex flex-col justify-between items-center bg-[#F7F8FB] text-[#475569] overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-900"
    >
      {/* Main Content View */}
      <div
        suppressHydrationWarning
        className="relative z-10 w-full flex-1 flex flex-col items-center justify-center"
      >
        {mounted && <ModernAnimatedSignIn />}
      </div>

      {/* Clean Light Footer */}
      <footer
        suppressHydrationWarning
        className="relative z-10 text-center py-4 text-xs font-medium text-[#94A3B8] border-t border-[#E2E8F0] w-full bg-white"
      >
        <p>
          CareerPilot AI © 2026 • Autonomous Job Application SaaS • Powered by{" "}
          <span className="text-cyan-600 font-bold">Supabase Cloud</span> &amp;{" "}
          <span className="text-slate-700 font-bold">Autonomous Agents</span>
        </p>
      </footer>
    </main>
  );
}

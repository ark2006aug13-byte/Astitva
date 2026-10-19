"use client";

import React from "react";
import { ModernAnimatedSignIn } from "@/components/ModernAnimatedSignIn";

export default function Home() {
  return (
    <main className="min-h-screen relative flex flex-col justify-between items-center bg-[#F7F8FB] text-[#475569] overflow-x-hidden selection:bg-cyan-500/20 selection:text-cyan-900">
      {/* Main Content View */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center">
        <ModernAnimatedSignIn />
      </div>

      {/* Clean Light Footer */}
      <footer className="relative z-10 text-center py-4 text-xs font-medium text-[#94A3B8] border-t border-[#E2E8F0] w-full bg-white">
        <p>
          CareerPilot AI © 2026 • Autonomous Job Application SaaS • Powered by{" "}
          <span className="text-cyan-600 font-bold">Supabase Cloud</span> &amp;{" "}
          <span className="text-slate-700 font-bold">Autonomous Agents</span>
        </p>
      </footer>
    </main>
  );
}

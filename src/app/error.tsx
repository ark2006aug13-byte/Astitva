'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root screen error caught:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-[#0F172A] font-heading">
            Something broke on this screen
          </h2>
          <p className="text-sm text-[#475569]">
            Your data is safe.
          </p>
        </div>
        {error?.message && (
          <p className="text-xs text-slate-500 font-mono bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 break-words">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-slate-200"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload Page</span>
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';

interface DraftTextareaProps {
  label: string;
  helperText?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  onAiDraft?: () => void;
  isAiDrafted?: boolean;
  isLoadingAi?: boolean;
  error?: string;
}

export const DraftTextarea: React.FC<DraftTextareaProps> = ({
  label,
  helperText,
  value,
  onChange,
  placeholder,
  rows = 4,
  onAiDraft,
  isAiDrafted = false,
  isLoadingAi = false,
  error,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
          {label}
        </label>

        <div className="flex items-center gap-2">
          {/* Fuchsia reserved strictly for human approval review badge */}
          {isAiDrafted && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FDF4FF] border border-fuchsia-300 text-fuchsia-700 animate-pulse">
              <Sparkles className="w-3 h-3 text-fuchsia-600" />
              <span>AI drafted - please review</span>
            </span>
          )}

          {onAiDraft && (
            <button
              type="button"
              onClick={onAiDraft}
              disabled={isLoadingAi}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg bg-[#ECFEFF] hover:bg-cyan-100 text-cyan-700 border border-cyan-200 transition-all cursor-pointer disabled:opacity-50"
              title="Generate tailored response using AI based on your profile"
            >
              {isLoadingAi ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              )}
              <span>{isLoadingAi ? 'Drafting...' : 'AI Draft'}</span>
            </button>
          )}
        </div>
      </div>

      <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] resize-y leading-relaxed focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
      />

      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[12px] text-[#94A3B8]">{helperText}</p>
      ) : null}
    </div>
  );
};

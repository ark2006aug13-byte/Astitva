'use client';

import React from 'react';

interface YesNoToggleProps {
  label: string;
  value: boolean | null | undefined;
  onChange: (val: boolean) => void;
  helperText?: string;
}

export const YesNoToggle: React.FC<YesNoToggleProps> = ({
  label,
  value,
  onChange,
  helperText,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-slate-300 transition-all">
      <div>
        <span className="text-sm font-semibold text-[#0F172A] block">{label}</span>
        {helperText && (
          <span className="text-[12px] text-[#94A3B8] block mt-0.5">{helperText}</span>
        )}
      </div>

      <div className="inline-flex items-center p-1 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] shrink-0 self-start sm:self-center">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            value === true
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'text-[#475569] hover:text-[#0F172A]'
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            value === false
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-[#475569] hover:text-[#0F172A]'
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
};

'use client';

import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StepShellProps {
  title: string;
  subtitle: string;
  stepNumber: number;
  totalSteps: number;
  onSkip?: () => void;
  canSkip?: boolean;
  children: ReactNode;
}

export const StepShell: React.FC<StepShellProps> = ({
  title,
  subtitle,
  stepNumber,
  totalSteps,
  onSkip,
  canSkip = false,
  children,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-3xl mx-auto"
    >
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800 bg-[#ECFEFF] border border-cyan-200 px-2.5 py-0.5 rounded-full">
              Step {stepNumber} of {totalSteps}
            </span>
            {canSkip && (
              <span className="text-[11px] font-medium text-[#94A3B8]">
                Optional
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] font-heading tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1 max-w-xl">
            {subtitle}
          </p>
        </div>

        {canSkip && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="self-start sm:self-center text-xs font-semibold text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-slate-100"
          >
            Skip for now →
          </button>
        )}
      </div>

      {/* Step Body: white card with subtle border and shadow-sm */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 sm:p-8">
        {children}
      </div>
    </motion.div>
  );
};

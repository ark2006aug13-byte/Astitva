'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  onStepClick?: (step: number) => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  stepNames,
  onStepClick,
}) => {
  const percent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);

  // SVG Circular ring calculation
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 px-2">
      <div className="flex items-center justify-between gap-4 mb-4">
        {/* Step Badge & Name for Mobile */}
        <div className="flex items-center gap-3">
          {/* Circular Completion Ring */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 54 54">
              <circle
                cx="27"
                cy="27"
                r={radius}
                className="stroke-[#E2E8F0]"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="27"
                cy="27"
                r={radius}
                className="stroke-cyan-600 transition-all duration-500 ease-out"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <span className="absolute font-black text-xs text-cyan-700 font-heading">
              {percent}%
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Onboarding Progress
            </div>
            <div className="text-sm font-extrabold text-[#0F172A] font-heading">
              {stepNames[currentStep - 1] || `Step ${currentStep}`}
            </div>
          </div>
        </div>

        {/* Brand pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-xs text-[#475569] shadow-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
          <span>CareerPilot AI Setup</span>
        </div>
      </div>

      {/* Desktop Step Bar with Names & Connectors */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Background track line */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-[#E2E8F0] -z-0" />
        {/* Active filled line */}
        <div
          className="absolute top-4 left-6 h-0.5 bg-cyan-600 transition-all duration-500 ease-out -z-0"
          style={{ width: `${percent * 0.88}%` }}
        />

        {stepNames.map((name, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <div
              key={name}
              onClick={() => onStepClick && stepNum < currentStep && onStepClick(stepNum)}
              className={`flex flex-col items-center gap-2 relative z-10 ${
                isCompleted ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 ${
                  isCompleted
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : isCurrent
                    ? 'bg-white border-2 border-cyan-600 text-cyan-700 ring-4 ring-cyan-100 font-black shadow-sm'
                    : 'bg-[#F1F5F9] border border-[#E2E8F0] text-[#94A3B8]'
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : stepNum}
              </div>
              <span
                className={`text-[11px] font-semibold tracking-tight transition-colors text-center max-w-[100px] ${
                  isCurrent
                    ? 'text-cyan-800 font-bold'
                    : isCompleted
                    ? 'text-[#475569]'
                    : 'text-[#94A3B8]'
                }`}
              >
                {name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

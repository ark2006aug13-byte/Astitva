'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, Check } from 'lucide-react';

interface WarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white border border-[#E2E8F0] p-6 sm:p-8 rounded-2xl shadow-xl"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-5 right-5 p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#0F172A] font-heading">
                Autopilot Mode Activation
              </h3>
              <p className="text-xs text-amber-700 font-semibold">
                Autonomous AI Application Safeguards
              </p>
            </div>
          </div>

          {/* Explanation points */}
          <div className="space-y-3 my-5 text-xs text-[#475569] leading-relaxed">
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A] block mb-0.5">
                1. Strict Daily Caps
              </span>
              Autopilot will strictly honor your configured daily application limit (default 5/day) to prevent employer spam and rate limits.
            </div>

            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A] block mb-0.5">
                2. Real-Time Audit Log
              </span>
              Every application submission, filled questionnaire answer, and portal interaction is recorded immutably in your security audit trail.
            </div>

            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="font-bold text-[#0F172A] block mb-0.5">
                3. Instant Kill-Switch
              </span>
              You can pause or terminate active browser agents with one click directly from your dashboard or via WhatsApp command.
            </div>
          </div>

          {/* Mandatory Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-[#FFFBEB] border border-amber-200 cursor-pointer select-none mb-6">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-cyan-600"
            />
            <span className="text-xs text-amber-900 font-medium">
              I understand that Autopilot submits job applications automatically on my behalf based on my profile answers and threshold.
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold text-[#475569] hover:bg-slate-50 hover:text-[#0F172A] transition-colors cursor-pointer"
            >
              Keep Copilot Mode
            </button>
            <button
              type="button"
              disabled={!acknowledged}
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm Autopilot</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

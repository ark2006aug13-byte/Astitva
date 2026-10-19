"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, KeyRound, CheckCircle2, Mail } from "lucide-react";
import { sounds } from "@/utils/sound";
import { supabase } from "@/lib/supabase";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = "",
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [isSent, setIsSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sounds.playClick();
    setIsSending(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        console.warn("Supabase reset password:", error.message);
      }
      setIsSending(false);
      setIsSent(true);
      sounds.playChime();
    } catch {
      setIsSending(false);
      setIsSent(true);
    }
  };

  const handleReset = () => {
    setIsSent(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
        >
          <motion.div
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-2xl p-6 sm:p-7 shadow-xl border border-[#E2E8F0] overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            {!isSent ? (
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#ECFEFF] text-cyan-600 border border-cyan-200 flex items-center justify-center mb-4">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-[#0F172A] font-heading tracking-tight">
                  Reset Your Password
                </h3>
                <p className="text-sm text-[#475569] mt-1.5 mb-6">
                  Enter the email address associated with your account, and we will send you a password recovery link.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600/20 focus:border-cyan-600 transition-all placeholder:text-[#94A3B8]"
                    />
                  </div>

                  {errorMessage && (
                    <p className="text-xs text-rose-600 font-medium">{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={isSending}
                    className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSending ? "Sending link..." : "Send Reset Link"}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-[#ECFDF5] border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-[#0F172A] font-heading">
                  Check Your Inbox
                </h3>
                <p className="text-sm text-[#475569] mt-2 mb-6">
                  We have sent password recovery instructions to <strong className="text-[#0F172A]">{email}</strong>.
                </p>
                <button
                  onClick={handleReset}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-[#0F172A] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

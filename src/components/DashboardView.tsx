"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  ExternalLink,
  RefreshCw,
  User,
  Briefcase,
  Phone,
  Mail,
  Code,
  Copy,
  Check,
  Trash2,
  FileCheck,
  LogOut,
  FolderLock,
  Layers,
} from "lucide-react";
import confetti from "canvas-confetti";
import { sounds } from "@/utils/sound";
import { supabase } from "@/lib/supabase";

interface DashboardViewProps {
  userEmail: string;
  userName?: string;
  onLogout: () => void;
}

interface UserSubmission {
  id?: string;
  full_name: string;
  email: string;
  phone?: string | null;
  target_role?: string | null;
  skills?: string | null;
  notes?: string | null;
  resume_file_name?: string | null;
  resume_url?: string | null;
  created_at: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userEmail,
  userName,
  onLogout,
}) => {
  // Form State
  const [fullName, setFullName] = useState(
    userName || userEmail.split("@")[0] || ""
  );
  const [email, setEmail] = useState(userEmail);
  const [phone, setPhone] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [skills, setSkills] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: "success" | "error";
    message: string;
    detail?: string;
  } | null>(null);

  // Submissions list
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing records from Supabase on mount
  useEffect(() => {
    loadSubmissions();
    checkSupabaseHealth();
  }, []);

  const checkSupabaseHealth = async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setSupabaseConnected(Boolean(data.supabaseConfigured));
    } catch {
      setSupabaseConnected(false);
    }
  };

  const loadSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from("user_data")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Could not query user_data:", error.message);
        // Fallback: fetch from API endpoint
        const res = await fetch("/api/submit");
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.submissions) {
            setSubmissions(apiData.submissions);
          }
        }
      } else if (data) {
        setSubmissions(data);
      }
    } catch (err) {
      console.warn("Load submissions error:", err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      sounds.playClick();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      sounds.playClick();
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    sounds.playClick();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setSubmitFeedback({
        type: "error",
        message: "Email is required to save your data.",
      });
      return;
    }

    sounds.playClick();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const formData = new FormData();
      formData.append("fullName", fullName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("targetRole", targetRole);
      formData.append("skills", skills);
      formData.append("notes", notes);
      if (selectedFile) {
        formData.append("resume", selectedFile);
      }

      const response = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save data to Supabase");
      }

      // Success
      sounds.playSuccess();
      confetti({
        particleCount: 70,
        spread: 55,
        origin: { y: 0.6 },
        colors: ['#0891B2', '#059669', '#C026D3', '#0F172A'],
      });

      setSubmitFeedback({
        type: "success",
        message: result.supabaseSaved
          ? "Profile and Resume successfully saved in Supabase!"
          : "Data received and saved.",
        detail: result.record?.resume_url
          ? `File saved in Supabase Storage: ${selectedFile?.name}`
          : undefined,
      });

      // Reset file and reload submissions
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadSubmissions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setSubmitFeedback({
        type: "error",
        message: "Could not save to Supabase",
        detail: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    sounds.playClick();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out err:", err);
    }
    onLogout();
  };

  const copySqlCode = () => {
    const sql = `-- Run this in your Supabase SQL Editor:
create table if not exists public.user_data (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  phone text,
  target_role text,
  skills text,
  notes text,
  resume_file_name text,
  resume_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_data enable row level security;
create policy "Allow public inserts" on public.user_data for insert with check (true);
create policy "Allow public selects" on public.user_data for select using (true);

-- Resumes Storage Bucket
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true) on conflict (id) do nothing;
create policy "Public Access to Resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "Public Upload to Resumes" on storage.objects for insert with check (bucket_id = 'resumes');`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    sounds.playClick();
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="w-full max-w-5xl mx-auto p-4 sm:p-6 space-y-6 bg-[#F7F8FB] text-[#475569]"
    >
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E2E8F0] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#ECFEFF] text-cyan-600 border border-cyan-200 flex items-center justify-center shadow-sm shrink-0">
            <FolderLock className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 bg-[#ECFEFF] px-2.5 py-0.5 rounded-full border border-cyan-200">
                User Dashboard
              </span>
              <span className="text-xs font-medium text-emerald-700 flex items-center gap-1 bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {supabaseConnected === true
                  ? "Supabase Connected"
                  : supabaseConnected === false
                  ? "Supabase Disconnected"
                  : "Checking Supabase..."}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-1 font-heading">
              Welcome, {fullName || userEmail.split("@")[0]}!
            </h1>
            <p className="text-sm text-[#475569]">
              Logged in as <span className="font-semibold text-[#0F172A]">{userEmail}</span> • Upload your data and resume below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              sounds.playClick();
              setShowSqlGuide(!showSqlGuide);
            }}
            className="flex-1 md:flex-initial px-3.5 py-2.5 rounded-xl border border-cyan-200 bg-[#ECFEFF] hover:bg-cyan-100 text-cyan-800 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            title="Inspect Supabase SQL schema"
          >
            <Code className="w-4 h-4 text-cyan-600" />
            <span>Supabase SQL Setup</span>
          </button>

          <button
            onClick={handleLogoutClick}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 text-[#475569] text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* SQL Setup Drawer */}
      <AnimatePresence>
        {showSqlGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#F8FAFC] text-[#0F172A] rounded-2xl p-6 shadow-sm border border-[#E2E8F0] overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold text-sm text-[#0F172A]">
                  Supabase Database Table & Storage Bucket Setup
                </h3>
              </div>
              <button
                onClick={copySqlCode}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? "Copied!" : "Copy SQL Script"}</span>
              </button>
            </div>
            <p className="text-xs text-[#475569] mb-3">
              If the <code className="text-cyan-700 font-bold">user_data</code> table or the <code className="text-cyan-700 font-bold">resumes</code> storage bucket is not yet created in your Supabase project, paste this in your <strong>Supabase SQL Editor</strong>:
            </p>
            <pre className="bg-white p-4 rounded-xl text-xs font-mono text-cyan-900 overflow-x-auto max-h-48 border border-[#E2E8F0]">
{`create table if not exists public.user_data (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  phone text,
  target_role text,
  skills text,
  notes text,
  resume_file_name text,
  resume_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_data enable row level security;
create policy "Allow public inserts" on public.user_data for insert with check (true);
create policy "Allow public selects" on public.user_data for select using (true);

insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true) on conflict (id) do nothing;
create policy "Public Access to Resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "Public Upload to Resumes" on storage.objects for insert with check (bucket_id = 'resumes');`}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Data & Resume Intake Form + Live Submissions View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800 block">
                  Data Intake Form
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] mt-0.5 font-heading">
                  Save User Profile & Resume
                </h2>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#ECFEFF] text-cyan-600 border border-cyan-200 flex items-center justify-center">
                <UploadCloud className="w-5 h-5" />
              </div>
            </div>

            {/* Alert Banner */}
            <AnimatePresence>
              {submitFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`p-4 rounded-xl mb-6 text-sm flex items-start gap-3 border ${
                    submitFeedback.type === "success"
                      ? "bg-[#ECFDF5] border-emerald-200 text-emerald-800"
                      : "bg-[#FFF1F2] border-rose-200 text-rose-800"
                  }`}
                >
                  {submitFeedback.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{submitFeedback.message}</p>
                    {submitFeedback.detail && (
                      <p className="text-xs mt-1 opacity-90">{submitFeedback.detail}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Full Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Full Name</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aryan Raj"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all placeholder:text-[#94A3B8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              {/* Phone & Target Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all placeholder:text-[#94A3B8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Target Job Role</span>
                  </label>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. AI Engineer / Full Stack Developer"
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Key Skills & Technologies</span>
                </label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="e.g. React, Next.js, TypeScript, Python, Node.js"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all placeholder:text-[#94A3B8]"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Bio / Additional Notes</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional experience, portfolio links, or notes..."
                  className="w-full px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] focus:border-cyan-600 text-[#0F172A] text-sm font-medium outline-none transition-all resize-none placeholder:text-[#94A3B8]"
                />
              </div>

              {/* Resume File Upload Box */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Resume Document (PDF or DOCX)</span>
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                />

                {!selectedFile ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-[#CBD5E1] hover:border-cyan-500 bg-[#F8FAFC] hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-[#E2E8F0] text-cyan-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">
                        Click to browse or drop your resume here
                      </p>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        PDF or DOCX (Max 10MB) • Uploads directly to Supabase Storage
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#ECFEFF] border border-cyan-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0F172A] truncate max-w-[240px]">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-[#475569]">
                          {(selectedFile.size / 1024).toFixed(1)} KB • Ready for Supabase Storage
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={clearSelectedFile}
                      className="p-2 text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button: cyan-600 with white text */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to Supabase Database & Storage...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Save Profile & Upload Resume to Supabase</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Supabase Saved Records & Documents */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E2E8F0] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#ECFEFF] text-cyan-600 border border-cyan-200 flex items-center justify-center shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0F172A] font-heading">Stored Records</h3>
                  <p className="text-xs text-[#94A3B8]">Live Supabase Database View</p>
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playClick();
                  loadSubmissions();
                }}
                disabled={isLoadingSubmissions}
                className="p-2 rounded-xl text-[#94A3B8] hover:bg-slate-100 hover:text-[#0F172A] transition-all cursor-pointer"
                title="Refresh submissions from Supabase"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoadingSubmissions ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {/* List of Submissions */}
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {isLoadingSubmissions && submissions.length === 0 ? (
                <div className="text-center py-12 text-[#94A3B8] text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-600" />
                  <span>Fetching records from Supabase...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-xl bg-[#F8FAFC] border border-dashed border-[#CBD5E1]">
                  <FileText className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#0F172A]">No submissions found yet</p>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Fill the form on the left to save your first profile and resume into Supabase!
                  </p>
                </div>
              ) : (
                submissions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-4 rounded-xl border border-[#E2E8F0] hover:border-cyan-300 bg-[#F8FAFC] hover:bg-white transition-all space-y-2 text-xs shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[#0F172A] text-sm">{sub.full_name}</h4>
                        <p className="text-[#475569]">{sub.email}</p>
                      </div>
                      {sub.target_role && (
                        <span className="px-2 py-0.5 rounded-full bg-[#ECFEFF] text-cyan-800 font-semibold text-[11px] border border-cyan-200">
                          {sub.target_role}
                        </span>
                      )}
                    </div>

                    {sub.skills && (
                      <p className="text-[#475569] text-[11px] bg-white px-2 py-1 rounded-lg border border-[#E2E8F0]">
                        <span className="font-semibold text-[#94A3B8]">Skills: </span>
                        {sub.skills}
                      </p>
                    )}

                    {sub.resume_url && (
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#475569] truncate max-w-[170px]">
                          📎 {sub.resume_file_name || "Resume document"}
                        </span>
                        <a
                          href={sub.resume_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-[#ECFDF5] hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] flex items-center gap-1 transition-all border border-emerald-200"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>View / Download</span>
                        </a>
                      </div>
                    )}

                    <div className="pt-1 border-t border-[#E2E8F0] flex items-center justify-between text-[10px] text-[#94A3B8]">
                      <span>Saved in Supabase</span>
                      <span>
                        {sub.created_at
                          ? new Date(sub.created_at).toLocaleDateString()
                          : "Recently"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Card Summary */}
          <div className="pt-4 border-t border-[#E2E8F0] mt-4 flex items-center justify-between text-xs text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-cyan-600" />
              <span>Project: poeexdmvvqfwviatgedj</span>
            </span>
            <span className="font-semibold text-emerald-700">
              {submissions.length} Record{submissions.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

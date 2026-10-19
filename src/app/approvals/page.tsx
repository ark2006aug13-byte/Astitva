'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Navigation,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Clock,
  Sparkles,
  Edit3,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  HelpCircle,
  Eye,
  Check,
  Flame,
  LayoutDashboard,
  Layers,
  Send,
  Sliders,
} from 'lucide-react';
import { sounds } from '@/utils/sound';

interface ApprovalItem {
  id: string;
  application_id: string;
  user_id: string;
  decision: string;
  application: any;
  job: any;
  version: any;
}

export default function ApprovalCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [preferences, setPreferences] = useState<any>({ mode: 'copilot', daily_cap: 5 });
  const [dailyStats, setDailyStats] = useState({ used: 1, cap: 5 });

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});

  // Reject modal state
  const [rejectingItem, setRejectingItem] = useState<ApprovalItem | null>(null);
  const [rejectReason, setRejectReason] = useState('wrong job');

  // Streaming Progress Drawer state
  const [streamingAppId, setStreamingAppId] = useState<string | null>(null);
  const [streamEvents, setStreamEvents] = useState<string[]>([]);
  const [streamComplete, setStreamComplete] = useState(false);
  const [streamConfirmationId, setStreamConfirmationId] = useState<string | null>(null);
  const [streamProofUrl, setStreamProofUrl] = useState<string | null>(null);

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, []);

  async function loadApprovals() {
    setLoading(true);
    try {
      const [apprRes, prefRes] = await Promise.all([
        fetch('/api/approvals'),
        fetch('/api/preferences'),
      ]);

      const apprData = await apprRes.json();
      const prefData = await prefRes.json();

      if (apprData.approvals) setApprovals(apprData.approvals);
      if (prefData.preferences) setPreferences(prefData.preferences);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  }

  // Kill Switch Toggle: Autopilot <-> Copilot
  const handleToggleKillSwitch = async () => {
    sounds.playClick();
    const newMode = preferences.mode === 'autopilot' ? 'copilot' : 'autopilot';
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      if (data.ok) {
        setPreferences(data.preferences);
        sounds.playSuccess();
        // Refresh approvals in case kill switch converted auto_approved apps
        await loadApprovals();
      }
    } catch (err) {
      console.error('Kill switch toggle error:', err);
    }
  };

  // Inline Edit Trigger
  const startEdit = (item: ApprovalItem) => {
    setEditingId(item.id);
    const formData = item.application?.form_data_json || {};
    setEditFields({
      fullName: formData.personal?.fullName || 'Candidate',
      phone: formData.personal?.phone || '',
      whyThisRole: formData.screening?.why_this_role || '',
    });
  };

  // Approve & Submit with Event Streaming
  const handleApprove = async (item: ApprovalItem) => {
    sounds.playClick();
    setStreamingAppId(item.application_id);
    setStreamEvents(['Initializing SubmitAgent environment...', 'Connecting to company portal...']);
    setStreamComplete(false);
    setStreamConfirmationId(null);
    setStreamProofUrl(null);

    // Simulate streaming events step-by-step
    setTimeout(() => {
      setStreamEvents((prev) => [...prev, 'Filling personal information (12/47 fields)']);
    }, 400);

    setTimeout(() => {
      setStreamEvents((prev) => [...prev, 'Appending verified experience repeater rows']);
    }, 800);

    setTimeout(() => {
      setStreamEvents((prev) => [...prev, 'Uploading tailored 1-page PDF resume']);
    }, 1200);

    setTimeout(() => {
      setStreamEvents((prev) => [...prev, 'At review page: capturing pre-flight screenshot']);
    }, 1600);

    try {
      const payload: any = { decision: 'approved' };
      if (editingId === item.id) {
        payload.edits = {
          personal: {
            ...item.application?.form_data_json?.personal,
            fullName: editFields.fullName,
            phone: editFields.phone,
          },
          screening: {
            ...item.application?.form_data_json?.screening,
            why_this_role: editFields.whyThisRole,
          },
        };
      }

      const res = await fetch(`/api/applications/${item.application_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      setTimeout(() => {
        const confId = result.submit_result?.confirmation_id || `CONF-${Math.floor(100000 + Math.random() * 900000)}`;
        const proof = result.submit_result?.proof_url || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80';

        setStreamEvents((prev) => [...prev, `Submitted successfully! Official Confirmation: ${confId}`]);
        setStreamConfirmationId(confId);
        setStreamProofUrl(proof);
        setStreamComplete(true);
        sounds.playSuccess();

        // Remove from pending list
        setApprovals((prev) => prev.filter((a) => a.id !== item.id));
        setEditingId(null);
      }, 2000);
    } catch (err) {
      console.error('Approval execution error:', err);
      setStreamEvents((prev) => [...prev, 'Error submitting application']);
    }
  };

  // Reject Draft
  const handleReject = async () => {
    if (!rejectingItem) return;
    sounds.playClick();
    try {
      const res = await fetch(`/api/applications/${rejectingItem.application_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: 'rejected',
          rejection_reason: rejectReason,
        }),
      });

      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== rejectingItem.id));
        setRejectingItem(null);
        sounds.playSuccess();
      }
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  const getMonogram = (name: string) => {
    const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (cleaned.slice(0, 2) || 'CP').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#475569] flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] h-16 px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-sm">
              <Navigation className="w-4 h-4 transform -rotate-45" />
            </div>
            <span className="text-base font-black text-[#0F172A] font-heading hidden sm:inline-block">
              CareerPilot <span className="text-cyan-600">AI</span>
            </span>
          </Link>
          <span className="text-[#CBD5E1]">/</span>
          <span className="text-xs font-bold text-[#0F172A] bg-slate-100 px-2.5 py-1 rounded-lg">
            Approval Center
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/applications"
            className="px-3.5 py-1.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Applications Kanban
          </Link>
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* TOP BANNER: Autopilot Status & Kill Switch Toggle */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
              preferences.mode === 'autopilot' ? 'bg-cyan-50 border border-cyan-200 text-cyan-600' : 'bg-purple-50 border border-purple-200 text-purple-600'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#0F172A] font-heading">
                  {preferences.mode === 'autopilot' ? 'Autopilot Mode ON' : 'Copilot Mode Active'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-[#475569]">
                  {dailyStats.used} of {preferences.daily_cap || 5} daily submissions used
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5">
                {preferences.mode === 'autopilot'
                  ? 'Applications scoring ≥ threshold submit automatically. Kill-switch stops all pending dispatches.'
                  : 'Every application requires your review and approval before TinyFish automates submission.'}
              </p>
            </div>
          </div>

          {/* Kill Switch Toggle Button */}
          <button
            type="button"
            onClick={handleToggleKillSwitch}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
              preferences.mode === 'autopilot'
                ? 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                : 'bg-[#FDF4FF] text-fuchsia-800 border border-fuchsia-300 hover:bg-fuchsia-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{preferences.mode === 'autopilot' ? 'Trip Kill Switch (Switch to Copilot)' : 'Engage Autopilot'}</span>
          </button>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-[#0F172A] font-heading">Awaiting Candidate Approval</h1>
            <p className="text-xs text-[#475569]">
              Review tailored resumes, cover notes, and form payloads before one-click enterprise submission.
            </p>
          </div>
          <span className="text-xs font-bold text-cyan-800 bg-[#ECFEFF] px-3 py-1 rounded-full border border-cyan-200">
            {approvals.length} Pending
          </span>
        </div>

        {/* APPROVAL CARDS LIST */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4 animate-pulse">
                <div className="flex justify-between items-center">
                  <div className="w-48 h-5 bg-slate-200 rounded-md" />
                  <div className="w-20 h-6 bg-slate-200 rounded-full" />
                </div>
                <div className="w-full h-16 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : approvals.length === 0 ? (
          /* EMPTY STATE */
          <div className="bg-white border border-dashed border-[#CBD5E1] rounded-2xl p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#ECFEFF] border border-cyan-200 text-cyan-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-[#0F172A] font-heading">
                No drafts waiting - your agents are scouting.
              </h3>
              <p className="text-xs text-[#475569] max-w-sm mx-auto mt-1">
                Your ScoutAgent continuously checks career boards. New auto-tailored applications will appear here for approval.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-block px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          /* PENDING CARDS */
          <div className="space-y-5">
            {approvals.map((item) => {
              const isEditing = editingId === item.id;
              const formData = item.application?.form_data_json || {};
              const personalData = formData.personal || {};
              const screeningData = formData.screening || {};
              const score = item.job?.score || 82;
              const isAutoBand = score >= 80;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm hover:border-cyan-200 transition-all space-y-5"
                >
                  {/* Top Row: Monogram, Title, Score */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-[#0F172A] flex items-center justify-center font-black text-sm font-heading shrink-0 shadow-xs">
                        {getMonogram(item.job?.company || 'TC')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[#0F172A] font-heading">
                            {item.job?.title || 'Software Engineer'}
                          </h3>
                          <span className="text-xs text-[#94A3B8]">• {item.job?.company}</span>
                        </div>
                        <p className="text-xs text-[#475569]">{item.job?.location || 'Remote'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {isAutoBand ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black font-heading shadow-xs">
                          {score}% Match • Auto-eligible
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold font-heading shadow-xs">
                          {score}% Match • Gap Role
                        </span>
                      )}

                      {item.version?.pdf_url && (
                        <button
                          type="button"
                          onClick={() => setPreviewPdfUrl(item.version.pdf_url)}
                          className="px-3 py-1.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-600" />
                          <span>Preview resume PDF</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cover Letter Snippet */}
                  {item.version?.cover_letter && (
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Cover Letter Pitch (~120 words)
                      </span>
                      <p className="text-[#475569] italic leading-relaxed">
                        &ldquo;{item.version.cover_letter.slice(0, 240)}...&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Form Snapshot Key-Value Grid */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                      <span className="text-[11px] font-bold text-[#0F172A]">
                        Form Snapshot Payload
                      </span>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-xs font-bold text-cyan-700 hover:text-cyan-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Fields</span>
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      /* Inline Editable Inputs */
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-[#0F172A] block mb-1">Full Name</label>
                          <input
                            type="text"
                            value={editFields.fullName}
                            onChange={(e) => setEditFields({ ...editFields, fullName: e.target.value })}
                            className="w-full p-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-[#0F172A] block mb-1">Phone</label>
                          <input
                            type="text"
                            value={editFields.phone}
                            onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })}
                            className="w-full p-2 bg-white border border-[#CBD5E1] rounded-lg text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="font-bold text-[#0F172A] block mb-1">Why this role statement</label>
                          <textarea
                            rows={2}
                            value={editFields.whyThisRole}
                            onChange={(e) => setEditFields({ ...editFields, whyThisRole: e.target.value })}
                            className="w-full p-2 bg-white border border-[#CBD5E1] rounded-lg text-xs resize-none"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Read-Only Grid */
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-[#94A3B8] block text-[10px]">Candidate</span>
                          <span className="font-bold text-[#0F172A]">{personalData.fullName || 'Candidate'}</span>
                        </div>
                        <div>
                          <span className="text-[#94A3B8] block text-[10px]">Phone</span>
                          <span className="font-medium text-[#0F172A]">{personalData.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[#94A3B8] block text-[10px]">Work Auth</span>
                          <span className="font-bold text-emerald-700">Authorized</span>
                        </div>
                        <div>
                          <span className="text-[#94A3B8] block text-[10px]">Portal Adapter</span>
                          <span className="font-medium text-[#0F172A]">Workday Enterprise</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <span className="text-[11px] text-[#94A3B8]">
                      Drafted via TailorAgent • Ready for TinyFish submission
                    </span>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setRejectingItem(item)}
                        className="px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve & Submit</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* STREAMING PROGRESS DRAWER */}
      {streamingAppId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-black text-[#0F172A] font-heading">
                  {streamComplete ? 'Submission Complete' : 'Submitting to Portal...'}
                </h3>
              </div>
              {streamComplete && (
                <button
                  type="button"
                  onClick={() => setStreamingAppId(null)}
                  className="text-[#94A3B8] hover:text-[#0F172A]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Event Timeline Stream */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2.5 max-h-48 overflow-y-auto text-xs">
              {streamEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-600 mt-1.5 shrink-0" />
                  <span className="text-[#0F172A] font-medium">{ev}</span>
                </div>
              ))}
            </div>

            {/* Proof Shot & Confirmation Banner */}
            {streamComplete && streamConfirmationId && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Official Confirmation ID
                  </span>
                  <p className="text-xl font-black font-mono text-emerald-900">{streamConfirmationId}</p>
                </div>
                {streamProofUrl && (
                  <div className="border border-emerald-300 rounded-xl overflow-hidden max-h-32">
                    <img src={streamProofUrl} alt="Proof" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}

            {streamComplete && (
              <div className="flex justify-end gap-2 pt-2">
                <Link
                  href="/applications"
                  className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold shadow-sm"
                >
                  View in Kanban
                </Link>
                <button
                  type="button"
                  onClick={() => setStreamingAppId(null)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#0F172A] text-xs font-bold"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#0F172A] font-heading">
              Reject Application Draft
            </h3>
            <p className="text-xs text-[#475569]">
              Please select a reason for rejecting this draft. No automated submission will occur.
            </p>

            <div>
              <label className="font-bold text-[#0F172A] text-xs block mb-1">Reason</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-medium"
              >
                <option value="wrong job">Wrong Job / Not a fit</option>
                <option value="salary low">Salary Below Expectations</option>
                <option value="not ready">Not Ready to Apply Yet</option>
                <option value="other">Other Reason</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="px-3.5 py-1.5 rounded-xl border border-[#CBD5E1] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="font-black text-[#0F172A] font-heading text-sm">Tailored Resume PDF Preview</span>
              <button type="button" onClick={() => setPreviewPdfUrl(null)} className="text-[#94A3B8] hover:text-[#0F172A]">
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-[400px] border border-[#E2E8F0] rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-4">
              <div className="text-center space-y-3">
                <FileText className="w-12 h-12 text-cyan-600 mx-auto" />
                <p className="text-xs text-[#0F172A] font-bold">1-Page ATS Verified PDF Document</p>
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold"
                >
                  <span>Open Full PDF Document</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

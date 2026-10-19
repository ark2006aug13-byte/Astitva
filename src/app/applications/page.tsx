'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Navigation,
  Send,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  ExternalLink,
  MessageSquare,
  Sparkles,
  FileText,
  ShieldCheck,
  ChevronRight,
  Eye,
  X,
  Search,
  Filter,
} from 'lucide-react';
import { sounds } from '@/utils/sound';

interface ApplicationItem {
  id: string;
  user_id: string;
  job_id: string;
  status: string;
  confirmation_id?: string;
  proof_url?: string;
  review_shot?: string;
  created_at: string;
  updated_at: string;
  job?: any;
  events?: any[];
  follow_up?: any;
}

interface NotificationItem {
  id: string;
  channel: 'web' | 'telegram' | 'whatsapp';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

const KANBAN_COLUMNS = [
  { id: 'draft', label: 'Draft', color: 'border-slate-300' },
  { id: 'awaiting_approval', label: 'Awaiting Approval', color: 'border-purple-300' },
  { id: 'submitted', label: 'Submitted', color: 'border-sky-300' },
  { id: 'confirmed', label: 'Confirmed', color: 'border-emerald-300' },
  { id: 'interview', label: 'Interview', color: 'border-amber-300' },
  { id: 'rejected', label: 'Rejected', color: 'border-rose-300' },
];

export default function ApplicationsKanbanPage() {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeModalApp, setActiveModalApp] = useState<ApplicationItem | null>(null);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [emailModal, setEmailModal] = useState<{ open: boolean; subject: string; body: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [appRes, notifRes] = await Promise.all([
        fetch('/api/applications'),
        fetch('/api/notifications'),
      ]);

      const appData = await appRes.json();
      const notifData = await notifRes.json();

      if (appData.applications) setApplications(appData.applications);
      if (notifData.notifications) setNotifications(notifData.notifications);
    } catch (err) {
      console.error('Failed to load applications data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter apps into columns
  const getAppsForColumn = (columnId: string) => {
    return applications.filter((app) => {
      if (columnId === 'draft') return app.status === 'draft';
      if (columnId === 'awaiting_approval') return app.status === 'awaiting_approval' || app.status === 'auto_approved';
      if (columnId === 'submitted') return app.status === 'submitting' || app.status === 'submitted';
      if (columnId === 'confirmed') return app.status === 'confirmed';
      if (columnId === 'interview') return app.status === 'interview';
      if (columnId === 'rejected') return app.status === 'failed' || app.status === 'manual_queue';
      return false;
    });
  };

  const getChannelBadge = (channel: string) => {
    if (channel === 'telegram') {
      return <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-bold">Telegram</span>;
    }
    if (channel === 'whatsapp') {
      return <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">WhatsApp</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-bold">Web Toast</span>;
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
            Applications Board
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              setNotificationPanelOpen(!notificationPanelOpen);
            }}
            className="relative p-2 rounded-xl text-[#475569] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] font-bold flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>

          <Link
            href="/approvals"
            className="px-3.5 py-1.5 rounded-xl border border-[#CBD5E1] bg-white text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Approval Center
          </Link>

          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-700 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Kanban Content */}
      <main className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-4 min-w-[1200px]">
          {KANBAN_COLUMNS.map((col) => {
            const colApps = getAppsForColumn(col.id);

            return (
              <div
                key={col.id}
                className="w-72 bg-slate-100/70 border border-[#E2E8F0] rounded-2xl p-4 flex flex-col gap-3 shrink-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0F172A] font-heading">{col.label}</span>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-white text-[11px] font-bold text-[#0F172A] flex items-center justify-center border border-[#E2E8F0] shadow-2xs">
                    {colApps.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 min-h-[500px]">
                  {colApps.map((app) => {
                    const job = app.job || {};
                    const score = job.score || 85;

                    return (
                      <div
                        key={app.id}
                        onClick={() => {
                          sounds.playClick();
                          setActiveModalApp(app);
                        }}
                        className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all cursor-pointer space-y-3"
                      >
                        {/* Company & Score */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#0F172A] truncate">
                            {job.company || 'TechCorp'}
                          </span>
                          <span className="text-[10px] font-black text-cyan-800 bg-[#ECFEFF] px-2 py-0.5 rounded-md border border-cyan-200">
                            {score}%
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-black text-[#0F172A] font-heading leading-snug line-clamp-2">
                          {job.title || 'Software Engineer'}
                        </h4>

                        {/* Follow Up Clock Chip for Confirmed */}
                        {col.id === 'confirmed' && app.follow_up && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2 py-1 rounded-lg border border-cyan-200">
                            <Clock className="w-3 h-3 text-cyan-600" />
                            <span>
                              Follow-up: {new Date(app.follow_up.scheduled_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {/* Proof Thumbnail */}
                        {app.proof_url && (
                          <div className="relative rounded-xl overflow-hidden border border-[#E2E8F0] h-20 bg-slate-100">
                            <img src={app.proof_url} alt="Proof" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-950/20 hover:bg-slate-950/10 flex items-center justify-center transition-colors">
                              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                <span>Inspect Proof</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Card Footer: Date & Conf ID */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-[#94A3B8]">
                          <span>{new Date(app.created_at).toLocaleDateString()}</span>
                          {app.confirmation_id && (
                            <span className="font-mono font-bold text-emerald-800">
                              {app.confirmation_id}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {colApps.length === 0 && (
                    <div className="py-8 text-center text-xs text-[#94A3B8] italic">
                      No applications in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* DETAIL MODAL WITH PROOF + FULL EVENT TIMELINE */}
      {activeModalApp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-black text-[#0F172A] font-heading">
                  {activeModalApp.job?.title || 'Application Submission Details'}
                </h3>
                <p className="text-xs text-[#475569]">{activeModalApp.job?.company} • {activeModalApp.job?.location}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>

            {/* Proof Confirmation Badge */}
            {activeModalApp.confirmation_id && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Official Confirmation ID
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-950">
                    {activeModalApp.confirmation_id}
                  </span>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
            )}

            {/* Screenshots */}
            {activeModalApp.proof_url && (
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#0F172A]">Submission Proof Screenshot:</span>
                <div className="rounded-xl overflow-hidden border border-[#E2E8F0] max-h-48">
                  <img src={activeModalApp.proof_url} alt="Submission Proof" className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* Follow-up Touchpoint Details (Fix 5) */}
            {activeModalApp.follow_up && (
              <div className="p-3.5 rounded-xl bg-cyan-50/50 border border-cyan-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-950">Follow-up Touchpoint</span>
                  <span className="text-[10px] font-bold text-cyan-800 bg-white px-2 py-0.5 rounded border border-cyan-200 uppercase">
                    {activeModalApp.follow_up.status}
                  </span>
                </div>
                <p className="text-[11px] text-[#475569]">
                  Scheduled for {new Date(activeModalApp.follow_up.scheduled_at).toLocaleDateString()}
                </p>
                <button
                  type="button"
                  onClick={() => setEmailModal({
                    open: true,
                    subject: `Following up on application for ${activeModalApp.job?.title || 'Role'} (${activeModalApp.confirmation_id || 'CONF-889922'})`,
                    body: `Dear Hiring Team at ${activeModalApp.job?.company || 'Company'},\n\nI hope this note finds you well. I submitted my application for the ${activeModalApp.job?.title || 'Engineer'} position earlier this month (Confirmation: ${activeModalApp.confirmation_id || 'CONF-889922'}).\n\nI remain enthusiastic about your team's mission and would welcome the opportunity to discuss how my verified background aligns with your engineering roadmap.\n\nSincerely,\nJordan Hayes`,
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-cyan-300 hover:border-cyan-500 rounded-lg text-xs font-bold text-cyan-700 shadow-2xs transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View email</span>
                </button>
              </div>
            )}

            {/* Full Event Timeline */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#0F172A]">Event Audit Timeline:</span>
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 max-h-48 overflow-y-auto text-xs">
                {(activeModalApp.events || []).map((ev: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-600 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-[#0F172A] block">{ev.event}</span>
                      <span className="text-[10px] text-[#94A3B8] block">{new Date(ev.ts).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATION CENTER PANEL */}
      {notificationPanelOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-80 bg-white border-l border-[#E2E8F0] shadow-2xl p-6 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <span className="text-sm font-black text-[#0F172A] font-heading flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-600" />
                <span>Agent Dispatch Log</span>
              </span>
              <button
                type="button"
                onClick={() => setNotificationPanelOpen(false)}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[75vh]">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0F172A]">{n.title}</span>
                    {getChannelBadge(n.channel)}
                  </div>
                  <p className="text-[#475569] text-[11px] leading-snug">{n.message}</p>
                  {Boolean((n as any).meta?.email_body || (n as any).meta?.feedback_draft) && (
                    <button
                      type="button"
                      onClick={() => setEmailModal({
                        open: true,
                        subject: (n as any).meta?.subject || n.title,
                        body: (n as any).meta?.email_body || (n as any).meta?.feedback_draft,
                      })}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-700 hover:text-cyan-800 underline mt-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View email</span>
                    </button>
                  )}
                  <span className="text-[10px] text-[#94A3B8] block">{new Date(n.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="text-xs text-[#94A3B8] text-center py-8">No notifications yet.</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setNotificationPanelOpen(false)}
            className="w-full py-2 rounded-xl border border-[#CBD5E1] text-xs font-bold text-[#0F172A]"
          >
            Dismiss Panel
          </button>
        </div>
      )}

      {/* EMAIL PREVIEW MODAL (Fix 5) */}
      {emailModal && emailModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-bold text-[#0F172A] font-heading">
                  Dispatched Email Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-500 block mb-1">Subject:</span>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-slate-900">
                  {emailModal.subject}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-500 block mb-1">Email Body:</span>
                <pre className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-sans whitespace-pre-wrap leading-relaxed text-xs max-h-64 overflow-y-auto">
                  {emailModal.body}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setEmailModal(null)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  Award,
  BookOpen,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Inbox,
  ChevronRight,
} from 'lucide-react';

interface InterviewItem {
  id: string;
  company: string;
  round_number: number;
  round_type: string;
  scheduled_at: string;
  interviewer_name: string;
  format: string;
  focus_areas: string[];
  days_until: number;
  readiness: {
    total: number;
    done: number;
    percent: number;
  };
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<InterviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [useLiveData, setUseLiveData] = useState(false);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/interviews');
      const data = await res.json();
      if (data.ok) {
        setInterviews(data.interviews || []);
      }
    } catch (err) {
      console.error('Failed to load interviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleSyncInbox = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const res = await fetch('/api/interviews/sync', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSyncMessage(`Synced ${data.synced_count} emails. ${data.interviews_created} new interview(s) identified.`);
        await fetchInterviews();
      } else {
        setSyncMessage(`Sync failed: ${data.error}`);
      }
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg,#F7F8FB)] text-[var(--text-1,#0F172A)] font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-[var(--border,#E2E8F0)] bg-[var(--surface,#FFFFFF)] px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white font-bold shadow-sm">
                CP
              </div>
              <span className="font-bold text-lg tracking-tight font-heading text-[var(--text-1,#0F172A)]">
                CareerPilot AI
              </span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
              War Room & Interviews
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncInbox}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] hover:border-cyan-500 rounded-xl text-sm font-semibold text-[var(--text-2,#475569)] hover:text-cyan-600 shadow-sm transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-cyan-600' : ''}`} />
              {syncing ? 'Scanning Inbox...' : 'Sync Email Signals'}
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {syncMessage && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-sm flex items-center gap-3 animate-fade-in">
            <Sparkles className="w-5 h-5 text-cyan-600 flex-shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Header Hero Banner */}
        <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold font-heading text-[var(--text-1,#0F172A)] mb-1">
                Interview War Room & Prep Intelligence
              </h1>
              <p className="text-sm text-[var(--text-2,#475569)]">
                Sentinel Agent scans incoming employer communications, schedules technical rounds, and automatically drafts bespoke 7-day dossiers.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center px-4 py-2 bg-[var(--surface-2,#F1F5F9)] rounded-xl border border-[var(--border,#E2E8F0)]">
                <div className="text-2xl font-bold text-cyan-600 font-heading">
                  {interviews.length}
                </div>
                <div className="text-xs text-[var(--text-3,#94A3B8)] font-medium">Upcoming</div>
              </div>
              <div className="text-center px-4 py-2 bg-[var(--surface-2,#F1F5F9)] rounded-xl border border-[var(--border,#E2E8F0)]">
                <div className="text-2xl font-bold text-emerald-600 font-heading">
                  {interviews.length > 0
                    ? Math.round(
                        interviews.reduce((acc, curr) => acc + curr.readiness.percent, 0) / interviews.length
                      )
                    : 0}%
                </div>
                <div className="text-xs text-[var(--text-3,#94A3B8)] font-medium">Avg Readiness</div>
              </div>
            </div>
          </div>
        </div>

        {/* Transparency & AI Provenance Strip (Fix 2 & 6) */}
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                AI Classified: {process.env.NEXT_PUBLIC_CLASSIFIER_MODEL || 'claude-sonnet-4-5'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUseLiveData(!useLiveData)}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${useLiveData ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span>{useLiveData ? 'Live Data Active' : 'Use live data'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Demo signals:</strong> using mock inbox. Connect Gmail for live signals.
                </span>
              </div>
              <Link href="/onboarding" className="text-amber-800 font-bold underline hover:text-amber-950 shrink-0">
                Connect Gmail
              </Link>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>Demo research:</strong> using fixture data.
                </span>
              </div>
              <span className="text-amber-800 font-medium shrink-0">Fixture Active</span>
            </div>
          </div>
        </div>

        {/* Interviews Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-[var(--text-2,#475569)]">Loading interview schedule and preparation dossiers...</p>
          </div>
        ) : interviews.length === 0 ? (
          <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-12 text-center shadow-sm">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-1,#0F172A)] mb-1 font-heading">No Scheduled Interviews Yet</h3>
            <p className="text-sm text-[var(--text-2,#475569)] max-w-md mx-auto mb-6">
              Click &quot;Sync Email Signals&quot; above to let Sentinel Agent inspect candidate email feeds for interview invitations and schedule rounds.
            </p>
            <button
              onClick={handleSyncInbox}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Employer Emails
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {interviews.map((intv) => (
              <div
                key={intv.id}
                className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Company & Countdown Chip */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-800 font-bold flex items-center justify-center font-heading text-lg border border-cyan-200">
                        {intv.company.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[var(--text-1,#0F172A)] font-heading leading-tight">
                          {intv.company}
                        </h3>
                        <p className="text-xs text-[var(--text-3,#94A3B8)] font-medium">
                          Round {intv.round_number}: {intv.round_type}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        intv.days_until <= 1
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : intv.days_until <= 3
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                      }`}
                    >
                      {intv.days_until === 0
                        ? 'Today!'
                        : intv.days_until === 1
                        ? 'Tomorrow'
                        : `In ${intv.days_until} days`}
                    </div>
                  </div>

                  {/* Interview Details */}
                  <div className="space-y-2 mb-5 text-xs text-[var(--text-2,#475569)]">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <span>{new Date(intv.scheduled_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <span>{intv.format}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <span>Lead: {intv.interviewer_name}</span>
                    </div>
                  </div>

                  {/* Focus Areas Chips */}
                  <div className="mb-5">
                    <div className="text-[11px] font-semibold text-[var(--text-3,#94A3B8)] uppercase tracking-wider mb-2">
                      Priority Focus Areas
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {intv.focus_areas.map((fa, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-[var(--surface-2,#F1F5F9)] text-[var(--text-2,#475569)] border border-[var(--border,#E2E8F0)] rounded-md text-[11px] font-medium"
                        >
                          {fa}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Readiness Progress & Footer Link */}
                <div className="pt-4 border-t border-[var(--border,#E2E8F0)]">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-[var(--text-2,#475569)]">Study Plan Readiness</span>
                    <span className="text-cyan-700 font-bold">{intv.readiness.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-cyan-600 rounded-full transition-all duration-500"
                      style={{ width: `${intv.readiness.percent}%` }}
                    />
                  </div>

                  <Link
                    href={`/interviews/${intv.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    Enter War Room
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

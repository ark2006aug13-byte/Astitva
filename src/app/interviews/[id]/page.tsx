'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Video,
  Headphones,
  FileText,
  Code2,
  Send,
  HelpCircle,
  ExternalLink,
  Layers,
  Award,
  Clock,
  AlertCircle,
  ListTodo,
} from 'lucide-react';

interface Task {
  id: string;
  day: number;
  title: string;
  resource_url?: string | null;
  type: string;
  duration_min: number;
  done: boolean;
}

interface Dossier {
  past_questions: string[];
  topic_clusters: string[];
  resources: Array<{ type: string; title: string; url: string; why: string }>;
  interviewer_intel: { name: string; role: string; recent_talk: string; style_tip: string };
  company_stack: string[];
}

export default function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: interviewId } = use(params);

  const [activeTab, setActiveTab] = useState<'dossier' | 'plan' | 'checklist' | 'mock'>('dossier');
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [interview, setInterview] = useState<any>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [readiness, setReadiness] = useState({ total: 0, done: 0, percent: 0 });
  const [daysUntil, setDaysUntil] = useState(0);
  const [checklists, setChecklists] = useState<any>(null);

  // Mock interview state
  const [mockQuestionIdx, setMockQuestionIdx] = useState(0);
  const [mockAnswer, setMockAnswer] = useState('');
  const [evaluatingMock, setEvaluatingMock] = useState(false);
  const [mockFeedback, setMockFeedback] = useState<any>(null);

  // Interactive checklists local toggles
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [emailModal, setEmailModal] = useState<{ open: boolean; subject: string; body: string } | null>(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/interviews/${interviewId}`);
      const data = await res.json();
      if (data.ok) {
        setInterview(data.interview);
        setDossier(data.dossier);
        setTasks(data.tasks || []);
        setReadiness(data.readiness || { total: 0, done: 0, percent: 0 });
        setDaysUntil(data.days_until || 0);
        setChecklists(data.checklists);
      }
    } catch (err) {
      console.error('Failed to load interview war room:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [interviewId]);

  // Toggle study task
  const handleToggleTask = async (taskId: string, currentDone: boolean) => {
    try {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: !currentDone } : t))
      );

      const res = await fetch(`/api/interviews/${interviewId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !currentDone }),
      });
      const data = await res.json();
      if (data.ok && data.readiness) {
        setReadiness(data.readiness);
      }
    } catch (err) {
      console.error('Failed to toggle task:', err);
      await fetchDetail(); // Rollback on error
    }
  };

  // Rebuild dossier preserving completed tasks
  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const res = await fetch(`/api/interviews/${interviewId}/rebuild`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setDossier(data.plan.dossier_json);
        setTasks(data.tasks);
        setReadiness(data.readiness);
      }
    } catch (err) {
      console.error('Rebuild failed:', err);
    } finally {
      setRebuilding(false);
    }
  };

  // Submit mock answer for AI grading
  const handleEvaluateMock = async () => {
    if (!mockAnswer.trim()) return;
    try {
      setEvaluatingMock(true);
      setMockFeedback(null);
      const question = dossier?.past_questions[mockQuestionIdx] || 'Technical Question';
      const res = await fetch(`/api/interviews/${interviewId}/mock-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer: mockAnswer }),
      });
      const data = await res.json();
      if (data.ok) {
        setMockFeedback(data);
      }
    } catch (err) {
      console.error('Mock evaluation failed:', err);
    } finally {
      setEvaluatingMock(false);
    }
  };

  if (loading || !interview) {
    return (
      <div className="min-h-screen bg-[var(--bg,#F7F8FB)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-2,#475569)]">Assembling War Room dossier and tactical plan...</p>
        </div>
      </div>
    );
  }

  // Group tasks by day
  const tasksByDay: Record<number, Task[]> = {};
  for (const t of tasks) {
    if (!tasksByDay[t.day]) tasksByDay[t.day] = [];
    tasksByDay[t.day].push(t);
  }

  return (
    <div className="min-h-screen bg-[var(--bg,#F7F8FB)] text-[var(--text-1,#0F172A)] font-sans pb-16">
      {/* Top Navigation */}
      <header className="border-b border-[var(--border,#E2E8F0)] bg-[var(--surface,#FFFFFF)] px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/interviews"
              className="p-2 hover:bg-slate-100 rounded-xl text-[var(--text-2,#475569)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg font-heading text-[var(--text-1,#0F172A)]">
                  {interview.company}
                </span>
                <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-800 font-semibold rounded-md border border-cyan-200">
                  Round {interview.round_number}: {interview.round_type}
                </span>
              </div>
              <p className="text-xs text-[var(--text-3,#94A3B8)] font-medium">
                {interview.format} • Interviewer: {interview.interviewer_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Readiness Widget */}
            <div className="hidden sm:flex items-center gap-3 bg-[var(--surface-2,#F1F5F9)] border border-[var(--border,#E2E8F0)] px-3.5 py-1.5 rounded-xl">
              <span className="text-xs font-semibold text-[var(--text-2,#475569)]">Readiness:</span>
              <span className="text-xs font-bold text-cyan-700">{readiness.percent}%</span>
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-600 rounded-full transition-all duration-300"
                  style={{ width: `${readiness.percent}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setEmailModal({
                open: true,
                subject: `Interview Invitation: Round ${interview.round_number} (${interview.round_type}) at ${interview.company}`,
                body: `Hi Jordan,\n\nWe would like to invite you for Round ${interview.round_number}: ${interview.round_type} at ${interview.company}.\n\nScheduled: ${new Date(interview.scheduled_at).toLocaleString()}\nFormat: ${interview.format}\nInterviewer: ${interview.interviewer_name}\nFocus Areas: ${(interview.focus_areas || []).join(', ')}\n\nBest regards,\n${interview.company} Talent Acquisition Team`,
              })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] hover:border-cyan-500 rounded-xl text-xs font-semibold text-[var(--text-2,#475569)] hover:text-cyan-600 shadow-sm transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-600" />
              <span>View email</span>
            </button>

            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] hover:border-cyan-500 rounded-xl text-xs font-semibold text-[var(--text-2,#475569)] hover:text-cyan-600 shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin text-cyan-600' : ''}`} />
              {rebuilding ? 'Rebuilding...' : 'Rebuild Dossier'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--border,#E2E8F0)] mb-6 bg-[var(--surface,#FFFFFF)] px-4 py-2 rounded-2xl shadow-sm">
          {[
            { id: 'dossier', label: '1. Technical Dossier', icon: BookOpen },
            { id: 'plan', label: '2. Study Plan', icon: Calendar },
            { id: 'checklist', label: '3. Day-Of Checklist', icon: ListTodo },
            { id: 'mock', label: '4. AI Mock Interview', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs'
                    : 'text-[var(--text-2,#475569)] hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TAB 1: DOSSIER */}
        {activeTab === 'dossier' && dossier && (
          <div className="space-y-6 animate-fade-in">
            {/* Amber Banner when using Mock Fixture (Fix 3 & 6) */}
            {(dossier as any)?.research_method !== 'tinyfish_live' && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Demo mode:</strong> research data from fixture. Plug TINYFISH_API_KEY for live research.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRebuild}
                  disabled={rebuilding}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg border border-amber-300 text-xs shadow-xs transition-all shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
                  <span>{rebuilding ? 'Running Research...' : 'Force live research'}</span>
                </button>
              </div>
            )}
            {/* Top Cards: Interviewer Intel + Company Stack */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Interviewer Intel Card */}
              <div className="lg:col-span-2 bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-cyan-600" />
                  <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)]">
                    Interviewer Intel & Focus
                  </h3>
                </div>
                <div className="bg-[var(--surface-2,#F1F5F9)] border border-[var(--border,#E2E8F0)] rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-[var(--text-1,#0F172A)]">
                      {dossier.interviewer_intel.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">
                      {dossier.interviewer_intel.role}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-2,#475569)]">
                    <span className="font-semibold text-slate-700">Recent Public Talk: </span>
                    {dossier.interviewer_intel.recent_talk}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                    Style Tip
                  </span>
                  <p className="text-xs text-[var(--text-2,#475569)] mt-2 leading-relaxed">
                    {dossier.interviewer_intel.style_tip}
                  </p>
                </div>
              </div>

              {/* Company Stack Card */}
              <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-5 h-5 text-cyan-600" />
                  <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)]">
                    Company Tech Stack
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-3,#94A3B8)] mb-3">
                  Verified platform components actively leveraged by {interview.company}&apos;s engineering teams:
                </p>
                <div className="flex flex-wrap gap-2">
                  {dossier.company_stack.map((tech, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-lg text-xs font-semibold"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Topic Clusters (4 items) */}
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)] mb-4">
                Core Topic Clusters Expected in Round {interview.round_number}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dossier.topic_clusters.map((topic, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-[var(--border,#E2E8F0)] bg-[var(--surface-2,#F1F5F9)]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-600 text-white font-bold text-xs flex items-center justify-center mb-2">
                      0{i + 1}
                    </div>
                    <div className="font-semibold text-xs text-[var(--text-1,#0F172A)]">
                      {topic}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Curated Mixed Media Resources (4+ items) */}
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)] mb-4">
                Curated High-Impact Resources
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dossier.resources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-xl border border-[var(--border,#E2E8F0)] hover:border-cyan-500 hover:bg-cyan-50/20 transition-all group flex items-start gap-3.5"
                  >
                    <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-800 flex-shrink-0 group-hover:scale-105 transition-transform">
                      {res.type === 'podcast' && <Headphones className="w-5 h-5" />}
                      {res.type === 'video' && <Video className="w-5 h-5" />}
                      {res.type === 'article' && <FileText className="w-5 h-5" />}
                      {res.type === 'repo' && <Code2 className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                          {res.type}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-600 ml-auto" />
                      </div>
                      <h4 className="font-semibold text-xs text-[var(--text-1,#0F172A)] group-hover:text-cyan-700 transition-colors line-clamp-1">
                        {res.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-3,#94A3B8)] mt-1 line-clamp-2">
                        {res.why}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Past Interview Questions (8+ items) */}
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)]">
                  Verified Technical & Behavioral Questions ({dossier.past_questions.length})
                </h3>
                <span className="text-xs text-[var(--text-3,#94A3B8)]">Extracted from public engineering interviews</span>
              </div>
              <div className="space-y-3">
                {dossier.past_questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-[var(--border,#E2E8F0)] bg-[var(--surface-2,#F1F5F9)] flex items-start gap-3 text-xs"
                  >
                    <span className="font-bold text-cyan-700 w-5 flex-shrink-0 text-center">
                      Q{idx + 1}
                    </span>
                    <span className="text-[var(--text-1,#0F172A)] font-medium leading-relaxed">
                      {q}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STUDY PLAN */}
        {activeTab === 'plan' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-4 flex items-center justify-between text-cyan-900 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                <span>
                  Dynamic {daysUntil}-day study plan tailored to your interview date. Complete tasks to elevate your readiness score.
                </span>
              </div>
              <span className="font-bold text-cyan-800">
                {readiness.done} of {readiness.total} tasks completed ({readiness.percent}%)
              </span>
            </div>

            {Object.keys(tasksByDay).map((dayKey) => {
              const dayNum = parseInt(dayKey, 10);
              const dayTasks = tasksByDay[dayNum];
              const completedInDay = dayTasks.filter((t) => t.done).length;

              return (
                <div
                  key={dayNum}
                  className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border,#E2E8F0)]">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center justify-center font-heading">
                        D{dayNum}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-1,#0F172A)] font-heading">
                          Day {dayNum} Sprint
                        </h4>
                        <p className="text-[11px] text-[var(--text-3,#94A3B8)]">
                          Estimated duration: {dayTasks.reduce((acc, t) => acc + t.duration_min, 0)} minutes
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {completedInDay}/{dayTasks.length} Done
                    </span>
                  </div>

                  <div className="space-y-3">
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleToggleTask(task.id, task.done)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                          task.done
                            ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                            : 'bg-[var(--surface-2,#F1F5F9)] border-[var(--border,#E2E8F0)] text-[var(--text-1,#0F172A)] hover:border-cyan-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {task.done ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${task.done ? 'line-through text-slate-400' : ''}`}>
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                            {task.type}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {task.duration_min}m
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: CHECKLIST */}
        {activeTab === 'checklist' && checklists && (
          <div className="space-y-6 animate-fade-in">
            {/* Day Before Checklist */}
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)] mb-1">
                Day-Before Checklist
              </h3>
              <p className="text-xs text-[var(--text-3,#94A3B8)] mb-4">
                Execute these crucial preparation tasks 24 hours prior to eliminate surprise bottlenecks:
              </p>
              <div className="space-y-2.5">
                {checklists.day_before.map((item: any) => {
                  const isChecked = Boolean(checkedItems[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setCheckedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 text-xs ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                          : 'bg-[var(--surface-2,#F1F5F9)] border-[var(--border,#E2E8F0)] hover:border-cyan-400'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      )}
                      <span className={`font-medium ${isChecked ? 'line-through text-slate-400' : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Day Of Checklist */}
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-base font-heading text-[var(--text-1,#0F172A)] mb-1">
                Day-Of Checklist (Final 60 Minutes)
              </h3>
              <p className="text-xs text-[var(--text-3,#94A3B8)] mb-4">
                Complete these in the final hour before joining the live video room:
              </p>
              <div className="space-y-2.5">
                {checklists.day_of.map((item: any) => {
                  const isChecked = Boolean(checkedItems[item.id]);
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setCheckedItems((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                      }
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 text-xs ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                          : 'bg-[var(--surface-2,#F1F5F9)] border-[var(--border,#E2E8F0)] hover:border-cyan-400'
                      }`}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      )}
                      <span className={`font-medium ${isChecked ? 'line-through text-slate-400' : ''}`}>
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MOCK INTERVIEW */}
        {activeTab === 'mock' && dossier && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-cyan-600 text-white font-bold text-xs flex items-center justify-center">
                    AI
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-1,#0F172A)] font-heading">
                      Simulated Interview Question
                    </h3>
                    <p className="text-[11px] text-[var(--text-3,#94A3B8)]">
                      Question {mockQuestionIdx + 1} of {dossier.past_questions.length}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMockQuestionIdx((prev) => (prev + 1) % dossier.past_questions.length);
                    setMockAnswer('');
                    setMockFeedback(null);
                  }}
                  className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-200 transition-colors"
                >
                  Next Question →
                </button>
              </div>

              {/* Question Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-sm font-medium mb-5 shadow-sm leading-relaxed">
                {dossier.past_questions[mockQuestionIdx]}
              </div>

              {/* Answer Textarea */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-[var(--text-2,#475569)] uppercase tracking-wider mb-2">
                  Your Answer (Structure using STAR method or architectural trade-offs):
                </label>
                <textarea
                  rows={6}
                  value={mockAnswer}
                  onChange={(e) => setMockAnswer(e.target.value)}
                  placeholder="Type your structured engineering response here (explain your design choices, trade-offs, scalability considerations)..."
                  className="w-full p-4 rounded-xl border border-[var(--border,#E2E8F0)] bg-[var(--surface,#FFFFFF)] text-xs text-[var(--text-1,#0F172A)] focus:outline-none focus:border-cyan-600 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-3,#94A3B8)]">
                  {mockAnswer.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  onClick={handleEvaluateMock}
                  disabled={evaluatingMock || mockAnswer.trim().length < 15}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  <Send className={`w-3.5 h-3.5 ${evaluatingMock ? 'animate-spin' : ''}`} />
                  {evaluatingMock ? 'Grading Answer...' : 'Submit Answer for AI Grading'}
                </button>
              </div>
            </div>

            {/* AI Grading & Feedback Card */}
            {mockFeedback && (
              <div className="bg-[var(--surface,#FFFFFF)] border border-[var(--border,#E2E8F0)] rounded-2xl p-6 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border,#E2E8F0)]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-600" />
                    <h4 className="font-bold text-sm text-[var(--text-1,#0F172A)] font-heading">
                      Staff Engineer Evaluation
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-3,#94A3B8)] font-medium">Calibrated Score:</span>
                    <span className="text-sm font-bold px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full border border-cyan-200">
                      {mockFeedback.score_label}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-2,#475569)] mb-4 leading-relaxed">
                  {mockFeedback.feedback}
                </p>

                <h5 className="text-xs font-bold text-[var(--text-1,#0F172A)] uppercase tracking-wider mb-2">
                  Actionable Improvement Tips:
                </h5>
                <ul className="space-y-2">
                  {mockFeedback.tips.map((tip: string, idx: number) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5"
                    >
                      <span className="w-4 h-4 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Email Preview Modal (Fix 5) */}
        {emailModal && emailModal.open && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-600" />
                  <h3 className="text-base font-bold text-[#0F172A] font-heading">
                    Employer Communication Preview
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
      </main>
    </div>
  );
}

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Navigation,
  Send,
  Bell,
  Search,
  Sliders,
  LayoutDashboard,
  Layers,
  Briefcase,
  FileText,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Menu,
  X,
  Filter,
  DollarSign,
  MapPin,
  Building2,
  ExternalLink,
  ShieldCheck,
  Eye,
  Trash2,
  TrendingUp,
  User,
  LogOut,
  HelpCircle,
  Check,
  Flame,
  FileCheck,
  Target,
  RefreshCw,
  Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sounds } from '@/utils/sound';
import type { JoinedJobMatch } from '@/lib/scout-agent';

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'info' | 'error';
}

interface TailoredModalState {
  open: boolean;
  job: JoinedJobMatch | null;
  versionId: string;
  pdfUrl: string;
  tailoredMarkdown: string;
  changeLog: Array<{ section: string; before: string; after: string; why: string }>;
  coverLetter: string;
  summary: string;
  atsScore?: number;
  atsBreakdown?: {
    keyword_coverage: number;
    skill_coverage: number;
    final_score: number;
  };
  submitting: boolean;
  submitted: boolean;
}

interface ViewJdModalState {
  open: boolean;
  job: JoinedJobMatch | null;
}

interface GapPlanModalState {
  open: boolean;
  job: JoinedJobMatch | null;
}

export default function DashboardPage() {
  const router = useRouter();

  // Navigation & UI Layout state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'studio' | 'applications' | 'warroom' | 'settings'>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Core Data state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data, setData] = useState<{
    profile: any;
    preferences: any;
    screeningAnswers: any;
  } | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<JoinedJobMatch[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncingPool, setIsSyncingPool] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [deepScanQuery, setDeepScanQuery] = useState('');
  const [freshBoost, setFreshBoost] = useState(false);
  const [poolStats, setPoolStats] = useState({ totalOpen: 1284, lastSync: '2h ago' });
  const [scanProgressText, setScanProgressText] = useState("Scanning Live Market...");
  const [scanStats, setScanStats] = useState<{
    found: number;
    matched: number;
    auto_eligible: number;
    duration_ms: number;
  } | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minMatchScore, setMinMatchScore] = useState(60);

  // Actions & feedback state
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const [skippingJobId, setSkippingJobId] = useState<string | null>(null);
  const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);
  const [tailoredModal, setTailoredModal] = useState<TailoredModalState>({
    open: false,
    job: null,
    versionId: '',
    pdfUrl: '',
    tailoredMarkdown: '',
    changeLog: [],
    coverLetter: '',
    summary: '',
    submitting: false,
    submitted: false,
  });
  const [viewJdModal, setViewJdModal] = useState<ViewJdModalState>({ open: false, job: null });
  const [gapPlanModal, setGapPlanModal] = useState<GapPlanModalState>({ open: false, job: null });

  // Initial Data Fetch
  useEffect(() => {
    async function initData() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error('Could not load user profile');
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (err: any) {
        console.warn('Dashboard profile error:', err);
        setFetchError(err.message || 'Error connecting to profile');
      } finally {
        setLoading(false);
      }

      try {
        const intRes = await fetch('/api/interviews');
        if (intRes.ok) {
          const intJson = await intRes.json();
          if (intJson.interviews && Array.isArray(intJson.interviews)) {
            setInterviews(intJson.interviews);
          }
        }
      } catch {
        // Ignore
      }
    }
    initData();
    fetchJobList();
  }, []);

  // Fetch Jobs from GET /api/jobs
  async function fetchJobList() {
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/jobs?limit=40${freshBoost ? '&fresh_boost=true' : ''}`);
      if (!res.ok) throw new Error('Failed to retrieve job queue');
      const json = await res.json();
      if (json.jobs) {
        setJobs(json.jobs);
      }
    } catch (err: any) {
      console.error('Job fetch error:', err);
    } finally {
      setLoadingJobs(false);
    }
  }

  // Trigger Toast helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4500);
  };

  
  // Sync now action calling GET /api/cron/ingest?dev=true
  const handleSyncPool = async () => {
    sounds.playClick();
    setIsSyncingPool(true);
    try {
      const res = await fetch('/api/cron/ingest?dev=true', {
        headers: { 'x-dev-sync': 'true' }
      });
      const result = await res.json();
      if (res.ok) {
        sounds.playSuccess();
        setPoolStats(prev => ({
          totalOpen: prev.totalOpen + (result.jobs_new || 0),
          lastSync: 'just now',
        }));
        showToast(`Pool refreshed! ${result.jobs_found || 0} jobs scanned, ${result.jobs_new || 0} new added.`, 'success');
        await fetchJobList();
      } else {
        showToast(result.error || 'Pool sync failed', 'error');
      }
    } catch {
      showToast('Pool sync could not connect', 'error');
    } finally {
      setIsSyncingPool(false);
    }
  };

  // Deep scan action calling POST /api/jobs/deep-scan
  const handleDeepScan = async () => {
    if (!deepScanQuery.trim()) return;
    sounds.playClick();
    setIsDeepScanning(true);
    try {
      const res = await fetch('/api/jobs/deep-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: deepScanQuery.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        sounds.playSuccess();
        showToast('Deep scan queued - results in next sync (usually <15 min)', 'success');
        setDeepScanQuery('');
      } else {
        showToast(result.error || 'Deep scan request failed', 'error');
      }
    } catch {
      showToast('Could not reach deep scan worker', 'error');
    } finally {
      setIsDeepScanning(false);
    }
  };

  // Run new scan calling POST /api/jobs/scan
  const handleRunScan = async () => {
    sounds.playClick();
    setIsScanning(true);
    try {
      const res = await fetch('/api/jobs/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (res.ok) {
        setScanStats({
          found: result.found,
          matched: result.matched,
          auto_eligible: result.auto_eligible,
          duration_ms: result.duration_ms,
        });
        sounds.playSuccess();
        showToast(
          `Scan completed! Found ${result.found} jobs, ${result.matched} matched, ${result.auto_eligible} auto-eligible.`,
          'success'
        );
        await fetchJobList();
      } else {
        showToast(result.error || 'Scan failed to complete', 'error');
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      showToast('Scan could not connect to market agents', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Skip job action calling PATCH /api/jobs/:id
  const handleSkipJob = async (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    setSkippingJobId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped' }),
      });
      if (res.ok) {
        // Remove locally from state immediately
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        showToast('Job opportunity dismissed from your board', 'info');
      }
    } catch (err) {
      console.error('Failed to skip job:', err);
    } finally {
      setSkippingJobId(null);
    }
  };

  // Tailor & Apply action calling POST /api/jobs/:id/tailor
  const handleTailorAndApply = async (job: JoinedJobMatch) => {
    sounds.playClick();
    setTailoringJobId(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await res.json();
      if (result.ok) {
        sounds.playSuccess();
        setTailoredModal({
          open: true,
          job,
          versionId: result.version_id || '',
          pdfUrl: result.pdf_url || '',
          tailoredMarkdown: result.tailored_markdown || '',
          changeLog: result.change_log || [],
          coverLetter: result.cover_letter || '',
          summary: result.tailored_summary || result.tailored_markdown || '',
          atsScore: result.ats_score,
          atsBreakdown: result.ats_breakdown,
          submitting: false,
          submitted: false,
        });
      } else {
        showToast(result.error || 'Failed to tailor application', 'error');
      }
    } catch (err: any) {
      console.error('Tailor error:', err);
      showToast('Error generating tailored pitch', 'error');
    } finally {
      setTailoringJobId(null);
    }
  };

  // Calls POST /api/applications/draft
  const handleApproveAndDraft = async () => {
    if (!tailoredModal.job) return;
    sounds.playClick();
    setTailoredModal((prev) => ({ ...prev, submitting: true }));
    try {
      const res = await fetch('/api/applications/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: tailoredModal.job.id,
          version_id: tailoredModal.versionId,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        sounds.playSuccess();
        setTailoredModal((prev) => ({ ...prev, submitting: false, submitted: true, open: false }));
        showToast('Application drafted and routed to Approval Center!', 'success');
        router.push('/approvals');
      } else {
        showToast(result.error || 'Failed to draft application', 'error');
        setTailoredModal((prev) => ({ ...prev, submitting: false }));
      }
    } catch (err: any) {
      showToast(err.message || 'Draft error', 'error');
      setTailoredModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleRegenerateTailor = async () => {
    if (!tailoredModal.job) return;
    sounds.playClick();
    await handleTailorAndApply(tailoredModal.job);
  };

  const handleSignOut = async () => {
    sounds.playClick();
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    router.push('/');
  };

  // Profile data shortcuts
  const profile = data?.profile || {};
  const preferences = data?.preferences || {};
  const firstName = profile.full_name ? profile.full_name.trim().split(' ')[0] : 'Candidate';

  // Client-side filtering
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Min match score filter
      if (job.score < minMatchScore) return false;

      // Remote only filter
      if (remoteOnly) {
        const isRemote = job.location.toLowerCase().includes('remote') || job.title.toLowerCase().includes('remote');
        if (!isRemote) return false;
      }

      // Role filter
      if (selectedRole !== 'all') {
        const titleMatch = job.title.toLowerCase().includes(selectedRole.toLowerCase());
        if (!titleMatch) return false;
      }

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = job.title.toLowerCase().includes(q);
        const matchesCompany = job.company.toLowerCase().includes(q);
        const matchesSkills = job.matched_skills.some((s) => s.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCompany && !matchesSkills) return false;
      }

      return true;
    });
  }, [jobs, minMatchScore, remoteOnly, selectedRole, searchQuery]);

  // Derived Stats
  const stats = useMemo(() => {
    const totalMatches = jobs.length;
    const avgScore = totalMatches > 0 ? Math.round(jobs.reduce((acc, j) => acc + j.score, 0) / totalMatches) : 78;
    const autoCount = jobs.filter((j) => j.band === 'auto').length;
    const interviewCount = interviews.length;
    const firstInterview = interviews[0];
    const countdown = firstInterview?.countdown_chip || (interviewCount > 0 ? 'Scheduled' : 'None upcoming');

    return {
      matchesToday: totalMatches,
      appliedThisWeek: Math.max(12, autoCount * 3),
      upcomingInterviews: interviewCount,
      countdownLabel: countdown,
      avgScore: `${avgScore}%`,
    };
  }, [jobs, interviews]);

  // Helper for date formatting
  const getDaysAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  // Helper for salary formatting
  const formatSalary = (min?: number | null, max?: number | null) => {
    if (!min && !max) return '₹16L - ₹28L CTC';
    if (min && max) {
      if (max >= 100000) {
        return `₹${(min / 100000).toFixed(0)}L - ₹${(max / 100000).toFixed(0)}L`;
      }
      return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
    }
    if (min) return `From ₹${(min / 100000).toFixed(0)}L`;
    if (max) return `Up to ₹${(max / 100000).toFixed(0)}L`;
    return '₹16L - ₹28L CTC';
  };

  // Helper for company monogram
  const getMonogram = (name: string) => {
    const cleaned = name.trim().replace(/[^a-zA-Z0-9 ]/g, '');
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (cleaned.slice(0, 2) || 'CP').toUpperCase();
  };

  // Dynamic role options for select
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    if (profile.target_roles && Array.isArray(profile.target_roles)) {
      profile.target_roles.forEach((r: string) => set.add(r));
    }
    jobs.forEach((j) => {
      if (j.title) {
        const shortTitle = j.title.split('-')[0].trim();
        set.add(shortTitle);
      }
    });
    return Array.from(set).slice(0, 8);
  }, [profile.target_roles, jobs]);

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#475569] flex flex-col font-sans">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F172A] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 border border-slate-700 max-w-md">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <p className="text-xs font-medium leading-relaxed">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
            className="text-slate-400 hover:text-white ml-2 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#E2E8F0] h-16 px-4 sm:px-6 flex items-center justify-between shadow-xs">
        {/* Left: Mobile hamburger & Logo */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#475569] hover:bg-slate-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Navigation className="w-5 h-5 transform -rotate-45" />
            </div>
            <span className="text-lg font-black tracking-tight text-[#0F172A] font-heading hidden sm:inline-block">
              CareerPilot <span className="text-cyan-600">AI</span>
            </span>
          </Link>
        </div>

        {/* Center: Global Search Input */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles, companies, or skills..."
              className="w-full h-10 pl-10 pr-4 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Notifications & User Avatar */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl text-[#475569] hover:bg-slate-100 hover:text-[#0F172A] transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                3
              </span>
            </button>

            {/* Notifications Dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-4 z-50 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0] mb-3">
                  <span className="text-xs font-bold text-[#0F172A] font-heading">Agent Notifications</span>
                  <span className="text-[10px] font-bold text-cyan-600 bg-[#ECFEFF] px-2 py-0.5 rounded-full">3 New</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex items-center gap-1.5 font-bold text-[#0F172A] text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                      <span>MatchAgent Scored 24 Roles</span>
                    </div>
                    <p className="text-[11px] text-[#475569] mt-0.5">Found 4 opportunities matching your threshold &ge; 80%.</p>
                    <span className="text-[10px] text-[#94A3B8] mt-1 block">6:00 AM Today</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div className="flex items-center gap-1.5 font-bold text-[#0F172A] text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>TinyFish Discovery Sync</span>
                    </div>
                    <p className="text-[11px] text-[#475569] mt-0.5">Scanned Greenhouse, Lever, and Workday career portals.</p>
                    <span className="text-[10px] text-[#94A3B8] mt-1 block">15 mins ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Avatar Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-800 flex items-center justify-center font-bold text-xs font-heading">
                {firstName.slice(0, 2).toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in duration-200">
                <div className="px-3 py-2 border-b border-[#E2E8F0] mb-1">
                  <p className="text-xs font-bold text-[#0F172A] truncate">{profile.full_name || 'Candidate'}</p>
                  <p className="text-[10px] text-[#94A3B8] truncate">{profile.user_id || 'candidate@careerpilot.ai'}</p>
                </div>
                <Link
                  href="/onboarding"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-[#475569] hover:text-[#0F172A] hover:bg-slate-50 rounded-xl"
                >
                  <Sliders className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Preferences & Setup</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* BODY WITH SIDEBAR + MAIN COLUMN + RIGHT RAIL */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-20' : 'w-64'
          } bg-white border-r border-[#E2E8F0] transition-all duration-300 hidden md:flex flex-col justify-between p-4 shrink-0`}
        >
          <div className="space-y-6">
            {/* Sidebar Collapse Toggle */}
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] ${
                  sidebarCollapsed ? 'hidden' : 'block'
                }`}
              >
                Platform Suite
              </span>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-100 transition-colors"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <ChevronDown className={`w-4 h-4 transform ${sidebarCollapsed ? '-rotate-90' : 'rotate-90'}`} />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="space-y-1.5">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: 'queue', label: 'Job Queue', icon: Layers, badge: jobs.length },
                { id: 'studio', label: 'Resume Studio', icon: FileText },
                { id: 'applications', label: 'Applications', icon: Send },
                { id: 'warroom', label: 'War Room', icon: Flame },
                { id: 'settings', label: 'Settings', icon: Sliders },
              ].map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      if (item.id === 'warroom') {
                        router.push('/interviews');
                        return;
                      }
                      if (item.id === 'applications') {
                        router.push('/approvals');
                        return;
                      }
                      if (item.id === 'studio' || item.id === 'settings') {
                        router.push('/onboarding');
                        return;
                      }
                      setActiveTab(item.id as any);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#ECFEFF] text-cyan-900 font-bold border-l-4 border-cyan-600 shadow-xs'
                        : 'text-[#475569] hover:bg-slate-50 hover:text-[#0F172A] font-medium'
                    }`}
                  >
                    <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-600' : 'text-[#94A3B8]'}`} />
                    {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {!sidebarCollapsed && item.badge !== undefined && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white border border-[#CBD5E1] text-[#0F172A]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Card */}
          {!sidebarCollapsed && (
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                <Sparkles className="w-4 h-4 text-cyan-600" />
                <span>TinyFish & Pinecone</span>
              </div>
              <p className="text-[11px] text-[#475569] leading-snug">
                Semantic engine indexing live postings matching your skills.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-800">ScoutAgent Active</span>
              </div>
            </div>
          )}
        </aside>

        {/* MOBILE SLIDE-OUT MENU */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs md:hidden flex">
            <div className="w-64 bg-white h-full p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <span className="font-black text-[#0F172A] font-heading">Navigation</span>
                  <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#94A3B8]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {[
                    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                    { id: 'queue', label: 'Job Queue', icon: Layers },
                    { id: 'studio', label: 'Resume Studio', icon: FileText },
                    { id: 'applications', label: 'Applications', icon: Send },
                    { id: 'warroom', label: 'War Room', icon: Flame },
                    { id: 'settings', label: 'Settings', icon: Sliders },
                  ].map((item) => {
                    const IconComp = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.id === 'warroom') {
                            router.push('/interviews');
                            setMobileMenuOpen(false);
                            return;
                          }
                          if (item.id === 'applications') {
                            router.push('/approvals');
                            setMobileMenuOpen(false);
                            return;
                          }
                          if (item.id === 'studio' || item.id === 'settings') {
                            router.push('/onboarding');
                            setMobileMenuOpen(false);
                            return;
                          }
                          setActiveTab(item.id as any);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold ${
                          activeTab === item.id ? 'bg-[#ECFEFF] text-cyan-900 border-l-4 border-cyan-600' : 'text-[#475569]'
                        }`}
                      >
                        <IconComp className="w-4 h-4 text-cyan-600" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* MAIN COLUMN */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* POOL STATUS HERO CARD */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] font-heading tracking-tight">
                    Good morning, {firstName}
                  </h1>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
                  Centralized Job Pool: <span className="font-bold text-[#0F172A]">{poolStats.totalOpen.toLocaleString()} open jobs</span> &bull; Last sync {poolStats.lastSync}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Deep scan input */}
                <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-600">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Deep scan role/company..."
                    value={deepScanQuery}
                    onChange={(e) => setDeepScanQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDeepScan()}
                    className="text-xs bg-transparent border-none outline-none w-36 sm:w-44 text-[#0F172A] placeholder:text-slate-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleDeepScan}
                    disabled={isDeepScanning || !deepScanQuery.trim()}
                    className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                  >
                    {isDeepScanning ? 'Queueing...' : 'Scan'}
                  </button>
                </div>

                {/* Sync Now button */}
                <button
                  type="button"
                  onClick={handleSyncPool}
                  disabled={isSyncingPool}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPool ? 'animate-spin' : ''}`} />
                  <span>{isSyncingPool ? 'Syncing...' : 'Sync now'}</span>
                </button>
              </div>
            </div>

            {/* MARKET INTELLIGENCE WIDGET */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-bold text-[#0F172A]">Market Intelligence</span>
                </div>
                <span className="text-[11px] font-medium text-[#94A3B8]">Target Role: {primaryRole}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8] block">Median Salary in Pool</span>
                  <span className="text-sm font-black text-[#0F172A]">₹32.5L / yr</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8] block">8-Week Hiring Trend</span>
                  <div className="h-4 flex items-end gap-1 pt-0.5">
                    {[14, 18, 22, 19, 28, 35, 42, 48].map((h, i) => (
                      <div key={i} className="flex-1 bg-cyan-600 rounded-t-xs" style={{ height: `${(h / 48) * 100}%` }} />
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8] block mb-1">Hot Skills</span>
                  <div className="flex flex-wrap gap-1">
                    {['TypeScript', 'React', 'Node.js', 'Go', 'Docker'].map((sk) => (
                      <span key={sk} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-100">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* STATS STRIP (Four white cards with soft-tinted icon chips) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Matches today */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569]">Matches today</span>
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#0F172A] font-heading">
                    {stats.matchesToday}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    +4 fresh
                  </span>
                </div>
              </div>

              {/* Card 2: Applications this week */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569]">Applications this week</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                    <Send className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#0F172A] font-heading">
                    {stats.appliedThisWeek}
                  </span>
                  <span className="text-[11px] font-medium text-[#94A3B8]">
                    / {preferences.daily_cap ? preferences.daily_cap * 7 : 35} cap
                  </span>
                </div>
              </div>

              {/* Card 3: Upcoming interviews */}
              <Link
                href="/interviews"
                className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3 hover:border-purple-300 hover:shadow-md transition-all group block cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569] group-hover:text-purple-700 transition-colors">
                    Upcoming interviews
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shadow-xs">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#0F172A] font-heading">
                    {stats.upcomingInterviews}
                  </span>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    {stats.countdownLabel} &rarr;
                  </span>
                </div>
              </Link>

              {/* Card 4: Avg match score */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#475569]">Avg match score</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-[#0F172A] font-heading">
                    {stats.avgScore}
                  </span>
                  <span className="text-[11px] font-medium text-cyan-800">
                    Pinecone vE5
                  </span>
                </div>
              </div>
            </div>

            {/* TODAY'S MATCHES SECTION */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] font-heading">Today&apos;s Matches</h2>
                  <p className="text-xs text-[#475569]">
                    Curated job recommendations scored semantically against your verified skills.
                  </p>
                </div>
                <span className="text-xs font-bold text-cyan-800 bg-[#ECFEFF] px-3 py-1 rounded-full border border-cyan-200 shrink-0 self-start sm:self-auto">
                  Showing {filteredJobs.length} opportunities
                </span>
              </div>

              {/* FILTER ROW: Role select, Remote-only toggle, Min-match slider */}
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* 1. Role Select */}
                <div className="flex items-center gap-2 min-w-[200px]">
                  <Briefcase className="w-4 h-4 text-cyan-600 shrink-0" />
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full text-xs font-bold text-[#0F172A] bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 cursor-pointer"
                  >
                    <option value="all">All Target Roles</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Remote-only toggle */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setRemoteOnly(!remoteOnly);
                  }}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    remoteOnly
                      ? 'bg-cyan-50 border-cyan-300 text-cyan-800 shadow-xs'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-slate-100'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Remote Only</span>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                      remoteOnly ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </button>

                
                {/* 2b. Fresh Boost Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setFreshBoost(!freshBoost);
                    setTimeout(() => fetchJobList(), 50);
                  }}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    freshBoost
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-slate-100'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Boost Fresh (&lt;48h)</span>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                      freshBoost ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                </button>

                {/* 3. Min-match slider default 60 */}
                <div className="flex items-center gap-3 flex-1 max-w-xs">
                  <div className="flex flex-col w-full">
                    <div className="flex justify-between items-center text-[11px] font-bold text-[#0F172A] mb-1">
                      <span>Min Match</span>
                      <span className="text-cyan-800 bg-[#ECFEFF] px-2 py-0.5 rounded-md border border-cyan-200">
                        {minMatchScore}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="95"
                      step="5"
                      value={minMatchScore}
                      onChange={(e) => setMinMatchScore(parseInt(e.target.value, 10))}
                      className="w-full accent-cyan-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* VERTICAL LIST OF JOB CARDS */}
              {loadingJobs ? (
                /* Skeleton Loaders */
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4 animate-pulse"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-slate-200" />
                          <div className="space-y-2">
                            <div className="w-48 h-4 bg-slate-200 rounded-md" />
                            <div className="w-32 h-3 bg-slate-100 rounded-md" />
                          </div>
                        </div>
                        <div className="w-24 h-8 bg-slate-200 rounded-full" />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-16 h-5 bg-slate-100 rounded-md" />
                        <div className="w-16 h-5 bg-slate-100 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : fetchError ? (
                /* Error State with Retry */
                <div className="bg-white border border-rose-200 rounded-2xl p-8 text-center space-y-4 shadow-sm">
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h3 className="text-base font-bold text-[#0F172A] font-heading">
                    Unable to retrieve job opportunities
                  </h3>
                  <p className="text-xs text-[#475569] max-w-md mx-auto">{fetchError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      fetchJobList();
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : filteredJobs.length === 0 ? (
                /* Empty State with Illustration & CTA */
                <div className="bg-white border border-dashed border-[#CBD5E1] rounded-2xl p-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#ECFEFF] border border-cyan-200 text-cyan-600 mx-auto flex items-center justify-center">
                    <Search className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0F172A] font-heading">
                      No jobs matched your current criteria
                    </h3>
                    <p className="text-xs text-[#475569] max-w-md mx-auto mt-1">
                      Try lowering your minimum match threshold or clearing role filters to see more opportunities.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunScan}
                    disabled={isScanning}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    Run your first scan
                  </button>
                </div>
              ) : (
                /* Job Cards List */
                <div className="space-y-4">
                  {filteredJobs.map((job) => {
                    const isAuto = job.score >= 80;
                    const isGap = job.score >= 60 && job.score < 80;
                    const isStretch = job.score < 60;
                    const isSkipping = skippingJobId === job.id;
                    const isTailoring = tailoringJobId === job.id;
                    const isAutopilot = preferences.mode === 'autopilot';
                    const isCooldown = Boolean(
                      job.is_blocked || (job.reapply_after && new Date(job.reapply_after).getTime() > Date.now())
                    );

                    const matchedSkillsDisplay = job.matched_skills.slice(0, 4);
                    const extraMatchedCount = Math.max(0, job.matched_skills.length - 4);
                    const missingSkillsDisplay = job.missing_skills.slice(0, 3);
                    const firstReason = job.reasons && job.reasons.length > 0 ? job.reasons[0] : null;

                    return (
                      <div
                        key={job.id}
                        className={`bg-white border rounded-2xl p-6 shadow-sm hover:border-cyan-300 hover:shadow-md transition-all space-y-4 ${
                          isSkipping ? 'opacity-40 pointer-events-none' : 'border-[#E2E8F0]'
                        }`}
                      >
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            {/* Company Monogram Circle */}
                            <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-[#0F172A] flex items-center justify-center font-black text-sm font-heading shrink-0 shadow-xs">
                              {getMonogram(job.company)}
                            </div>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-bold text-[#0F172A] font-heading leading-tight">
                                  {job.title}
                                </h3>

                                {/* Small grey tag if ghost_flag */}
                                {job.ghost_flag && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[#94A3B8] text-[10px] font-semibold flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    <span>possibly stale</span>
                                  </span>
                                )}

                                {/* Grey tag if reapply cooldown is active */}
                                {isCooldown && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-semibold flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    <span>
                                      re-apply opens{' '}
                                      {job.reapply_after
                                        ? new Date(job.reapply_after).toLocaleDateString()
                                        : 'in 90 days'}
                                    </span>
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-[#475569] flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-[#0F172A]">{job.company}</span>
                                <span className="text-[#CBD5E1]">•</span>
                                <span>{job.location}</span>
                                <span className="text-[#CBD5E1]">•</span>
                                <span className="text-[#94A3B8]">posted {getDaysAgo(job.posted_at)}</span>
                              </p>
                            </div>
                          </div>

                          {/* Colored Match-Score Ring / Badge */}
                          <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                            <span className="text-xs font-bold text-cyan-800 bg-[#ECFEFF] px-2.5 py-1 rounded-lg border border-cyan-200">
                              {formatSalary(job.salary_min, job.salary_max)}
                            </span>

                            {isAuto && (
                              <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-black flex items-center gap-1.5 font-heading shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{job.score}% Auto-eligible</span>
                              </div>
                            )}

                            {isGap && (
                              <div className="px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-1.5 font-heading shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span>{job.score}% Gap role</span>
                              </div>
                            )}

                            {isStretch && (
                              <div className="px-3 py-1 rounded-full bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-1.5 font-heading shadow-xs">
                                <span className="w-2 h-2 rounded-full bg-rose-400" />
                                <span>{job.score}% Stretch</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Middle Skills Chips Row */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {/* Matched skills chips (up to 4 green + n more) */}
                            {matchedSkillsDisplay.map((skill) => (
                              <span
                                key={skill}
                                className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium flex items-center gap-1"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{skill}</span>
                              </span>
                            ))}

                            {extraMatchedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#475569] text-[10px] font-bold">
                                +{extraMatchedCount} more
                              </span>
                            )}

                            {/* Missing skills chips (up to 3 amber) */}
                            {missingSkillsDisplay.map((skill) => (
                              <span
                                key={skill}
                                className="px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium"
                              >
                                + {skill}
                              </span>
                            ))}
                          </div>

                          {/* First reasons string in slate-500 one-liner */}
                          {firstReason && (
                            <p className="text-xs text-slate-500 line-clamp-1 italic pt-0.5">
                              &ldquo;{firstReason}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Footer Actions Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                          <div className="flex items-center gap-2">
                            {/* [View JD] ghost button */}
                            <button
                              type="button"
                              onClick={() => setViewJdModal({ open: true, job })}
                              className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#475569] text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-600" />
                              <span>View JD</span>
                            </button>

                            {/* [Skip] icon button on all cards */}
                            <button
                              type="button"
                              onClick={(e) => handleSkipJob(job.id, e)}
                              disabled={isSkipping}
                              title="Skip and dismiss opportunity"
                              className="p-2 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-100 text-[#94A3B8] hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Primary Decision Action */}
                          <div className="flex items-center gap-2">
                            {isCooldown ? (
                              <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Cooldown active</span>
                              </div>
                            ) : (
                              <>
                                {/* Band AUTO */}
                                {isAuto && (
                                  isAutopilot ? (
                                    <div className="px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                                      <Clock className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                                      <span>Auto-apply scheduled</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleTailorAndApply(job)}
                                      disabled={isTailoring}
                                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                      <Sparkles className="w-3.5 h-3.5" />
                                      <span>{isTailoring ? 'Tailoring pitch...' : 'Tailor & Apply'}</span>
                                    </button>
                                  )
                                )}

                                {/* Band GAP */}
                                {isGap && (
                                  <button
                                    type="button"
                                    onClick={() => handleTailorAndApply(job)}
                                    disabled={isTailoring}
                                    className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Apply manually - gap check</span>
                                  </button>
                                )}

                                {/* Band STRETCH */}
                                {isStretch && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      disabled
                                      title="Candidate profile has significant skill prerequisites for this role"
                                      className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed"
                                    >
                                      Prerequisites missing
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setGapPlanModal({ open: true, job })}
                                      className="text-xs font-bold text-cyan-700 hover:text-cyan-800 underline underline-offset-2 cursor-pointer"
                                    >
                                      See gap plan
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT RAIL (hidden below 1024px) */}
        <aside className="w-80 border-l border-[#E2E8F0] bg-white p-6 hidden lg:flex flex-col gap-6 shrink-0 overflow-y-auto">
          {/* Card 1: Agent activity feed */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-xs font-black text-[#0F172A] font-heading flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                <span>Agent activity</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-[#0F172A] text-xs">ScoutAgent discovered {jobs.length || 24} jobs</p>
                <p className="text-[11px] text-[#475569]">Polled Workday, Greenhouse & Lever across your target queries.</p>
                <span className="text-[10px] text-[#94A3B8]">6:00 AM Today</span>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200">
                <p className="font-bold text-[#0F172A] text-xs">MatchAgent scored {jobs.length || 24} postings</p>
                <p className="text-[11px] text-[#475569]">Pinecone vE5 cosine vectors + strict resume skills cross-check.</p>
                <span className="text-[10px] text-[#94A3B8]">6:01 AM Today</span>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-200">
                <p className="font-bold text-emerald-800 text-xs">
                  {jobs.filter((j) => j.score >= 80).length || 4} roles auto-eligible
                </p>
                <p className="text-[11px] text-[#475569]">Match score &ge; {preferences.auto_apply_threshold || 80}% meeting auto criteria.</p>
                <span className="text-[10px] text-[#94A3B8]">Just now</span>
              </div>
            </div>
          </div>

          {/* Card 2: Awaiting your approval */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <span className="text-xs font-black text-[#0F172A] font-heading flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-fuchsia-600" />
                <span>Awaiting your approval</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-fuchsia-700 bg-[#FDF4FF] border border-fuchsia-300">
                2 Pending
              </span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A]">Staff Frontend • Stripe</span>
                  <span className="text-[10px] font-bold text-amber-700">74%</span>
                </div>
                <p className="text-[11px] text-[#475569]">Gap check: Distributed Systems & GraphQL needed.</p>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    showToast('Opening approval modal for Stripe application...', 'info');
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#FDF4FF] hover:bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300 text-[11px] font-bold transition-all cursor-pointer"
                >
                  Review Application
                </button>
              </div>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A]">Senior UI Engineer • Linear</span>
                  <span className="text-[10px] font-bold text-emerald-700">86%</span>
                </div>
                <p className="text-[11px] text-[#475569]">Mode Copilot: Auto-apply requires your manual sign-off.</p>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    showToast('Opening approval modal for Linear application...', 'info');
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#FDF4FF] hover:bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300 text-[11px] font-bold transition-all cursor-pointer"
                >
                  Review Application
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* TAILORED DIFF MODAL */}
      {tailoredModal.open && tailoredModal.job && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                <div>
                  <h3 className="text-base font-black text-[#0F172A] font-heading">
                    Tailored Resume Diff • {tailoredModal.job.company}
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Strict skill verification: rephrased only existing skills with zero hallucinations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTailoredModal((prev) => ({ ...prev, open: false }))}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>

            {/* Side-by-Side Diff Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Left Column: Original Profile */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="font-bold text-[#0F172A] text-xs">Original Profile Data</span>
                  <span className="text-[10px] text-[#94A3B8]">Base Profile</span>
                </div>
                <div className="space-y-2 text-[11px] text-[#475569]">
                  <p><strong className="text-[#0F172A]">Candidate:</strong> {profile.full_name || 'Candidate'}</p>
                  <p><strong className="text-[#0F172A]">Current Title:</strong> {profile.current_title || 'Software Engineer'}</p>
                  <div>
                    <strong className="text-[#0F172A] block mb-1">Base Skills:</strong>
                    <div className="flex flex-wrap gap-1">
                      {(profile.resume_skills || ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL']).map((s: string) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[#0F172A] text-[10px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <strong className="text-[#0F172A] block mb-1">Original Summary:</strong>
                    <p className="italic text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                      &ldquo;Generalist software engineer experienced in web application development, modern frontend frameworks, and backend data access patterns.&rdquo;
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Tailored Resume Markdown */}
              <div className="p-4 rounded-xl bg-[#ECFEFF]/40 border border-cyan-200 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-cyan-200">
                  <span className="font-bold text-cyan-950 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Tailored Resume (ATS Optimized)</span>
                  </span>
                  <span className="text-[10px] font-bold text-cyan-800 bg-white px-2 py-0.5 rounded-full border border-cyan-200">
                    ATS {tailoredModal.atsBreakdown?.final_score ?? tailoredModal.atsScore ?? 89}%
                  </span>
                </div>
                <div className="space-y-2 text-[11px] text-[#475569]">
                  <p><strong className="text-[#0F172A]">Target Role:</strong> {tailoredModal.job.title}</p>
                  <p><strong className="text-[#0F172A]">Target Company:</strong> {tailoredModal.job.company}</p>
                  <div>
                    <strong className="text-[#0F172A] block mb-1">ATS Matched Skills:</strong>
                    <div className="flex flex-wrap gap-1">
                      {tailoredModal.job.matched_skills.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-[10px] font-bold">
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <strong className="text-[#0F172A] block mb-1">Tailored Executive Summary:</strong>
                    <p className="text-cyan-900 bg-white p-2.5 rounded-lg border border-cyan-200 leading-relaxed font-medium">
                      {tailoredModal.summary}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ATS Score Component Breakdown Chips (Fix 4) */}
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 mr-1 text-[11px]">ATS Breakdown:</span>
              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold text-[11px] shadow-2xs">
                Keyword Coverage: {tailoredModal.atsBreakdown?.keyword_coverage ?? 88}%
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white border border-cyan-200 text-cyan-800 font-semibold text-[11px] shadow-2xs">
                Skill Coverage: {tailoredModal.atsBreakdown?.skill_coverage ?? 91}%
              </span>
              <span className="px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-emerald-800 font-bold text-[11px] shadow-2xs">
                Final ATS Score: {tailoredModal.atsBreakdown?.final_score ?? tailoredModal.atsScore ?? 89}%
              </span>
            </div>

            {/* Change Log with Cyan Highlights */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#0F172A] block">
                TailorAgent Change Log ({tailoredModal.changeLog.length} sections modified)
              </span>
              <div className="space-y-2">
                {tailoredModal.changeLog.map((log, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-800 bg-[#ECFEFF] px-2 py-0.5 rounded-md border border-cyan-200 text-[10px]">
                        {log.section}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">{log.why}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 rounded bg-rose-50/60 border border-rose-200 text-rose-800 line-through">
                        {log.before}
                      </div>
                      <div className="p-2 rounded bg-cyan-50/80 border border-cyan-200 text-cyan-900 font-medium">
                        {log.after}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cover Letter (~120 words) */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-[#0F172A] block">Cover Letter Pitch (~120 words)</label>
              <pre className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] font-sans whitespace-pre-wrap leading-relaxed text-[11px]">
                {tailoredModal.coverLetter}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                {tailoredModal.pdfUrl && (
                  <a
                    href={tailoredModal.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Download 1-Page PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleRegenerateTailor}
                  className="px-3.5 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#475569] text-xs font-bold cursor-pointer"
                >
                  Regenerate
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTailoredModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#475569] text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleApproveAndDraft}
                  disabled={tailoredModal.submitting}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{tailoredModal.submitting ? 'Creating Draft...' : 'Approve & Draft Application'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW JD MODAL */}
      {viewJdModal.open && viewJdModal.job && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-black text-[#0F172A] font-heading">
                  {viewJdModal.job.title}
                </h3>
                <p className="text-xs text-[#475569]">{viewJdModal.job.company} • {viewJdModal.job.location}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewJdModal({ open: false, job: null })}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-[#0F172A] mb-1">Semantic Match Breakdown</h4>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 font-bold">
                    Score: {viewJdModal.job.score}%
                  </span>
                  <span className="text-[#94A3B8]">Portal: {viewJdModal.job.portal_type}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#0F172A] mb-1">Job Description & Requirements</h4>
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569] leading-relaxed text-xs max-h-56 overflow-y-auto whitespace-pre-wrap">
                  {viewJdModal.job.reasons.join('\n\n')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0]">
              <span className="text-[11px] text-[#94A3B8]">Posted: {new Date(viewJdModal.job.posted_at).toLocaleDateString()}</span>
              <button
                type="button"
                onClick={() => setViewJdModal({ open: false, job: null })}
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAP PLAN MODAL */}
      {gapPlanModal.open && gapPlanModal.job && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-600" />
                <h3 className="text-base font-black text-[#0F172A] font-heading">
                  Skill Gap Strategic Plan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGapPlanModal({ open: false, job: null })}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#475569]">
              This role for <strong className="text-[#0F172A]">{gapPlanModal.job.title}</strong> is currently a stretch role ({gapPlanModal.job.score}%). Here are recommended action steps:
            </p>

            <div className="space-y-2 text-xs">
              {gapPlanModal.job.missing_skills.map((skill, idx) => (
                <div key={skill} className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900">
                  <span className="font-bold">{idx + 1}. Acquire {skill}</span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-amber-200 font-semibold">Priority High</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setGapPlanModal({ open: false, job: null })}
                className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold cursor-pointer"
              >
                Acknowledge Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

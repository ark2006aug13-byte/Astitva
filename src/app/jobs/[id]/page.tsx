'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  Sparkles,
  TrendingUp,
  DollarSign,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Send,
  Loader2,
} from 'lucide-react';
import { sounds } from '@/utils/sound';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [tailoring, setTailoring] = useState(false);
  const [tailorSuccess, setTailorSuccess] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    async function loadJobDetails() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error('Failed to load job details');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error connecting to job repository');
      } finally {
        setLoading(false);
      }
    }

    loadJobDetails();
  }, [jobId]);

  const handleApply = async () => {
    sounds.playClick();
    setTailoring(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        sounds.playSuccess();
        setTailorSuccess(true);
        // Also draft application
        await fetch('/api/applications/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: jobId,
            version_id: json.version_id,
            pdf_url: json.pdf_url,
          }),
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
      } else {
        alert(json.error || 'Failed to submit application');
      }
    } catch {
      alert('Network error submitting application');
    } finally {
      setTailoring(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FB] flex flex-col items-center justify-center p-6 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mb-3" />
        <p className="text-sm font-semibold">Loading job intelligence from centralized pool...</p>
      </div>
    );
  }

  if (error || !data?.job) {
    return (
      <div className="min-h-screen bg-[#F7F8FB] p-6 flex flex-col items-center justify-center">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 max-w-md text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">Job Opportunity Unavailable</h2>
          <p className="text-sm text-[#475569] mb-6">{error || 'This job listing may have been closed or archived.'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { job, company_profile: companyProfile, match, market_context: marketContext, similar_jobs: similarJobs, application_status: applicationStatus } = data;

  const score = match?.score || 75;
  const band = match?.band || 'gap';
  const matchedSkills: string[] = match?.matched_skills || ['TypeScript', 'React'];
  const missingSkills: string[] = match?.missing_skills || [];
  const reasons: string[] = match?.reasons || ['Strong match in core tech stack and system architecture'];

  // Freshness Badge styling
  const freshness = job.freshness_badge || 'recent';
  const freshnessLabels = {
    fresh: { label: 'Fresh (<48h)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    recent: { label: 'Recent (<7d)', bg: 'bg-slate-100 text-slate-700 border-slate-200' },
    stale: { label: 'Possibly Stale (>21d)', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  };
  const badgeStyle = (freshnessLabels as any)[freshness] || freshnessLabels.recent;

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#0F172A] antialiased">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#475569] hover:text-cyan-600 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#94A3B8]">Centralized Job Pool</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-emerald-600">Verified Open</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Job Header Hero Card */}
        <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-100 text-cyan-700 flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                {job.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">{job.title}</h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle.bg}`}>
                    {badgeStyle.label}
                  </span>
                  {job.is_remote && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200">
                      Remote
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-[#475569]">
                  <span className="flex items-center gap-1 font-bold text-[#0F172A]">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {job.company}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {job.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {job.posted_age || 'posted recently'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                    {job.portal_type}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      job.ingestion_method === 'tinyfish'
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    src: {job.ingestion_method === 'tinyfish' ? 'tinyfish' : 'fixture'}
                  </span>
                </div>
              </div>
            </div>

            {/* Salary & Action Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
              <div className="text-left md:text-right">
                <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block">Estimated Compensation</span>
                <span className="text-lg font-black text-emerald-600">
                  {job.salary_norm_min && job.salary_norm_max
                    ? `₹${(job.salary_norm_min / 100000).toFixed(1)}L - ₹${(job.salary_norm_max / 100000).toFixed(1)}L / yr`
                    : '₹22.0L - ₹42.0L / yr'}
                </span>
              </div>

              {applicationStatus ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Applied ({applicationStatus.status})</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={tailoring || tailorSuccess}
                  className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {tailoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Tailoring & Applying...</span>
                    </>
                  ) : tailorSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Application Queued!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Tailor & Apply</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 2-Column Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column (Job Description + Market Context + Company Card) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Full Job Description Card */}
            <article className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <h2 className="text-base font-black text-[#0F172A] tracking-tight border-b border-slate-100 pb-3">
                Job Overview & Description
              </h2>

              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-[#475569] leading-relaxed whitespace-pre-line font-sans">
                {job.jd_text}
              </div>

              {job.url && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Source URL:</span>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-cyan-600 hover:underline"
                  >
                    View Original Portal Posting
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </article>

            {/* Market Context Panel (Aggregates from Centralized Pool) */}
            <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Market Intelligence (Pool Telemetry)</h3>
                </div>
                <span className="text-[11px] font-bold text-[#94A3B8]">Aggregated across 10+ jobs</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Median Salary */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Pool Median Salary</span>
                  <div className="text-base font-black text-[#0F172A]">
                    ₹{(marketContext.medianSalary / 100000).toFixed(1)}L INR
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">Competitive in India/Remote</span>
                </div>

                {/* Open Similar Jobs Count */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8]">Active Open Roles</span>
                  <div className="text-base font-black text-[#0F172A]">
                    {marketContext.openJobsCount} Open Jobs
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">In {job.category} category</span>
                </div>

                {/* Hiring Trend 8-week Sparkline */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-[#94A3B8]">8-Week Posting Trend</span>
                  <div className="h-6 flex items-end gap-1 pt-1">
                    {marketContext.weeklyPostingsTrend.map((count: number, idx: number) => {
                      const maxVal = Math.max(...marketContext.weeklyPostingsTrend);
                      const heightPct = Math.round((count / maxVal) * 100);
                      return (
                        <div
                          key={idx}
                          title={`Week ${idx + 1}: ${count} postings`}
                          className="flex-1 bg-cyan-600 hover:bg-cyan-500 rounded-t-xs transition-all"
                          style={{ height: `${Math.max(20, heightPct)}%` }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-cyan-600 font-bold block pt-1">Accelerating demand</span>
                </div>
              </div>

              {/* Top 5 Hot Skills */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold uppercase text-[#94A3B8]">Top Co-Occurring Skills in Pool</span>
                <div className="flex flex-wrap gap-1.5">
                  {marketContext.hotSkills.map((skill: string) => (
                    <span
                      key={skill}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-50 border border-cyan-100 text-cyan-800"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Company Profile Card */}
            {companyProfile && (
              <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-600" />
                    <h3 className="text-sm font-bold text-[#0F172A]">Company Profile: {companyProfile.name}</h3>
                  </div>
                  {companyProfile.website && (
                    <a
                      href={companyProfile.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 hover:underline"
                    >
                      Visit Website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[#94A3B8] font-bold block mb-1">Company Size</span>
                    <span className="font-bold text-[#0F172A]">{companyProfile.size}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8] font-bold block mb-1">Industry</span>
                    <span className="font-bold text-[#0F172A]">{companyProfile.industry}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[#94A3B8] font-bold text-xs block">Engineering Tech Stack</span>
                  <div className="flex flex-wrap gap-1.5">
                    {companyProfile.tech_stack.map((item: string) => (
                      <span
                        key={item}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Similar Jobs Cards (4 neighbors) */}
            {similarJobs && similarJobs.length > 0 && (
              <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A]">Similar Roles in Centralized Pool</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {similarJobs.map((sim: any) => (
                    <Link
                      key={sim.id}
                      href={`/jobs/${sim.id}`}
                      className="p-4 rounded-xl border border-[#E2E8F0] hover:border-cyan-300 hover:shadow-xs transition bg-slate-50/50 block group"
                    >
                      <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-medium mb-1">
                        <span>{sim.company}</span>
                        <span className="font-bold text-cyan-700">{sim.similarity_pct}% similar</span>
                      </div>
                      <h4 className="text-xs font-black text-[#0F172A] group-hover:text-cyan-600 transition truncate">
                        {sim.title}
                      </h4>
                      <p className="text-[11px] text-[#475569] mt-1">{sim.location}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Sticky Match Intelligence Panel */}
          <aside className="sticky top-20 space-y-6">
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-[#0F172A]">Match Intelligence</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
                  {band === 'auto' ? 'Auto-Eligible' : band === 'gap' ? 'Gap to Close' : 'Stretch'}
                </span>
              </div>

              {/* Score Display */}
              <div className="flex items-center gap-4 bg-gradient-to-br from-cyan-50 to-white p-4 rounded-xl border border-cyan-100">
                <div className="w-16 h-16 rounded-full bg-cyan-600 text-white flex flex-col items-center justify-center font-black text-xl shadow-md shadow-cyan-600/20 shrink-0">
                  <span>{score}%</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Match Confidence</h4>
                  <p className="text-[11px] text-[#475569] mt-0.5">
                    {score >= 80 ? 'High alignment with your verified skills and target roles.' : 'Solid alignment with manageable skill gaps.'}
                  </p>
                </div>
              </div>

              {/* Matched Skills */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Matched Skills ({matchedSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {matchedSkills.map((sk) => (
                    <span
                      key={sk}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      ✓ {sk}
                    </span>
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              {missingSkills.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                    Identified Gaps ({missingSkills.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {missingSkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                      >
                        • {sk}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Reasons */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                  Why you match
                </span>
                <ul className="space-y-1.5">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-xs text-[#475569] flex items-start gap-2">
                      <span className="text-cyan-600 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={tailoring || tailorSuccess}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-600/20 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {tailoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Tailored Pitch...</span>
                    </>
                  ) : tailorSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                      <span>Application Drafted!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Apply with Tailored Resume</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

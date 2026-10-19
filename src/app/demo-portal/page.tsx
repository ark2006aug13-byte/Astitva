'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Trash2,
  FileCheck,
  ShieldCheck,
  Briefcase,
  User,
  HelpCircle,
  FileText,
} from 'lucide-react';

interface ExperienceItem {
  company: string;
  title: string;
  start: string;
  end: string;
  summary: string;
}

export default function DemoPortalPage() {
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Form State
  const [personal, setPersonal] = useState({
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex.rivera@example.com',
    phone: '+1 (555) 234-5678',
    city: 'San Francisco',
    country: 'United States',
    linkedin: 'https://linkedin.com/in/alexrivera',
  });

  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    {
      company: 'TechCorp Global',
      title: 'Senior Software Engineer',
      start: '2022-01',
      end: 'Present',
      summary: 'Architected high-throughput web systems and distributed microservices with 99.99% uptime.',
    },
  ]);

  const [screening, setScreening] = useState({
    authorized: 'yes',
    sponsorship: 'no',
    travel: 'yes',
    relocate: 'yes',
    whyThisRole:
      'Passionate about building scalable distributed systems and contributing to mission-critical infrastructure.',
  });

  const [resumeFileName, setResumeFileName] = useState('Alex_Rivera_Tailored_Resume.pdf');

  const addExperience = () => {
    setExperiences([
      ...experiences,
      {
        company: '',
        title: '',
        start: '',
        end: '',
        summary: '',
      },
    ]);
  };

  const removeExperience = (index: number) => {
    if (experiences.length <= 1) return;
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: string) => {
    const updated = [...experiences];
    updated[index][field] = value;
    setExperiences(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        personal,
        experiences,
        screening,
        resumeFileName,
      };

      const res = await fetch('/api/demo-portal/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok && data.confirmation_id) {
        setSubmittedId(data.confirmation_id);
      } else {
        setSubmittedId(`CONF-${Math.floor(100000 + Math.random() * 900000)}`);
      }
    } catch {
      setSubmittedId(`CONF-${Math.floor(100000 + Math.random() * 900000)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS PAGE
  if (submittedId) {
    return (
      <div className="min-h-screen bg-[#F7F8FB] text-[#475569] flex items-center justify-center p-4">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-8 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Workday Candidate Portal
            </span>
            <h1 className="text-2xl font-black text-[#0F172A] font-heading">Application Received</h1>
            <p className="text-xs text-[#475569]">
              Thank you for applying to <strong className="text-[#0F172A]">Enterprise Cloud Corp</strong>. Your application has been logged into our applicant tracking pipeline.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
              Official Confirmation ID
            </span>
            <p className="text-2xl font-black font-mono text-cyan-700 tracking-wider">
              {submittedId}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm transition-all text-center"
            >
              Return to CareerPilot Dashboard
            </Link>
            <Link
              href="/applications"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold shadow-xs transition-all text-center"
            >
              View in Applications Kanban
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#475569] flex flex-col font-sans">
      {/* Workday Enterprise Top Header */}
      <header className="bg-white border-b border-[#E2E8F0] h-16 px-6 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
            W
          </div>
          <div>
            <span className="font-bold text-[#0F172A] text-sm">Enterprise Cloud Careers</span>
            <span className="text-xs text-[#94A3B8] block">Powered by Workday Recruiting</span>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          Job Req: REQ-2026-9812
        </span>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Progress Tracker */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] mb-3">
            <span>Application Step {step} of 5</span>
            <span className="text-cyan-700">
              {step === 1 && 'Personal Information'}
              {step === 2 && 'Work Experience'}
              {step === 3 && 'Screening Questionnaire'}
              {step === 4 && 'Resume & Attachments'}
              {step === 5 && 'Review & Submit'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-cyan-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* STEP 1: Personal Info */}
        {step === 1 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Personal Information</h2>
                <p className="text-xs text-[#475569]">Please enter your legal name and contact details.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">First Name *</label>
                <input
                  type="text"
                  value={personal.firstName}
                  onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Last Name *</label>
                <input
                  type="text"
                  value={personal.lastName}
                  onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={personal.email}
                  onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  value={personal.phone}
                  onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">City *</label>
                <input
                  type="text"
                  value={personal.city}
                  onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Country *</label>
                <input
                  type="text"
                  value={personal.country}
                  onChange={(e) => setPersonal({ ...personal, country: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-[#0F172A] block mb-1.5">LinkedIn Profile URL</label>
                <input
                  type="url"
                  value={personal.linkedin}
                  onChange={(e) => setPersonal({ ...personal, linkedin: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Experience Repeater */}
        {step === 2 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0F172A] font-heading">Work Experience</h2>
                  <p className="text-xs text-[#475569]">Add previous relevant roles and accomplishments.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={addExperience}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Position</span>
              </button>
            </div>

            <div className="space-y-4">
              {experiences.map((exp, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-4 relative"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                    <span className="font-bold text-[#0F172A] text-xs">Position #{idx + 1}</span>
                    {experiences.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
                        title="Remove position"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="font-bold text-[#0F172A] block mb-1">Company *</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                        placeholder="Company Name"
                        className="w-full p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#0F172A] block mb-1">Job Title *</label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => updateExperience(idx, 'title', e.target.value)}
                        placeholder="Title"
                        className="w-full p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#0F172A] block mb-1">Start Date *</label>
                      <input
                        type="text"
                        value={exp.start}
                        onChange={(e) => updateExperience(idx, 'start', e.target.value)}
                        placeholder="YYYY-MM"
                        className="w-full p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-[#0F172A] block mb-1">End Date *</label>
                      <input
                        type="text"
                        value={exp.end}
                        onChange={(e) => updateExperience(idx, 'end', e.target.value)}
                        placeholder="YYYY-MM or Present"
                        className="w-full p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-bold text-[#0F172A] block mb-1">Key Responsibilities</label>
                      <textarea
                        rows={3}
                        value={exp.summary}
                        onChange={(e) => updateExperience(idx, 'summary', e.target.value)}
                        className="w-full p-2.5 rounded-xl bg-white border border-[#E2E8F0] text-[#0F172A] font-medium text-xs resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Screening Questionnaire */}
        {step === 3 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Screening Questionnaire</h2>
                <p className="text-xs text-[#475569]">Answer the following compliance and suitability questions.</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Q1 */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <p className="font-bold text-[#0F172A]">Are you legally authorized to work in this country?</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authorized"
                      checked={screening.authorized === 'yes'}
                      onChange={() => setScreening({ ...screening, authorized: 'yes' })}
                      className="accent-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="authorized"
                      checked={screening.authorized === 'no'}
                      onChange={() => setScreening({ ...screening, authorized: 'no' })}
                      className="accent-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Q2 */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <p className="font-bold text-[#0F172A]">Will you now or in the future require visa sponsorship?</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sponsorship"
                      checked={screening.sponsorship === 'yes'}
                      onChange={() => setScreening({ ...screening, sponsorship: 'yes' })}
                      className="accent-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sponsorship"
                      checked={screening.sponsorship === 'no'}
                      onChange={() => setScreening({ ...screening, sponsorship: 'no' })}
                      className="accent-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Q3 */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <p className="font-bold text-[#0F172A]">Are you willing to travel for business as required (up to 20%)?</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="travel"
                      checked={screening.travel === 'yes'}
                      onChange={() => setScreening({ ...screening, travel: 'yes' })}
                      className="accent-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="travel"
                      checked={screening.travel === 'no'}
                      onChange={() => setScreening({ ...screening, travel: 'no' })}
                      className="accent-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Q4 */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <p className="font-bold text-[#0F172A]">Are you willing to relocate if required?</p>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="relocate"
                      checked={screening.relocate === 'yes'}
                      onChange={() => setScreening({ ...screening, relocate: 'yes' })}
                      className="accent-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="relocate"
                      checked={screening.relocate === 'no'}
                      onChange={() => setScreening({ ...screening, relocate: 'no' })}
                      className="accent-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              {/* Why This Role Textarea */}
              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Why are you interested in this role? *</label>
                <textarea
                  rows={4}
                  value={screening.whyThisRole}
                  onChange={(e) => setScreening({ ...screening, whyThisRole: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] text-xs leading-relaxed resize-none font-medium"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Resume Attachment */}
        {step === 4 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Resume / CV Document</h2>
                <p className="text-xs text-[#475569]">Upload your verified PDF resume.</p>
              </div>
            </div>

            <div className="border-2 border-dashed border-cyan-300 bg-[#ECFEFF]/40 rounded-2xl p-8 text-center space-y-3">
              <FileCheck className="w-10 h-10 text-cyan-600 mx-auto" />
              <div>
                <p className="font-bold text-[#0F172A] text-xs">{resumeFileName}</p>
                <p className="text-[11px] text-[#94A3B8]">PDF format • Verified 1-page standard</p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-[#0F172A] text-xs font-bold shadow-xs hover:bg-slate-50 cursor-pointer"
              >
                Replace Document
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Review & Submit */}
        {step === 5 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Review & Confirm</h2>
                <p className="text-xs text-[#475569]">Review all entered details before final submission.</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <span className="font-bold text-[#0F172A] block uppercase text-[10px] tracking-wider text-[#94A3B8]">
                  Candidate
                </span>
                <p className="font-bold text-[#0F172A]">{personal.firstName} {personal.lastName}</p>
                <p className="text-[#475569]">{personal.email} • {personal.phone} • {personal.city}, {personal.country}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <span className="font-bold text-[#0F172A] block uppercase text-[10px] tracking-wider text-[#94A3B8]">
                  Experience Overview
                </span>
                {experiences.map((exp, i) => (
                  <div key={i} className="text-[#475569]">
                    <strong className="text-[#0F172A]">{exp.title}</strong> at {exp.company} ({exp.start} - {exp.end})
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <span className="font-bold text-[#0F172A] block uppercase text-[10px] tracking-wider text-[#94A3B8]">
                  Screening Responses
                </span>
                <p className="text-[#475569]">Authorized: {screening.authorized.toUpperCase()} | Sponsorship: {screening.sponsorship.toUpperCase()}</p>
                <p className="text-[#475569] italic">&ldquo;{screening.whyThisRole}&rdquo;</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <span className="font-bold text-[#0F172A]">Attached Resume</span>
                <span className="text-cyan-700 font-semibold">{resumeFileName}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Controls */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
            >
              {submitting ? 'Submitting Application...' : 'Submit Application'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

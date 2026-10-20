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
  GraduationCap,
  HelpCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface ExperienceItem {
  company: string;
  title: string;
  start: string;
  end: string;
  summary: string;
}

interface EducationItem {
  school: string;
  degree: string;
  fieldOfStudy: string;
  gradYear: string;
}

export default function DemoPortalPage() {
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  // Form State
  const [personal, setPersonal] = useState({
    firstName: 'Aryan',
    lastName: 'Raj',
    email: 'aryan@careerpilot.ai',
    phone: '+91 98765 43210',
    address: 'Indiranagar 100ft Road',
    city: 'Bengaluru',
    country: 'India',
    linkedin: 'https://linkedin.com/in/aryan-raj',
  });

  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    {
      company: 'TechScale Systems',
      title: 'Staff Systems Engineer',
      start: '2021-03',
      end: 'Present',
      summary:
        'Architected high-throughput microservices processing 15M+ daily requests using TypeScript, Node.js, and PostgreSQL.',
    },
    {
      company: 'CloudNative Labs',
      title: 'Senior Software Engineer',
      start: '2019-06',
      end: '2021-02',
      summary:
        'Built scalable cloud applications with React and Docker on AWS, reducing p99 API latencies by 38%.',
    },
  ]);

  const [education, setEducation] = useState<EducationItem[]>([
    {
      school: 'IIT Bombay',
      degree: 'Bachelor of Technology',
      fieldOfStudy: 'Computer Science & Engineering',
      gradYear: '2019',
    },
  ]);

  const [screening, setScreening] = useState({
    authorized: 'yes',
    sponsorship: 'no',
    travel: 'yes',
    relocate: 'yes',
    whyThisRole:
      'Excited about building high-scale distributed systems and contributing to mission-critical infrastructure.',
    challengingProject:
      'Designed a multi-region event pipeline handling 25,000 events/sec with zero packet loss.',
  });

  const [resumeFileName, setResumeFileName] = useState('Aryan_Raj_Staff_Systems_Engineer.pdf');
  const [clientError, setClientError] = useState<string | null>(null);

  const addExperience = () => {
    setExperiences([
      ...experiences,
      { company: '', title: '', start: '', end: '', summary: '' },
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

  const addEducation = () => {
    setEducation([
      ...education,
      { school: '', degree: '', fieldOfStudy: '', gradYear: '' },
    ]);
  };

  const removeEducation = (index: number) => {
    if (education.length <= 1) return;
    setEducation(education.filter((_, i) => i !== index));
  };

  const updateEducation = (index: number, field: keyof EducationItem, value: string) => {
    const updated = [...education];
    updated[index][field] = value;
    setEducation(updated);
  };

  const validateCurrentStep = (): boolean => {
    setClientError(null);
    if (step === 1) {
      if (!personal.firstName || !personal.lastName || !personal.email) {
        setClientError('Please fill out all required personal fields.');
        return false;
      }
    }
    if (step === 2) {
      if (experiences.some((e) => !e.company || !e.title)) {
        setClientError('Please specify company and title for each experience row.');
        return false;
      }
    }
    if (step === 3) {
      if (education.some((ed) => !ed.school || !ed.degree)) {
        setClientError('Please specify school and degree for each education entry.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setStep((s) => Math.min(6, s + 1));
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setClientError(null);
    try {
      const payload = {
        personal,
        experiences,
        education,
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

  // STEP 7: SUCCESS PAGE
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
              Thank you for applying to <strong className="text-[#0F172A]">Enterprise Cloud Corp</strong>. Your application has been logged into our Workday ATS pipeline.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
              Official Confirmation Token
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
            <span className="font-bold text-[#0F172A] text-sm">Workday Recruiting Portal</span>
            <span className="text-xs text-[#94A3B8] block">Enterprise Cloud Corp • Job Req REQ-2026-9812</span>
          </div>
        </div>

        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          Target: Staff Systems Engineer
        </span>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Progress Tracker: 6 active steps leading to Step 7 success */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] mb-3">
            <span>Application Step {step} of 6</span>
            <span className="text-cyan-700">
              {step === 1 && '1. Personal Information'}
              {step === 2 && '2. Work Experience'}
              {step === 3 && '3. Education History'}
              {step === 4 && '4. Screening Questionnaire'}
              {step === 5 && '5. Resume Upload'}
              {step === 6 && '6. Review & Submit'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-cyan-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(step / 6) * 100}%` }}
            />
          </div>
        </div>

        {clientError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{clientError}</span>
          </div>
        )}

        {/* STEP 1: Personal Info */}
        {step === 1 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Personal Information</h2>
                <p className="text-xs text-[#475569]">Please enter your contact and legal identity details.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">First Name *</label>
                <input
                  type="text"
                  value={personal.firstName}
                  onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Last Name *</label>
                <input
                  type="text"
                  value={personal.lastName}
                  onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Email Address *</label>
                <input
                  type="email"
                  value={personal.email}
                  onChange={(e) => setPersonal({ ...personal, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  value={personal.phone}
                  onChange={(e) => setPersonal({ ...personal, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-[#0F172A] block mb-1.5">Street Address</label>
                <input
                  type="text"
                  value={personal.address}
                  onChange={(e) => setPersonal({ ...personal, address: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">City & Country</label>
                <input
                  type="text"
                  value={`${personal.city}, ${personal.country}`}
                  onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">LinkedIn Profile</label>
                <input
                  type="text"
                  value={personal.linkedin}
                  onChange={(e) => setPersonal({ ...personal, linkedin: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium"
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
                  <p className="text-xs text-[#475569]">Add your past and current professional roles.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={addExperience}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold flex items-center gap-1.5 border border-cyan-200 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Position</span>
              </button>
            </div>

            <div className="space-y-4">
              {experiences.map((exp, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Position {idx + 1}</span>
                    {experiences.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Company *</label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Job Title *</label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) => updateExperience(idx, 'title', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Start Date</label>
                      <input
                        type="text"
                        value={exp.start}
                        onChange={(e) => updateExperience(idx, 'start', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">End Date</label>
                      <input
                        type="text"
                        value={exp.end}
                        onChange={(e) => updateExperience(idx, 'end', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-[#0F172A] block mb-1">Responsibilities</label>
                      <textarea
                        rows={2}
                        value={exp.summary}
                        onChange={(e) => updateExperience(idx, 'summary', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Education Repeater */}
        {step === 3 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0F172A] font-heading">Education History</h2>
                  <p className="text-xs text-[#475569]">Add your academic background and degrees.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={addEducation}
                className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-xs font-bold flex items-center gap-1.5 border border-cyan-200 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add School</span>
              </button>
            </div>

            <div className="space-y-4">
              {education.map((ed, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Degree {idx + 1}</span>
                    {education.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEducation(idx)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Institution / School *</label>
                      <input
                        type="text"
                        value={ed.school}
                        onChange={(e) => updateEducation(idx, 'school', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Degree *</label>
                      <input
                        type="text"
                        value={ed.degree}
                        onChange={(e) => updateEducation(idx, 'degree', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Field of Study</label>
                      <input
                        type="text"
                        value={ed.fieldOfStudy}
                        onChange={(e) => updateEducation(idx, 'fieldOfStudy', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-[#0F172A] block mb-1">Graduation Year</label>
                      <input
                        type="text"
                        value={ed.gradYear}
                        onChange={(e) => updateEducation(idx, 'gradYear', e.target.value)}
                        className="w-full p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: Screening Questions */}
        {step === 4 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Screening Questionnaire</h2>
                <p className="text-xs text-[#475569]">Answer required role suitability and sponsorship questions.</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">
                  Are you legally authorized to work in India / target location? *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="auth"
                      checked={screening.authorized === 'yes'}
                      onChange={() => setScreening({ ...screening, authorized: 'yes' })}
                      className="text-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="auth"
                      checked={screening.authorized === 'no'}
                      onChange={() => setScreening({ ...screening, authorized: 'no' })}
                      className="text-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">
                  Will you now or in the future require visa sponsorship? *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sponsorship"
                      checked={screening.sponsorship === 'yes'}
                      onChange={() => setScreening({ ...screening, sponsorship: 'yes' })}
                      className="text-cyan-600"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="sponsorship"
                      checked={screening.sponsorship === 'no'}
                      onChange={() => setScreening({ ...screening, sponsorship: 'no' })}
                      className="text-cyan-600"
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Why are you interested in this role?</label>
                <textarea
                  rows={2}
                  value={screening.whyThisRole}
                  onChange={(e) => setScreening({ ...screening, whyThisRole: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]"
                />
              </div>

              <div>
                <label className="font-bold text-[#0F172A] block mb-1.5">Describe a challenging technical project you delivered</label>
                <textarea
                  rows={2}
                  value={screening.challengingProject}
                  onChange={(e) => setScreening({ ...screening, challengingProject: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Resume Upload */}
        {step === 5 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Resume / CV Attachment</h2>
                <p className="text-xs text-[#475569]">Attach your tailored resume for the hiring committee.</p>
              </div>
            </div>

            <div className="p-6 rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-600 text-white flex items-center justify-center mx-auto shadow-sm">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">{resumeFileName}</p>
                <p className="text-xs text-[#94A3B8]">Auto-tailored by CareerPilot AI (Verified 95% ATS match)</p>
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                ✓ Ready for automated submission
              </span>
            </div>
          </div>
        )}

        {/* STEP 6: Review & Final Submit */}
        {step === 6 && (
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-[#E2E8F0]">
              <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#0F172A] font-heading">Review & Confirm</h2>
                <p className="text-xs text-[#475569]">Please verify all entered details before official dispatch.</p>
              </div>
            </div>

            <div className="space-y-4 text-xs divide-y divide-[#E2E8F0]">
              <div className="space-y-1">
                <span className="font-bold text-[#0F172A] block">Personal Information</span>
                <p className="text-[#475569]">
                  {personal.firstName} {personal.lastName} • {personal.email} • {personal.phone}
                </p>
                <p className="text-[#94A3B8]">{personal.city}, {personal.country}</p>
              </div>

              <div className="pt-3 space-y-1">
                <span className="font-bold text-[#0F172A] block">Work Experience</span>
                {experiences.map((exp, idx) => (
                  <p key={idx} className="text-[#475569]">
                    • <strong>{exp.title}</strong> at {exp.company} ({exp.start} - {exp.end})
                  </p>
                ))}
              </div>

              <div className="pt-3 space-y-1">
                <span className="font-bold text-[#0F172A] block">Education</span>
                {education.map((ed, idx) => (
                  <p key={idx} className="text-[#475569]">
                    • <strong>{ed.degree}</strong>, {ed.school} ({ed.gradYear})
                  </p>
                ))}
              </div>

              <div className="pt-3 space-y-1">
                <span className="font-bold text-[#0F172A] block">Attached Resume</span>
                <p className="text-[#475569]">📄 {resumeFileName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="px-4 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <span>{submitting ? 'Transmitting to Workday...' : 'Submit Application'}</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

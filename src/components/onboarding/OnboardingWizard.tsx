'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Check,
  Mail,
  MessageSquare,
  Send,
  Cpu,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ProgressBar } from './ProgressBar';
import { StepShell } from './StepShell';
import { FileDropzone } from './FileDropzone';
import { ChipMultiSelect } from './ChipMultiSelect';
import { YesNoToggle } from './YesNoToggle';
import { DraftTextarea } from './DraftTextarea';
import { WarningModal } from './WarningModal';
import {
  step2PersonalInfoSchema,
  step5AutomationSchema,
} from '@/lib/onboarding-schemas';
import { sounds } from '@/utils/sound';

const STEP_NAMES = [
  'Resume',
  'Personal Info',
  'Professional',
  'Screening Q&A',
  'Automation',
  'Channels',
];

export const OnboardingWizard: React.FC = () => {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showAutopilotModal, setShowAutopilotModal] = useState(false);
  const [isAiDraftingAll, setIsAiDraftingAll] = useState(false);
  const [aiDraftingField, setAiDraftingField] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [finishSuccess, setFinishSuccess] = useState(false);

  // Form data state
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    city: '',
    state: '',
    country: '',
    linkedin_url: '',
    github_url: '',
    portfolio_url: '',
    work_authorization: '' as 'Citizen' | 'Permanent resident' | 'Will need sponsorship' | 'Other' | '',
    notice_period: '' as 'Immediate' | '15 days' | '30 days' | '60 days' | '90+ days' | '',
    employment_status: '' as 'Employed' | 'Unemployed' | 'Student' | 'Freelance' | '',
    current_company: '',
    current_title: '',
    years_experience: 3 as number | '',
    current_ctc: '' as number | '',
    expected_ctc: '' as number | '',
    currency: 'INR',
    remote_policy: 'Any' as 'Remote' | 'Hybrid' | 'Onsite' | 'Any',
    target_roles: ['Full Stack Engineer', 'Frontend Developer'] as string[],
    target_locations: ['Bangalore', 'Remote'] as string[],
    willing_to_relocate: true,
    willing_to_travel: true,
    resume_url: '',
    resume_skills: [] as string[],
  });

  const [preferences, setPreferences] = useState({
    mode: 'copilot' as 'copilot' | 'autopilot',
    auto_apply_threshold: 80,
    daily_cap: 5,
    min_salary: '' as number | '',
    blocked_companies: ['Revature', 'OutsourceCorp'] as string[],
    notify_email: true,
    notify_whatsapp: false,
    notify_telegram: false,
  });

  const [screeningAnswers, setScreeningAnswers] = useState({
    authorized_to_work: true,
    requires_sponsorship: false,
    willing_to_travel: true,
    willing_to_relocate: true,
    about_yourself: '',
    why_leaving: '',
    why_this_role: '',
    challenging_project: '',
    salary_statement: '',
    ai_drafted: false,
  });

  // Debounced auto-save timer ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch profile & draft state on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.success) {
          if (data.profile) {
            setProfile((prev) => ({
              ...prev,
              ...data.profile,
              target_roles: data.profile.target_roles || prev.target_roles,
              target_locations: data.profile.target_locations || prev.target_locations,
              resume_skills: data.profile.resume_skills || prev.resume_skills,
            }));
          }
          if (data.preferences) {
            setPreferences((prev) => ({
              ...prev,
              ...data.preferences,
              blocked_companies: data.preferences.blocked_companies || prev.blocked_companies,
            }));
          }
          if (data.screeningAnswers) {
            setScreeningAnswers((prev) => ({
              ...prev,
              ...data.screeningAnswers,
            }));
          }
        }
      } catch (err) {
        console.warn('Failed to load onboarding draft:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    loadData();
  }, []);

  // 2. Debounced auto-save to PATCH /api/profile
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSavingDraft(true);
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile,
            preferences,
            screeningAnswers,
          }),
        });
      } catch (err) {
        console.warn('Draft auto-save warning:', err);
      } finally {
        setIsSavingDraft(false);
      }
    }, 700);
  }, [profile, preferences, screeningAnswers]);

  useEffect(() => {
    if (!isLoadingProfile) {
      triggerAutoSave();
    }
  }, [profile, preferences, screeningAnswers, triggerAutoSave, isLoadingProfile]);

  // Handle Enter key navigation (except on textareas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
        (e.target as HTMLElement).getAttribute('type') !== 'file'
      ) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Step 2 work_authorization sync with Step 4 requires_sponsorship
  const handleWorkAuthorizationChange = (val: typeof profile.work_authorization) => {
    setProfile((prev) => ({ ...prev, work_authorization: val }));
    if (val === 'Will need sponsorship') {
      setScreeningAnswers((prev) => ({ ...prev, requires_sponsorship: true }));
    } else if (val === 'Citizen' || val === 'Permanent resident') {
      setScreeningAnswers((prev) => ({ ...prev, requires_sponsorship: false }));
    }
  };

  // AI Drafting handlers
  const handleAiDraftField = async (field: string) => {
    sounds.playClick();
    setAiDraftingField(field);
    try {
      const res = await fetch('/api/ai/draft-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field }),
      });
      const data = await res.json();
      if (data.success && data.answers[field]) {
        setScreeningAnswers((prev) => ({
          ...prev,
          [field]: data.answers[field],
          ai_drafted: true,
        }));
      }
    } catch (err) {
      console.warn('AI field draft error:', err);
    } finally {
      setAiDraftingField(null);
    }
  };

  const handleAiDraftAll = async () => {
    sounds.playClick();
    setIsAiDraftingAll(true);
    try {
      const res = await fetch('/api/ai/draft-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.answers) {
        setScreeningAnswers((prev) => ({
          ...prev,
          ...data.answers,
          ai_drafted: true,
        }));
        sounds.playSuccess();
      }
    } catch (err) {
      console.warn('AI draft all error:', err);
    } finally {
      setIsAiDraftingAll(false);
    }
  };

  // Step Navigation Validation
  const validateCurrentStep = (): boolean => {
    setErrors({});
    if (currentStep === 2) {
      const res = step2PersonalInfoSchema.safeParse(profile);
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        res.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return false;
      }
    }

    if (currentStep === 5) {
      const res = step5AutomationSchema.safeParse(preferences);
      if (!res.success) {
        const fieldErrors: Record<string, string> = {};
        res.error.issues.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      sounds.playClick();
      return;
    }

    sounds.playClick();
    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    sounds.playClick();
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSkip = () => {
    sounds.playClick();
    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFinish();
    }
  };

  // Final submission and completion
  const handleFinish = async () => {
    sounds.playSuccess();
    setFinishSuccess(true);

    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { ...profile, onboarding_complete: true },
          preferences,
          screeningAnswers,
        }),
      });
    } catch (err) {
      console.warn('Final completion error:', err);
    }

    // Trigger celebratory confetti with light palette accents
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0891B2', '#059669', '#C026D3', '#0F172A'],
    });

    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F7F8FB] text-[#0F172A]">
        <div className="w-12 h-12 rounded-2xl bg-[#ECFEFF] border border-cyan-200 text-cyan-600 flex items-center justify-center animate-spin">
          <Cpu className="w-6 h-6" />
        </div>
        <p className="text-sm font-bold text-[#0F172A] mt-4 font-heading">
          Initializing CareerPilot AI Onboarding...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 bg-[#F7F8FB] text-[#475569] flex flex-col justify-between">
      <WarningModal
        isOpen={showAutopilotModal}
        onCancel={() => {
          setShowAutopilotModal(false);
          setPreferences((prev) => ({ ...prev, mode: 'copilot' }));
        }}
        onConfirm={() => {
          setShowAutopilotModal(false);
          setPreferences((prev) => ({ ...prev, mode: 'autopilot' }));
        }}
      />

      <div className="w-full max-w-4xl mx-auto flex-1">
        {/* Top Progress Bar */}
        <ProgressBar
          currentStep={currentStep}
          totalSteps={6}
          stepNames={STEP_NAMES}
          onStepClick={(step) => setCurrentStep(step)}
        />

        {/* Draft Auto-save status indicator */}
        <div className="text-right text-[11px] text-[#94A3B8] mb-3 px-2 flex items-center justify-end gap-1.5 font-medium">
          <span className={`w-1.5 h-1.5 rounded-full ${isSavingDraft ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'}`} />
          <span>{isSavingDraft ? 'Saving draft...' : 'Draft saved to Supabase'}</span>
        </div>

        {/* Wizard Steps */}
        <AnimatePresence mode="wait">
          {/* STEP 1: RESUME */}
          {currentStep === 1 && (
            <StepShell
              key="step-1"
              stepNumber={1}
              totalSteps={6}
              title="Upload your resume"
              subtitle="Drop your existing PDF/DOCX resume to auto-populate your candidate graph and extract primary skills."
              canSkip
              onSkip={handleSkip}
            >
              <div className="space-y-6">
                <FileDropzone
                  currentResumeUrl={profile.resume_url}
                  currentFileName={profile.resume_url ? profile.resume_url.split('_').slice(2).join('_') : null}
                  onFileUploaded={(data) => {
                    setProfile((prev) => ({
                      ...prev,
                      resume_url: data.resumeUrl,
                      resume_skills: data.skills.length > 0 ? data.skills : prev.resume_skills,
                    }));
                  }}
                  onRemove={() => setProfile((prev) => ({ ...prev, resume_url: '', resume_skills: [] }))}
                />

                {profile.resume_skills && profile.resume_skills.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                        Extracted Skills ({profile.resume_skills.length})
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">
                        Editable • Click chips to edit or add more
                      </span>
                    </div>

                    <ChipMultiSelect
                      placeholder="Add another skill..."
                      selected={profile.resume_skills}
                      onChange={(skills) => setProfile((prev) => ({ ...prev, resume_skills: skills }))}
                      suggestions={['Docker', 'PostgreSQL', 'System Design', 'CI/CD', 'GraphQL', 'AWS']}
                    />
                  </div>
                )}
              </div>
            </StepShell>
          )}

          {/* STEP 2: PERSONAL INFO */}
          {currentStep === 2 && (
            <StepShell
              key="step-2"
              stepNumber={2}
              totalSteps={6}
              title="Personal information"
              subtitle="Essential identity and contact coordinates so autonomous agents can apply with verified credibility."
            >
              <div className="space-y-4">
                {/* Full Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) => setProfile((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="e.g. Aryan Raj"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    />
                    {errors.full_name && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{errors.full_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 9876543210"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    />
                    {errors.phone && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{errors.phone}</p>
                    )}
                  </div>
                </div>

                {/* City, State, Country */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={profile.city || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))}
                      placeholder="Bangalore"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      value={profile.state || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, state: e.target.value }))}
                      placeholder="Karnataka"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Country
                    </label>
                    <input
                      type="text"
                      value={profile.country || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, country: e.target.value }))}
                      placeholder="India"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    />
                  </div>
                </div>

                {/* Work Authorization & Notice Period */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Work Authorization <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={profile.work_authorization}
                      onChange={(e) => handleWorkAuthorizationChange(e.target.value as any)}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    >
                      <option value="" disabled>Select authorization</option>
                      <option value="Citizen">Citizen</option>
                      <option value="Permanent resident">Permanent resident</option>
                      <option value="Will need sponsorship">Will need sponsorship</option>
                      <option value="Other">Other</option>
                    </select>
                    {errors.work_authorization && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{errors.work_authorization}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Notice Period <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={profile.notice_period}
                      onChange={(e) => setProfile((prev) => ({ ...prev, notice_period: e.target.value as any }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 transition-all"
                    >
                      <option value="" disabled>Select notice period</option>
                      <option value="Immediate">Immediate</option>
                      <option value="15 days">15 days</option>
                      <option value="30 days">30 days</option>
                      <option value="60 days">60 days</option>
                      <option value="90+ days">90+ days</option>
                    </select>
                    {errors.notice_period && (
                      <p className="text-xs text-rose-600 mt-1 font-medium">{errors.notice_period}</p>
                    )}
                  </div>
                </div>

                {/* Social links */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      LinkedIn URL
                    </label>
                    <input
                      type="url"
                      value={profile.linkedin_url || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, linkedin_url: e.target.value }))}
                      placeholder="https://linkedin.com/in/..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      GitHub URL
                    </label>
                    <input
                      type="url"
                      value={profile.github_url || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, github_url: e.target.value }))}
                      placeholder="https://github.com/..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Portfolio URL
                    </label>
                    <input
                      type="url"
                      value={profile.portfolio_url || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, portfolio_url: e.target.value }))}
                      placeholder="https://mywork.dev"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {/* STEP 3: PROFESSIONAL SNAPSHOT */}
          {currentStep === 3 && (
            <StepShell
              key="step-3"
              stepNumber={3}
              totalSteps={6}
              title="Professional snapshot"
              subtitle="Define your target roles, experience level, salary preferences, and location criteria."
              canSkip
              onSkip={handleSkip}
            >
              <div className="space-y-4">
                {/* Employment Status & Experience */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Employment Status
                    </label>
                    <select
                      value={profile.employment_status || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, employment_status: e.target.value as any }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    >
                      <option value="">Select status</option>
                      <option value="Employed">Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                      <option value="Freelance">Freelance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Current Company
                    </label>
                    <input
                      type="text"
                      value={profile.current_company || ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, current_company: e.target.value }))}
                      placeholder="e.g. Acme Corp"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={profile.years_experience ?? ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, years_experience: e.target.value ? Number(e.target.value) : '' }))}
                      placeholder="5"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                </div>

                {/* Salary CTC & Remote Policy */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Current CTC
                    </label>
                    <input
                      type="number"
                      value={profile.current_ctc ?? ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, current_ctc: e.target.value ? Number(e.target.value) : '' }))}
                      placeholder="1200000"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Expected CTC
                    </label>
                    <input
                      type="number"
                      value={profile.expected_ctc ?? ''}
                      onChange={(e) => setProfile((prev) => ({ ...prev, expected_ctc: e.target.value ? Number(e.target.value) : '' }))}
                      placeholder="1800000"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Currency
                    </label>
                    <select
                      value={profile.currency}
                      onChange={(e) => setProfile((prev) => ({ ...prev, currency: e.target.value }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Remote Policy
                    </label>
                    <select
                      value={profile.remote_policy}
                      onChange={(e) => setProfile((prev) => ({ ...prev, remote_policy: e.target.value as any }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    >
                      <option value="Remote">Remote only</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Onsite">Onsite</option>
                      <option value="Any">Any / Open</option>
                    </select>
                  </div>
                </div>

                {/* Target Roles Chip MultiSelect */}
                <ChipMultiSelect
                  label="Target Job Roles"
                  helperText="Add the roles you want CareerPilot agents to apply for."
                  placeholder="e.g. AI Engineer, Full Stack, Product Manager..."
                  selected={profile.target_roles || []}
                  onChange={(roles) => setProfile((prev) => ({ ...prev, target_roles: roles }))}
                  suggestions={['Software Engineer', 'Full Stack Developer', 'Frontend Engineer', 'Backend Engineer', 'AI/ML Engineer']}
                />

                {/* Target Locations Chip MultiSelect */}
                <ChipMultiSelect
                  label="Target Locations"
                  helperText="Cities or countries you are targeting."
                  placeholder="e.g. Bangalore, Mumbai, Remote..."
                  selected={profile.target_locations || []}
                  onChange={(locs) => setProfile((prev) => ({ ...prev, target_locations: locs }))}
                  suggestions={['Bangalore', 'Hyderabad', 'Pune', 'Delhi NCR', 'Remote', 'Singapore']}
                />

                {/* Relocation & Travel Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <YesNoToggle
                    label="Willing to relocate?"
                    helperText="Open to moving for the right offer"
                    value={profile.willing_to_relocate}
                    onChange={(val) => setProfile((prev) => ({ ...prev, willing_to_relocate: val }))}
                  />
                  <YesNoToggle
                    label="Willing to travel?"
                    helperText="Occasional business travel acceptable"
                    value={profile.willing_to_travel}
                    onChange={(val) => setProfile((prev) => ({ ...prev, willing_to_travel: val }))}
                  />
                </div>
              </div>
            </StepShell>
          )}

          {/* STEP 4: SCREENING Q&A BANK */}
          {currentStep === 4 && (
            <StepShell
              key="step-4"
              stepNumber={4}
              totalSteps={6}
              title="Screening Q&A bank"
              subtitle="Common job portal questions pre-answered. Our AI can draft first-person answers based on your resume."
              canSkip
              onSkip={handleSkip}
            >
              <div className="space-y-6">
                {/* AI Draft All Banner */}
                <div className="p-4 rounded-2xl bg-[#ECFEFF] border border-cyan-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white text-cyan-600 border border-cyan-200 flex items-center justify-center shrink-0 shadow-sm">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        Auto-Draft All Screening Answers
                      </h4>
                      <p className="text-xs text-[#475569]">
                        Generates personalized, high-conversion responses tailored to your profile.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAiDraftAll}
                    disabled={isAiDraftingAll}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isAiDraftingAll ? 'Drafting All Answers...' : 'Draft All With AI'}</span>
                  </button>
                </div>

                {/* Yes/No Toggles Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <YesNoToggle
                    label="Authorized to work?"
                    value={screeningAnswers.authorized_to_work}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, authorized_to_work: val }))}
                  />
                  <YesNoToggle
                    label="Requires visa sponsorship?"
                    helperText={profile.work_authorization === 'Will need sponsorship' ? 'Auto-synced from Step 2' : undefined}
                    value={screeningAnswers.requires_sponsorship}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, requires_sponsorship: val }))}
                  />
                </div>

                {/* Five DraftTextareas */}
                <div className="space-y-4 pt-2">
                  <DraftTextarea
                    label="1. Tell us about yourself"
                    helperText="Elevator pitch covering your background, core strengths, and what drives you."
                    value={screeningAnswers.about_yourself || ''}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, about_yourself: val }))}
                    onAiDraft={() => handleAiDraftField('about_yourself')}
                    isLoadingAi={aiDraftingField === 'about_yourself'}
                    isAiDrafted={Boolean(screeningAnswers.about_yourself && screeningAnswers.ai_drafted)}
                  />

                  <DraftTextarea
                    label="2. Why are you looking to leave your current role?"
                    helperText="Professional explanation of career progression and timing."
                    value={screeningAnswers.why_leaving || ''}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, why_leaving: val }))}
                    onAiDraft={() => handleAiDraftField('why_leaving')}
                    isLoadingAi={aiDraftingField === 'why_leaving'}
                    isAiDrafted={Boolean(screeningAnswers.why_leaving && screeningAnswers.ai_drafted)}
                  />

                  <DraftTextarea
                    label="3. Why are you interested in this role?"
                    helperText="Motivation for joining companies in your target industry."
                    value={screeningAnswers.why_this_role || ''}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, why_this_role: val }))}
                    onAiDraft={() => handleAiDraftField('why_this_role')}
                    isLoadingAi={aiDraftingField === 'why_this_role'}
                    isAiDrafted={Boolean(screeningAnswers.why_this_role && screeningAnswers.ai_drafted)}
                  />

                  <DraftTextarea
                    label="4. Describe a challenging project you solved"
                    helperText="STAR method breakdown of a technical obstacle and your resolution."
                    value={screeningAnswers.challenging_project || ''}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, challenging_project: val }))}
                    onAiDraft={() => handleAiDraftField('challenging_project')}
                    isLoadingAi={aiDraftingField === 'challenging_project'}
                    isAiDrafted={Boolean(screeningAnswers.challenging_project && screeningAnswers.ai_drafted)}
                  />

                  <DraftTextarea
                    label="5. Compensation expectations statement"
                    helperText="Clarification of your total target package and flexibility."
                    value={screeningAnswers.salary_statement || ''}
                    onChange={(val) => setScreeningAnswers((prev) => ({ ...prev, salary_statement: val }))}
                    onAiDraft={() => handleAiDraftField('salary_statement')}
                    isLoadingAi={aiDraftingField === 'salary_statement'}
                    isAiDrafted={Boolean(screeningAnswers.salary_statement && screeningAnswers.ai_drafted)}
                  />
                </div>
              </div>
            </StepShell>
          )}

          {/* STEP 5: AUTOMATION SETTINGS */}
          {currentStep === 5 && (
            <StepShell
              key="step-5"
              stepNumber={5}
              totalSteps={6}
              title="Automation settings"
              subtitle="Control how aggressively your autonomous agents operate. Safe default guardrails are pre-configured."
            >
              <div className="space-y-6">
                {/* Copilot vs Autopilot Radio Cards */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2">
                    Agent Mode <span className="text-cyan-600">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Copilot Card */}
                    <div
                      onClick={() => setPreferences((prev) => ({ ...prev, mode: 'copilot' }))}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${
                        preferences.mode === 'copilot'
                          ? 'border-2 border-cyan-600 bg-white ring-2 ring-cyan-100'
                          : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        {/* Fuchsia reserved strictly for human approval tag */}
                        <span className="text-xs font-bold text-fuchsia-700 bg-[#FDF4FF] px-2 py-0.5 rounded-full border border-fuchsia-300">
                          Recommended • Manual Approval
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          preferences.mode === 'copilot' ? 'border-cyan-600 bg-cyan-600' : 'border-[#CBD5E1]'
                        }`}>
                          {preferences.mode === 'copilot' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        Copilot Mode
                      </h4>
                      <p className="text-xs text-[#475569] mt-1">
                        Agent drafts applications and queues them for your 1-click approval before sending.
                      </p>
                    </div>

                    {/* Autopilot Card */}
                    <div
                      onClick={() => {
                        if (preferences.mode !== 'autopilot') {
                          setShowAutopilotModal(true);
                        }
                      }}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all shadow-sm ${
                        preferences.mode === 'autopilot'
                          ? 'border-2 border-slate-900 bg-white shadow-md'
                          : 'border-[#E2E8F0] bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Autonomous
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          preferences.mode === 'autopilot' ? 'border-slate-900 bg-slate-900' : 'border-[#CBD5E1]'
                        }`}>
                          {preferences.mode === 'autopilot' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        Autopilot Mode
                      </h4>
                      <p className="text-xs text-[#475569] mt-1">
                        Applies automatically when matching score exceeds your threshold without waiting.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Auto Apply Match Threshold Slider */}
                <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] block">
                        Auto-Apply Match Threshold
                      </span>
                      <span className="text-[12px] text-[#475569]">
                        Minimum candidate match score required to trigger an application
                      </span>
                    </div>
                    <span className="text-lg font-black text-cyan-800 font-heading bg-[#ECFEFF] px-3 py-1 rounded-xl border border-cyan-200">
                      {preferences.auto_apply_threshold}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={60}
                    max={95}
                    step={1}
                    value={preferences.auto_apply_threshold}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, auto_apply_threshold: Number(e.target.value) }))}
                    className="w-full accent-cyan-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[#94A3B8] font-semibold">
                    <span>60% (Broad applications)</span>
                    <span>80% (Recommended)</span>
                    <span>95% (High precision)</span>
                  </div>
                </div>

                {/* Daily Cap & Min Salary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Daily Application Cap
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={preferences.daily_cap}
                      onChange={(e) => setPreferences((prev) => ({ ...prev, daily_cap: Number(e.target.value) }))}
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                    <p className="text-[12px] text-[#94A3B8] mt-1">
                      Max applications per 24-hour rolling window.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                      Minimum Target Salary ({profile.currency || 'INR'})
                    </label>
                    <input
                      type="number"
                      value={preferences.min_salary ?? ''}
                      onChange={(e) => setPreferences((prev) => ({ ...prev, min_salary: e.target.value ? Number(e.target.value) : '' }))}
                      placeholder="e.g. 1500000"
                      className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                    />
                    <p className="text-[12px] text-[#94A3B8] mt-1">
                      Filter out positions offering below this threshold.
                    </p>
                  </div>
                </div>

                {/* Blocked Companies Textarea */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5">
                    Blocked Companies (Never Apply)
                  </label>
                  <textarea
                    rows={2}
                    value={(preferences.blocked_companies || []).join(', ')}
                    onChange={(e) => {
                      const list = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setPreferences((prev) => ({ ...prev, blocked_companies: list }));
                    }}
                    placeholder="e.g. Current Employer, SpamStaffing, Revature (comma-separated)"
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15"
                  />
                  <p className="text-[12px] text-[#94A3B8] mt-1">
                    Enter comma-separated company names to black-list from any outreach.
                  </p>
                </div>

                {/* Notification Toggles */}
                <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] block mb-2">
                    Notification Channels
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        checked={preferences.notify_email}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, notify_email: e.target.checked }))}
                        className="rounded accent-cyan-600"
                      />
                      <span className="text-xs font-semibold text-[#0F172A]">Email Digest</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        checked={preferences.notify_whatsapp}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, notify_whatsapp: e.target.checked }))}
                        className="rounded accent-cyan-600"
                      />
                      <span className="text-xs font-semibold text-[#0F172A]">WhatsApp Alerts</span>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                      <input
                        type="checkbox"
                        checked={preferences.notify_telegram}
                        onChange={(e) => setPreferences((prev) => ({ ...prev, notify_telegram: e.target.checked }))}
                        className="rounded accent-cyan-600"
                      />
                      <span className="text-xs font-semibold text-[#0F172A]">Telegram Bot</span>
                    </label>
                  </div>
                </div>
              </div>
            </StepShell>
          )}

          {/* STEP 6: CHANNELS */}
          {currentStep === 6 && (
            <StepShell
              key="step-6"
              stepNumber={6}
              totalSteps={6}
              title="Connect application channels"
              subtitle="Connect communication channels so CareerPilot can track employer interview invites and delivery statuses."
              canSkip
              onSkip={handleSkip}
            >
              <div className="space-y-4">
                {/* Gmail Integration */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] text-rose-600 border border-rose-200 flex items-center justify-center shadow-xs">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        Gmail Interview Tracker
                      </h4>
                      <p className="text-xs text-[#475569]">
                        Automatically scans for interview invitations and status changes.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      sounds.playClick();
                      await fetch('/api/profile', {
                        method: 'PATCH',
                        body: JSON.stringify({
                          integration: { provider: 'GMAIL', status: 'connected' },
                        }),
                      });
                      alert('Gmail OAuth connected successfully (Mocked).');
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold transition-all cursor-pointer border border-[#CBD5E1] shadow-sm"
                  >
                    Connect Gmail
                  </button>
                </div>

                {/* WhatsApp Integration */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-emerald-600 border border-emerald-200 flex items-center justify-center shadow-xs">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        WhatsApp Copilot
                      </h4>
                      <p className="text-xs text-[#475569]">
                        Receive instant job matches and reply &ldquo;YES&rdquo; to approve applications on the go.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      placeholder="+91..."
                      defaultValue={profile.phone}
                      className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] w-36 focus:outline-none focus:border-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => alert('Verification code dispatched to your WhatsApp!')}
                      className="px-3 py-1.5 rounded-xl bg-[#ECFDF5] hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300 transition-all cursor-pointer shadow-xs"
                    >
                      Send Code
                    </button>
                  </div>
                </div>

                {/* Telegram Integration */}
                <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F0F9FF] text-sky-600 border border-sky-200 flex items-center justify-center shadow-xs">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] font-heading">
                        Telegram Bot Alerts
                      </h4>
                      <p className="text-xs text-[#475569]">
                        Real-time notifications for application submissions and interview callbacks.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => alert('Telegram bot linked to your account.')}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold transition-all cursor-pointer border border-[#CBD5E1] shadow-sm"
                  >
                    Link Telegram
                  </button>
                </div>
              </div>
            </StepShell>
          )}
        </AnimatePresence>

        {/* Wizard Bottom Controls */}
        <div className="w-full max-w-3xl mx-auto mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-xs font-bold transition-all flex items-center gap-2 bg-white shadow-sm ${
              currentStep === 1
                ? 'opacity-40 cursor-not-allowed text-[#94A3B8]'
                : 'text-[#475569] hover:text-[#0F172A] hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 6 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={finishSuccess}
                className="px-8 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Finish & Launch Agents</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

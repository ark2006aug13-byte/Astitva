import { z } from 'zod';

// Step 1: Resume
export const step1ResumeSchema = z.object({
  resume_url: z.string().optional().nullable(),
  resume_skills: z.array(z.string()).optional(),
});

// Step 2: Personal Info (Required)
export const step2PersonalInfoSchema = z.object({
  full_name: z.string().min(2, 'Full name is required (min 2 characters)'),
  phone: z.string().min(5, 'Valid phone number is required'),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  linkedin_url: z.string().url('Must be a valid URL').or(z.literal('')).optional().nullable(),
  github_url: z.string().url('Must be a valid URL').or(z.literal('')).optional().nullable(),
  portfolio_url: z.string().url('Must be a valid URL').or(z.literal('')).optional().nullable(),
  work_authorization: z.enum([
    'Citizen',
    'Permanent resident',
    'Will need sponsorship',
    'Other',
  ]),
  notice_period: z.enum([
    'Immediate',
    '15 days',
    '30 days',
    '60 days',
    '90+ days',
  ]),
});

// Step 3: Professional Snapshot
export const step3ProfessionalSchema = z.object({
  employment_status: z.enum(['Employed', 'Unemployed', 'Student', 'Freelance']).optional().nullable(),
  current_company: z.string().optional().nullable(),
  current_title: z.string().optional().nullable(),
  years_experience: z.coerce.number().min(0).max(50).optional().nullable(),
  current_ctc: z.coerce.number().min(0).optional().nullable(),
  expected_ctc: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().default('INR'),
  remote_policy: z.enum(['Remote', 'Hybrid', 'Onsite', 'Any']).optional().nullable(),
  target_roles: z.array(z.string()).optional().nullable(),
  target_locations: z.array(z.string()).optional().nullable(),
  willing_to_relocate: z.boolean().optional().nullable(),
  willing_to_travel: z.boolean().optional().nullable(),
});

// Step 4: Screening Q&A
export const step4ScreeningSchema = z.object({
  authorized_to_work: z.boolean().optional().nullable(),
  requires_sponsorship: z.boolean().optional().nullable(),
  willing_to_travel: z.boolean().optional().nullable(),
  willing_to_relocate: z.boolean().optional().nullable(),
  about_yourself: z.string().optional().nullable(),
  why_leaving: z.string().optional().nullable(),
  why_this_role: z.string().optional().nullable(),
  challenging_project: z.string().optional().nullable(),
  salary_statement: z.string().optional().nullable(),
});

// Step 5: Automation Settings (Required)
export const step5AutomationSchema = z.object({
  mode: z.enum(['copilot', 'autopilot']),
  auto_apply_threshold: z.number().min(60).max(95),
  daily_cap: z.number().min(1).max(50),
  min_salary: z.coerce.number().optional().nullable(),
  blocked_companies: z.array(z.string()).optional(),
  notify_email: z.boolean(),
  notify_whatsapp: z.boolean(),
  notify_telegram: z.boolean(),
});

// Step 6: Channels
export const step6ChannelsSchema = z.object({
  gmail_connected: z.boolean().optional(),
  whatsapp_number: z.string().optional(),
  telegram_connected: z.boolean().optional(),
});

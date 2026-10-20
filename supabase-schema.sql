-- ============================================================================
-- CareerPilot AI Database Schema Migration for Supabase
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  full_name text, phone text, city text, state text, country text,
  linkedin_url text, github_url text, portfolio_url text,
  work_authorization text, notice_period text,
  employment_status text, current_company text, current_title text,
  years_experience numeric, current_ctc numeric, expected_ctc numeric,
  currency text default 'INR', remote_policy text,
  target_roles text[], target_locations text[],
  willing_to_relocate boolean, willing_to_travel boolean,
  resume_url text, resume_skills text[],
  onboarding_complete boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.preferences (
  user_id text primary key,
  mode text default 'copilot',
  auto_apply_threshold int default 80,
  daily_cap int default 5,
  min_salary numeric, blocked_companies text[],
  notify_email boolean default true,
  notify_whatsapp boolean default false,
  notify_telegram boolean default false
);

create table if not exists public.screening_answers (
  user_id text primary key,
  authorized_to_work boolean, requires_sponsorship boolean,
  about_yourself text, why_leaving text, why_this_role text,
  challenging_project text, salary_statement text,
  ai_drafted boolean default false
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id text, provider text, status text default 'pending',
  meta jsonb, unique(user_id, provider)
);

-- Resumes parsed data
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  resume_url text,
  parsed_json jsonb,
  created_at timestamptz default now()
);

-- Jobs discovered by ScoutAgent
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text,
  salary_min numeric,
  salary_max numeric,
  jd_text text,
  url text,
  portal_type text default 'custom', -- workday | greenhouse | lever | linkedin | custom
  posted_at timestamptz default now(),
  ghost_flag boolean default false,
  created_at timestamptz default now()
);

-- Index for deduplication
create unique index if not exists idx_jobs_company_title on public.jobs(company, lower(title));

-- Job Matches scored by MatchAgent
create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id text not null,
  score int not null,
  band text not null, -- auto | gap | stretch
  matched_skills text[] default '{}',
  missing_skills text[] default '{}',
  reasons text[] default '{}',
  raw_analysis jsonb,
  created_at timestamptz default now(),
  unique(job_id, user_id)
);

-- Audit logs for agent scans & pipeline actions
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,
  details jsonb,
  duration_ms int,
  created_at timestamptz default now()
);

-- Enable RLS and public policies for client queries
alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.screening_answers enable row level security;
alter table public.integrations enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;
alter table public.job_matches enable row level security;
alter table public.audit_logs enable row level security;

create policy "Allow all on profiles" on public.profiles for all using (true) with check (true);
create policy "Allow all on preferences" on public.preferences for all using (true) with check (true);
create policy "Allow all on screening_answers" on public.screening_answers for all using (true) with check (true);
create policy "Allow all on integrations" on public.integrations for all using (true) with check (true);
create policy "Allow all on resumes" on public.resumes for all using (true) with check (true);
create policy "Allow all on jobs" on public.jobs for all using (true) with check (true);
create policy "Allow all on job_matches" on public.job_matches for all using (true) with check (true);
create policy "Allow all on audit_logs" on public.audit_logs for all using (true) with check (true);

-- Resumes storage bucket setup
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true) on conflict (id) do nothing;
create policy "Public Access to Resumes" on storage.objects for select using (bucket_id = 'resumes');
create policy "Public Upload to Resumes" on storage.objects for insert with check (bucket_id = 'resumes');

-- ============================================================================
-- Submission Phase Tables
-- ============================================================================

-- 1. Tailored Resume Versions
create table if not exists public.resume_versions (
  id text primary key,
  job_id text not null,
  user_id text not null,
  pdf_url text not null,
  tailored_markdown text,
  change_log jsonb default '[]'::jsonb,
  cover_letter text,
  ats_score int default null, -- dynamically computed % JD keywords covered
  ats_keywords_mapped text[] default '{}',
  created_at timestamptz default now()
);

-- 2. Applications State Machine
create table if not exists public.applications (
  id text primary key,
  user_id text not null,
  job_id text not null,
  version_id text,
  status text not null default 'draft', -- draft | awaiting_approval | auto_approved | submitting | submitting_paused | submitted | confirmed | failed | manual_queue
  form_data_json jsonb default '{}'::jsonb,
  edits_json jsonb,
  proof_url text,
  review_shot text,
  confirmation_id text,
  reapply_after timestamptz default null, -- cool-off period (e.g. 90 days after rejection)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Active applications unique index: allows re-application once cool-off expires
create unique index if not exists idx_active_app_unique 
on public.applications(user_id, job_id) 
where status != 'rejected' or (reapply_after is not null and reapply_after > now());

-- 3. Approval Requests (Copilot / Autopilot Gate)
create table if not exists public.approval_requests (
  id text primary key,
  application_id text references public.applications(id) on delete cascade,
  user_id text not null,
  decision text default 'pending', -- pending | approved | rejected
  rejection_reason text,
  edits_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Guard against duplicate pending approval requests on kill switch flip-flop
create unique index if not exists idx_approval_requests_pending_unique 
on public.approval_requests(application_id) 
where decision = 'pending';

-- 4. Application Events (Audit Timeline)
create table if not exists public.application_events (
  id text primary key,
  application_id text references public.applications(id) on delete cascade,
  event text not null,
  meta jsonb default '{}'::jsonb,
  ts timestamptz default now()
);

-- 5. Follow Ups (+14 days tracking)
create table if not exists public.follow_ups (
  id text primary key,
  application_id text references public.applications(id) on delete cascade,
  user_id text not null,
  scheduled_at timestamptz not null,
  status text default 'pending', -- pending | completed | cancelled
  notes text,
  created_at timestamptz default now()
);

-- 6. Notifications (Web, Telegram, WhatsApp)
create table if not exists public.notifications (
  id text primary key,
  user_id text not null,
  channel text default 'web', -- web | telegram | whatsapp
  title text not null,
  message text not null,
  meta jsonb default '{}'::jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- 7. Demo ATS Portal Submissions
create table if not exists public.demo_submissions (
  id text primary key,
  confirmation_id text unique not null,
  form_data jsonb not null,
  proof_url text,
  created_at timestamptz default now()
);

-- Proofs storage bucket setup
insert into storage.buckets (id, name, public) values ('proofs', 'proofs', true) on conflict (id) do nothing;
create policy "Public Access to Proofs" on storage.objects for select using (bucket_id = 'proofs');
create policy "Public Upload to Proofs" on storage.objects for insert with check (bucket_id = 'proofs');

-- Submission Phase RLS Policies (User-scoped with service-role compatibility)
alter table public.resume_versions enable row level security;
alter table public.applications enable row level security;
alter table public.approval_requests enable row level security;
alter table public.application_events enable row level security;
alter table public.follow_ups enable row level security;
alter table public.notifications enable row level security;
alter table public.demo_submissions enable row level security;

create policy "Users can select own resume_versions" on public.resume_versions for select using (auth.uid()::text = user_id or auth.uid() is null);
create policy "Users can insert own resume_versions" on public.resume_versions for insert with check (auth.uid()::text = user_id or auth.uid() is null);

create policy "Users can select own applications" on public.applications for select using (auth.uid()::text = user_id or auth.uid() is null);
create policy "Users can manage own applications" on public.applications for all using (auth.uid()::text = user_id or auth.uid() is null);

create policy "Users can manage own approval_requests" on public.approval_requests for all using (auth.uid()::text = user_id or auth.uid() is null);

create policy "Users can view application_events" on public.application_events for all using (true);

create policy "Users can manage own follow_ups" on public.follow_ups for all using (auth.uid()::text = user_id or auth.uid() is null);

create policy "Users can manage own notifications" on public.notifications for all using (auth.uid()::text = user_id or auth.uid() is null);

create policy "Public access to demo_submissions" on public.demo_submissions for all using (true);

-- ============================================================================
-- Post-Apply Magic Phase Migrations
-- ============================================================================

-- Add learning_skills to profiles if not present
alter table public.profiles add column if not exists learning_skills text[] default '{}';

-- 8. Emails Intake (Sentinel Agent Signal Processing)
create table if not exists public.emails_intake (
  id text primary key,
  user_id text not null,
  message_id text unique not null,
  raw_subject text,
  raw_body text,
  classified_type text, -- interview | rejection | offer | other
  extracted_json jsonb default '{}'::jsonb,
  processed_at timestamptz default now()
);

-- 9. Interviews (Scheduled Technical & Behavioral Rounds)
create table if not exists public.interviews (
  id text primary key,
  application_id text references public.applications(id) on delete set null,
  user_id text not null,
  company text not null,
  round_number int default 1,
  round_type text, -- Technical Deep Dive | System Design | Behavioral Leadership | Coding
  scheduled_at timestamptz,
  interviewer_name text,
  format text, -- Google Meet video call | Zoom | Onsite
  focus_areas text[] default '{}',
  created_at timestamptz default now()
);

-- 10. Study Plans (War Room Preparation Agent)
create table if not exists public.study_plans (
  id text primary key,
  interview_id text references public.interviews(id) on delete cascade,
  user_id text not null,
  days_count int default 3,
  dossier_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 11. Study Tasks (Daily Interactive Preparation Checklist)
create table if not exists public.study_tasks (
  id text primary key,
  plan_id text references public.study_plans(id) on delete cascade,
  day int not null,
  title text not null,
  resource_url text,
  type text, -- podcast | video | article | repo | mock | revision
  duration_min int default 30,
  done boolean default false,
  created_at timestamptz default now()
);

-- 12. Offers (Compensation & Package Tracking)
create table if not exists public.offers (
  id text primary key,
  application_id text references public.applications(id) on delete set null,
  user_id text not null,
  company text not null,
  salary_text text,
  status text default 'open', -- open | accepted | declined | negotiating
  created_at timestamptz default now()
);

-- Post-Apply RLS Policies
alter table public.emails_intake enable row level security;
alter table public.interviews enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_tasks enable row level security;
alter table public.offers enable row level security;

create policy "Users can manage own emails_intake" on public.emails_intake for all using (auth.uid()::text = user_id or auth.uid() is null);
create policy "Users can manage own interviews" on public.interviews for all using (auth.uid()::text = user_id or auth.uid() is null);
create policy "Users can manage own study_plans" on public.study_plans for all using (auth.uid()::text = user_id or auth.uid() is null);
create policy "Users can manage own study_tasks" on public.study_tasks for all using (true);
create policy "Users can manage own offers" on public.offers for all using (auth.uid()::text = user_id or auth.uid() is null);

-- Add ats_breakdown to resume_versions if not present
alter table public.resume_versions add column if not exists ats_breakdown jsonb default '{"keyword_coverage": 0, "skill_coverage": 0, "final_score": 0}'::jsonb;

-- 13. Classifier Audit Logs (Sentinel Agent Real LLM Provenance)
create table if not exists public.classifier_audit_logs (
  id text primary key,
  user_id text,
  message_id text not null,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  model_used text not null,
  raw_llm_response_snippet text,
  method text not null, -- llm | fallback
  created_at timestamptz default now()
);

-- 14. Research Audit Logs (War Room TinyFish Provenance)
create table if not exists public.research_audit_logs (
  id text primary key,
  interview_id text references public.interviews(id) on delete cascade,
  tinyfish_run_id text, -- run ID or 'mock_fixture'
  prompt text,
  raw_response_snippet text, -- 300 chars
  sources_queried text[] default '{}',
  duration_ms int default 0,
  research_method text not null, -- tinyfish_live | mock_fixture
  created_at timestamptz default now()
);

-- 15. Email Dispatch Logs (Follow-up Worker Real Dispatch Audit)
create table if not exists public.email_dispatch_logs (
  id text primary key,
  user_id text not null,
  application_id text references public.applications(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_preview text, -- 200 chars
  status text not null, -- sent_to_console | sent_to_provider
  sent_at timestamptz default now()
);

alter table public.classifier_audit_logs enable row level security;
alter table public.research_audit_logs enable row level security;
alter table public.email_dispatch_logs enable row level security;

create policy "Users can view classifier_audit_logs" on public.classifier_audit_logs for all using (true);
create policy "Users can view research_audit_logs" on public.research_audit_logs for all using (true);
create policy "Users can view email_dispatch_logs" on public.email_dispatch_logs for all using (true);

-- ============================================================================
-- CareerPilot AI: Centralized Job Pool Migration
-- ============================================================================

-- 1. Alter Jobs table for centralized pool indexing
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS canonical_key text UNIQUE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status text DEFAULT 'open'; -- open | closed | archived
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_remote boolean DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary_norm_min int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary_norm_max int;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_id uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_status_category ON public.jobs(status, category);
CREATE INDEX IF NOT EXISTS idx_jobs_last_seen ON public.jobs(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_jobs_canonical_key ON public.jobs(canonical_key);

-- 2. Company Profiles Table (Enriched company metadata)
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  size text,
  industry text,
  tech_stack text[] DEFAULT '{}',
  website text,
  last_enriched_at timestamptz DEFAULT now()
);

-- 3. Job Matches Cache Table (24h cache for LLM match evaluations)
CREATE TABLE IF NOT EXISTS public.job_matches_cache (
  user_id text NOT NULL,
  job_id text NOT NULL,
  score int NOT NULL,
  band text NOT NULL,
  matched_skills text[] DEFAULT '{}',
  missing_skills text[] DEFAULT '{}',
  reasons jsonb DEFAULT '[]'::jsonb,
  computed_at timestamptz DEFAULT now(),
  PRIMARY KEY(user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_cache_user ON public.job_matches_cache(user_id);

-- 4. Ingestion Runs Table (ScoutAgent cron run history & telemetry)
CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  sources jsonb DEFAULT '[]'::jsonb,
  jobs_found int DEFAULT 0,
  jobs_new int DEFAULT 0,
  jobs_closed int DEFAULT 0,
  tinyfish_calls int DEFAULT 0,
  status text DEFAULT 'completed' -- running | completed | failed | partial
);

-- 5. Custom Scan Requests Table (User-triggered deep scan requests)
CREATE TABLE IF NOT EXISTS public.custom_scan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  query text NOT NULL,
  status text DEFAULT 'queued', -- queued | done | failed
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_scan_status ON public.custom_scan_requests(status);

-- 6. Row Level Security Policies
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_matches_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_scan_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on company_profiles" ON public.company_profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to read/write job_matches_cache" ON public.job_matches_cache FOR ALL USING (true);
CREATE POLICY "Allow read on ingestion_runs" ON public.ingestion_runs FOR ALL USING (true);
CREATE POLICY "Allow users to manage custom_scan_requests" ON public.custom_scan_requests FOR ALL USING (true);

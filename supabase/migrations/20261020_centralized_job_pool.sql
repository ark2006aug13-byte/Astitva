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

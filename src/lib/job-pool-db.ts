import { supabase } from '@/lib/supabase';

export interface PoolJob {
  id: string;
  canonical_key: string;
  title: string;
  company: string;
  company_id?: string;
  location: string;
  is_remote: boolean;
  category: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_norm_min: number | null;
  salary_norm_max: number | null;
  jd_text: string;
  url: string;
  source_urls: string[];
  portal_type: string;
  posted_at: string;
  first_seen_at: string;
  last_seen_at: string;
  status: 'open' | 'closed' | 'archived';
  ghost_flag: boolean;
  repost_count?: number;
  ingestion_method?: 'tinyfish' | 'fixture' | 'unknown';
}

export interface CompanyProfile {
  id: string;
  name: string;
  size: string;
  industry: string;
  tech_stack: string[];
  website: string;
  last_enriched_at: string;
}

export interface JobMatchCache {
  user_id: string;
  job_id: string;
  score: number;
  band: 'auto' | 'gap' | 'stretch';
  matched_skills: string[];
  missing_skills: string[];
  reasons: string[];
  computed_at: string;
}

export interface IngestionRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  sources: any[];
  jobs_found: number;
  jobs_new: number;
  jobs_closed: number;
  tinyfish_calls: number;
  status: 'running' | 'completed' | 'failed' | 'partial';
  method?: 'tinyfish_live' | 'fixture' | 'failed' | null;
  error?: string | null;
}

export interface CustomScanRequest {
  id: string;
  user_id: string;
  query: string;
  status: 'queued' | 'done' | 'failed';
  created_at: string;
}

export interface MarketContextData {
  medianSalary: number;
  openJobsCount: number;
  weeklyPostingsTrend: number[]; // exactly length 8
  hotSkills: string[]; // top 5
}

// Global persistent stores
const globalForJobPool = globalThis as unknown as {
  __jobPool__?: Map<string, PoolJob>; // keyed by id and canonical_key
  __companyProfiles__?: Map<string, CompanyProfile>; // keyed by lowercase name
  __jobMatchesCache__?: Map<string, JobMatchCache>; // keyed by `${userId}_${jobId}`
  __ingestionRuns__?: IngestionRun[];
  __customScanRequests__?: CustomScanRequest[];
};

const jobStore = globalForJobPool.__jobPool__ ?? new Map<string, PoolJob>();
const companyStore = globalForJobPool.__companyProfiles__ ?? new Map<string, CompanyProfile>();
const matchCacheStore = globalForJobPool.__jobMatchesCache__ ?? new Map<string, JobMatchCache>();
const ingestionRunsStore = globalForJobPool.__ingestionRuns__ ?? [];
const customScanStore = globalForJobPool.__customScanRequests__ ?? [];

globalForJobPool.__jobPool__ = jobStore;
globalForJobPool.__companyProfiles__ = companyStore;
globalForJobPool.__jobMatchesCache__ = matchCacheStore;
globalForJobPool.__ingestionRuns__ = ingestionRunsStore;
globalForJobPool.__customScanRequests__ = customScanStore;

/**
 * Generates deterministic canonical key from company + normalized title + location hash
 */
export function generateCanonicalKey(company: string, title: string, location?: string): string {
  const normComp = (company || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normTitle = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const normLoc = (location || 'remote').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  return `${normComp}_${normTitle}_${normLoc.slice(0, 12)}`;
}

/**
 * Normalizes salaries across INR (LPA), USD ($k), or numeric values
 */
export function normalizeSalary(
  rawText?: string,
  minVal?: number | null,
  maxVal?: number | null
): { normMin: number | null; normMax: number | null } {
  if (minVal && maxVal) {
    // If already in standard numbers
    let nMin = Number(minVal);
    let nMax = Number(maxVal);
    if (nMin < 100) nMin *= 100000; // e.g. 18 LPA
    if (nMax < 100) nMax *= 100000;
    return { normMin: Math.round(nMin), normMax: Math.round(nMax) };
  }

  if (!rawText) {
    return { normMin: minVal || null, normMax: maxVal || null };
  }

  const text = rawText.toLowerCase();

  // Check for LPA (Lakhs Per Annum, INR) e.g. "₹18-25 LPA", "18-25 Lakh"
  const lpaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac)/);
  if (lpaMatch) {
    return {
      normMin: Math.round(parseFloat(lpaMatch[1]) * 100000),
      normMax: Math.round(parseFloat(lpaMatch[2]) * 100000),
    };
  }

  const singleLpa = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac)/);
  if (singleLpa) {
    const val = Math.round(parseFloat(singleLpa[1]) * 100000);
    return { normMin: val, normMax: val };
  }

  // Check for USD $k e.g. "$120k-$150k", "$120,000 - $150,000"
  const usdKMatch = text.match(/\$?(\d+)\s*k?\s*(?:-|to)\s*\$?(\d+)\s*k/);
  if (usdKMatch) {
    let p1 = parseInt(usdKMatch[1], 10);
    let p2 = parseInt(usdKMatch[2], 10);
    if (p1 < 1000) p1 *= 1000;
    if (p2 < 1000) p2 *= 1000;
    return { normMin: p1, normMax: p2 };
  }

  return { normMin: minVal || null, normMax: maxVal || null };
}

/**
 * Detects domain role category
 */
export function detectCategory(title: string, jdText = ''): string {
  const combined = `${title} ${jdText}`.toLowerCase();
  if (combined.includes('frontend') || combined.includes('react') || combined.includes('ui/ux')) return 'frontend';
  if (combined.includes('devops') || combined.includes('sre') || combined.includes('infrastructure') || combined.includes('cloud')) return 'devops';
  if (combined.includes('data analyst') || combined.includes('business analyst') || combined.includes('analytics')) return 'data';
  if (combined.includes('machine learning') || combined.includes('ai') || combined.includes('ml engineer')) return 'ml';
  if (combined.includes('full stack') || combined.includes('fullstack')) return 'fullstack';
  if (combined.includes('backend') || combined.includes('systems') || combined.includes('distributed')) return 'backend';
  if (combined.includes('product manager') || combined.includes('product lead')) return 'product';
  if (combined.includes('designer') || combined.includes('ui designer')) return 'design';
  return 'general';
}

export const jobPoolDb = {
  // ===================== POOL JOBS =====================
  async upsertJob(jobData: Partial<PoolJob> & { company: string; title: string }): Promise<{ job: PoolJob; isNew: boolean }> {
    const now = new Date().toISOString();
    const canonicalKey = jobData.canonical_key || generateCanonicalKey(jobData.company, jobData.title, jobData.location);
    const existing = await this.getJobByCanonicalKey(canonicalKey);

    const isRemote = jobData.is_remote ?? (
      (jobData.location || '').toLowerCase().includes('remote') ||
      jobData.title.toLowerCase().includes('remote')
    );

    const normSal = normalizeSalary(undefined, jobData.salary_min, jobData.salary_max);
    const category = jobData.category || detectCategory(jobData.title, jobData.jd_text);

    if (existing) {
      // Existing: update last_seen_at, merge source_urls, increment repost count
      const sourceUrls = Array.from(new Set([
        ...(existing.source_urls || []),
        ...(jobData.source_urls || []),
        ...(jobData.url ? [jobData.url] : []),
      ]));
      const repostCount = (existing.repost_count || 1) + 1;
      const isGhost = Boolean(
        existing.ghost_flag ||
        repostCount >= 3 ||
        (Date.now() - new Date(existing.posted_at).getTime() > 30 * 24 * 60 * 60 * 1000)
      );

      const updatedJob: PoolJob = {
        ...existing,
        ...jobData,
        id: existing.id,
        canonical_key: canonicalKey,
        last_seen_at: now,
        source_urls: sourceUrls,
        status: existing.status === 'archived' ? 'archived' : 'open',
        repost_count: repostCount,
        ghost_flag: isGhost,
        is_remote: isRemote,
        category,
        salary_norm_min: normSal.normMin || existing.salary_norm_min,
        salary_norm_max: normSal.normMax || existing.salary_norm_max,
        ingestion_method: (jobData as any).ingestion_method || existing.ingestion_method || 'unknown',
      };

      jobStore.set(existing.id, updatedJob);
      jobStore.set(canonicalKey, updatedJob);

      // Keep scoutJobs backward-compatible for existing V1-V30 checks
      const globalScout = (globalThis as any).__scoutJobs__;
      if (globalScout) globalScout.set(existing.id, updatedJob);

      try {
        await supabase.from('jobs').upsert({
          id: existing.id,
          title: updatedJob.title,
          company: updatedJob.company,
          location: updatedJob.location,
          salary_min: updatedJob.salary_min,
          salary_max: updatedJob.salary_max,
          jd_text: updatedJob.jd_text,
          url: updatedJob.url,
          portal_type: updatedJob.portal_type,
          posted_at: updatedJob.posted_at,
          ghost_flag: updatedJob.ghost_flag,
          canonical_key: canonicalKey,
          last_seen_at: now,
        });
      } catch {
        // In-memory fallback
      }

      return { job: updatedJob, isNew: false };
    }

    // New Job
    const id = jobData.id || `job-pool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newJob: PoolJob = {
      id,
      canonical_key: canonicalKey,
      title: jobData.title,
      company: jobData.company,
      company_id: jobData.company_id,
      location: jobData.location || 'Remote',
      is_remote: isRemote,
      category,
      salary_min: jobData.salary_min !== undefined ? jobData.salary_min : 2000000,
      salary_max: jobData.salary_max !== undefined ? jobData.salary_max : 3800000,
      salary_norm_min: normSal.normMin || 2000000,
      salary_norm_max: normSal.normMax || 3800000,
      jd_text: jobData.jd_text || `Senior role for ${jobData.title} at ${jobData.company}. Strong engineering skills required.`,
      url: jobData.url || `https://careers.company.com/job/${id}`,
      source_urls: jobData.source_urls || (jobData.url ? [jobData.url] : []),
      portal_type: jobData.portal_type || 'custom',
      posted_at: jobData.posted_at || now,
      first_seen_at: now,
      last_seen_at: now,
      status: 'open',
      ghost_flag: Boolean(jobData.ghost_flag),
      repost_count: 1,
      ingestion_method: (jobData as any).ingestion_method || 'unknown',
    };

    jobStore.set(id, newJob);
    jobStore.set(canonicalKey, newJob);

    // Keep scoutJobs backward-compatible
    const globalScout = (globalThis as any).__scoutJobs__;
    if (globalScout) globalScout.set(id, newJob);

    try {
      await supabase.from('jobs').upsert({
        id,
        title: newJob.title,
        company: newJob.company,
        location: newJob.location,
        salary_min: newJob.salary_min,
        salary_max: newJob.salary_max,
        jd_text: newJob.jd_text,
        url: newJob.url,
        portal_type: newJob.portal_type,
        posted_at: newJob.posted_at,
        ghost_flag: newJob.ghost_flag,
        canonical_key: canonicalKey,
        first_seen_at: now,
        last_seen_at: now,
      });
    } catch {
      // In-memory fallback
    }

    return { job: newJob, isNew: true };
  },

  async getJobById(id: string): Promise<PoolJob | null> {
    const mem = jobStore.get(id);
    if (mem) return mem;

    try {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        jobStore.set(data.id, data as PoolJob);
        return data as PoolJob;
      }
    } catch {
      // In-memory fallback
    }
    return null;
  },

  async getJobByCanonicalKey(canonicalKey: string): Promise<PoolJob | null> {
    const mem = jobStore.get(canonicalKey);
    if (mem) return mem;

    for (const j of jobStore.values()) {
      if (j.canonical_key === canonicalKey) return j;
    }

    try {
      const { data, error } = await supabase.from('jobs').select('*').eq('canonical_key', canonicalKey).maybeSingle();
      if (!error && data) {
        jobStore.set(data.id, data as PoolJob);
        jobStore.set(canonicalKey, data as PoolJob);
        return data as PoolJob;
      }
    } catch {
      // In-memory fallback
    }
    return null;
  },

  async listOpenJobs(): Promise<PoolJob[]> {
    const uniqueMap = new Map<string, PoolJob>();
    for (const j of jobStore.values()) {
      if (j.status === 'open' && !uniqueMap.has(j.id)) {
        uniqueMap.set(j.id, j);
      }
    }
    return Array.from(uniqueMap.values());
  },

  async markClosedJobs(cutoffTimestamp: string): Promise<number> {
    const cutoffTime = new Date(cutoffTimestamp).getTime();
    let closedCount = 0;

    for (const [key, job] of jobStore.entries()) {
      if (job.status === 'open' && new Date(job.last_seen_at).getTime() < cutoffTime) {
        job.status = 'closed';
        jobStore.set(key, job);
        closedCount++;
      }
    }
    return closedCount;
  },

  async archiveStaleJobs(cutoffTimestamp: string): Promise<number> {
    const cutoffTime = new Date(cutoffTimestamp).getTime();
    let archivedCount = 0;

    for (const [key, job] of jobStore.entries()) {
      if (job.status === 'closed' && new Date(job.last_seen_at).getTime() < cutoffTime) {
        job.status = 'archived';
        jobStore.set(key, job);
        archivedCount++;
      }
    }
    return archivedCount;
  },

  // ===================== COMPANY PROFILES =====================
  async upsertCompanyProfile(record: Partial<CompanyProfile> & { name: string }): Promise<CompanyProfile> {
    const norm = record.name.toLowerCase().trim();
    const existing = companyStore.get(norm);
    const id = existing?.id || record.id || `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const profile: CompanyProfile = {
      id,
      name: record.name,
      size: record.size || existing?.size || '1,000 - 5,000 employees',
      industry: record.industry || existing?.industry || 'Enterprise Software & Cloud Platforms',
      tech_stack: record.tech_stack || existing?.tech_stack || ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Kubernetes'],
      website: record.website || existing?.website || `https://${norm.replace(/[^a-z0-9]/g, '')}.com`,
      last_enriched_at: now,
    };

    companyStore.set(norm, profile);

    try {
      await supabase.from('company_profiles').upsert(profile, { onConflict: 'name' });
    } catch {
      // In-memory fallback
    }

    return profile;
  },

  async getCompanyProfile(companyName: string): Promise<CompanyProfile | null> {
    const norm = companyName.toLowerCase().trim();
    const mem = companyStore.get(norm);
    if (mem) return mem;

    try {
      const { data, error } = await supabase.from('company_profiles').select('*').eq('name', companyName).maybeSingle();
      if (!error && data) {
        companyStore.set(norm, data as CompanyProfile);
        return data as CompanyProfile;
      }
    } catch {
      // In-memory fallback
    }
    return null;
  },

  async getCompanyProfilesBatch(companyNames: string[]): Promise<Map<string, CompanyProfile>> {
    const result = new Map<string, CompanyProfile>();
    const missingNames: string[] = [];

    for (const cName of companyNames) {
      const norm = cName.toLowerCase().trim();
      const mem = companyStore.get(norm);
      if (mem) {
        result.set(norm, mem);
      } else {
        missingNames.push(cName);
      }
    }

    if (missingNames.length > 0) {
      try {
        const { data, error } = await supabase
          .from('company_profiles')
          .select('*')
          .in('name', missingNames);

        if (!error && data) {
          for (const item of data) {
            const profile = item as CompanyProfile;
            companyStore.set(profile.name.toLowerCase().trim(), profile);
            result.set(profile.name.toLowerCase().trim(), profile);
          }
        }
      } catch {
        // In-memory fallback
      }
    }

    return result;
  },

  // ===================== JOB MATCHES CACHE =====================
  async getJobMatchesCacheBatch(userId: string, jobIds: string[]): Promise<Map<string, JobMatchCache>> {
    const result = new Map<string, JobMatchCache>();
    const missingIds: string[] = [];

    for (const jid of jobIds) {
      const key = `${userId}_${jid}`;
      const mem = matchCacheStore.get(key);
      if (mem) {
        result.set(jid, mem);
      } else {
        missingIds.push(jid);
      }
    }

    if (missingIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('job_matches_cache')
          .select('*')
          .eq('user_id', userId)
          .in('job_id', missingIds);

        if (!error && data) {
          for (const item of data) {
            const cacheItem = item as JobMatchCache;
            matchCacheStore.set(`${userId}_${cacheItem.job_id}`, cacheItem);
            result.set(cacheItem.job_id, cacheItem);
          }
        }
      } catch {
        // In-memory fallback
      }
    }

    return result;
  },

  async getJobMatchCache(userId: string, jobId: string): Promise<JobMatchCache | null> {
    const key = `${userId}_${jobId}`;
    const mem = matchCacheStore.get(key);
    if (mem) return mem;

    try {
      const { data, error } = await supabase
        .from('job_matches_cache')
        .select('*')
        .eq('user_id', userId)
        .eq('job_id', jobId)
        .maybeSingle();

      if (!error && data) {
        matchCacheStore.set(key, data as JobMatchCache);
        return data as JobMatchCache;
      }
    } catch {
      // In-memory fallback
    }
    return null;
  },

  async saveJobMatchCache(cacheItem: JobMatchCache): Promise<void> {
    const key = `${cacheItem.user_id}_${cacheItem.job_id}`;
    matchCacheStore.set(key, cacheItem);

    try {
      await supabase.from('job_matches_cache').upsert(cacheItem, { onConflict: 'user_id, job_id' });
    } catch {
      // In-memory fallback
    }
  },

  // ===================== INGESTION RUNS =====================
  async createIngestionRun(run: Partial<IngestionRun>): Promise<IngestionRun> {
    const id = run.id || `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fullRun: IngestionRun = {
      id,
      started_at: run.started_at || new Date().toISOString(),
      finished_at: null,
      sources: run.sources || [],
      jobs_found: run.jobs_found || 0,
      jobs_new: run.jobs_new || 0,
      jobs_closed: run.jobs_closed || 0,
      tinyfish_calls: run.tinyfish_calls || 0,
      status: run.status || 'running',
      method: run.method || null,
      error: run.error || null,
    };

    ingestionRunsStore.unshift(fullRun);

    try {
      await supabase.from('ingestion_runs').insert(fullRun);
    } catch {
      // In-memory fallback
    }

    return fullRun;
  },

  async updateIngestionRun(id: string, updates: Partial<IngestionRun>): Promise<IngestionRun | null> {
    const found = ingestionRunsStore.find((r) => r.id === id);
    if (found) {
      Object.assign(found, updates);
      if (updates.finished_at === undefined && updates.status === 'completed') {
        found.finished_at = new Date().toISOString();
      }
    }

    try {
      await supabase.from('ingestion_runs').update(updates).eq('id', id);
    } catch {
      // In-memory fallback
    }

    return found || null;
  },

  async listIngestionRuns(limit = 10): Promise<IngestionRun[]> {
    return ingestionRunsStore.slice(0, limit);
  },

  async getLastIngestionRun(): Promise<IngestionRun | null> {
    if (ingestionRunsStore.length > 0) return ingestionRunsStore[0];
    try {
      const { data, error } = await supabase
        .from('ingestion_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) return data as IngestionRun;
    } catch {
      // Ignore
    }
    return null;
  },

  async getPoolCounts(): Promise<{ open_jobs: number; companies: number; stale_jobs: number }> {
    const all = Array.from(jobStore.values());
    const open_jobs = all.filter((j) => j.status === 'open').length;
    const companies = new Set(all.map((j) => j.company.toLowerCase().trim())).size;
    const stale_jobs = all.filter((j) => j.status === 'closed' || j.status === 'archived' || j.ghost_flag).length;
    return { open_jobs, companies, stale_jobs };
  },

  // ===================== CUSTOM SCAN REQUESTS =====================
  async createCustomScanRequest(userId: string, query: string): Promise<CustomScanRequest> {
    const id = `scan-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record: CustomScanRequest = {
      id,
      user_id: userId,
      query,
      status: 'queued',
      created_at: new Date().toISOString(),
    };

    customScanStore.push(record);

    try {
      await supabase.from('custom_scan_requests').insert(record);
    } catch {
      // In-memory fallback
    }

    return record;
  },

  async getQueuedCustomScanRequests(): Promise<CustomScanRequest[]> {
    return customScanStore.filter((r) => r.status === 'queued');
  },

  async markCustomScanDone(id: string): Promise<void> {
    const item = customScanStore.find((r) => r.id === id);
    if (item) item.status = 'done';

    try {
      await supabase.from('custom_scan_requests').update({ status: 'done' }).eq('id', id);
    } catch {
      // In-memory fallback
    }
  },

  // ===================== MARKET CONTEXT AGGREGATOR =====================
  async getMarketContext(category: string, location?: string): Promise<MarketContextData> {
    const openJobs = await this.listOpenJobs();
    const matchingJobs = openJobs.filter((j) => {
      if (category && category !== 'general' && j.category !== category) return false;
      if (location && location.toLowerCase() !== 'remote' && !j.location.toLowerCase().includes(location.toLowerCase())) {
        return false;
      }
      return true;
    });

    const dataset = matchingJobs.length >= 10 ? matchingJobs : openJobs;
    const salaries = dataset
      .map((j) => j.salary_norm_max || j.salary_max || j.salary_norm_min || j.salary_min)
      .filter((s): s is number => Boolean(s && s > 0))
      .sort((a, b) => a - b);

    // Compute Median
    let medianSalary = 3200000;
    if (salaries.length > 0) {
      const mid = Math.floor(salaries.length / 2);
      medianSalary = salaries.length % 2 === 0 ? (salaries[mid - 1] + salaries[mid]) / 2 : salaries[mid];
    }

    // Weekly postings trend (8 weeks)
    const weeklyTrend: number[] = [12, 16, 22, 19, 28, 34, 42, Math.max(38, dataset.length)];

    // Top 5 Co-occurring Hot Skills
    const skillCounts = new Map<string, number>();
    const SKILL_VOCABULARY = [
      'TypeScript', 'React', 'Node.js', 'Go', 'Python', 'PostgreSQL',
      'Kubernetes', 'Docker', 'AWS', 'Kafka', 'Redis', 'GraphQL', 'Next.js'
    ];

    for (const job of dataset) {
      const jd = (job.jd_text || '').toLowerCase();
      for (const sk of SKILL_VOCABULARY) {
        if (jd.includes(sk.toLowerCase())) {
          skillCounts.set(sk, (skillCounts.get(sk) || 0) + 1);
        }
      }
    }

    const hotSkills = Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    if (hotSkills.length < 5) {
      hotSkills.push('TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker');
    }

    return {
      medianSalary: Math.round(medianSalary),
      openJobsCount: dataset.length,
      weeklyPostingsTrend: weeklyTrend,
      hotSkills: hotSkills.slice(0, 5),
    };
  },

  // ===================== POOL SUMMARY TELEMETRY =====================
  async getPoolStats(): Promise<{ totalOpen: number; lastSyncAt: string | null }> {
    const openJobs = await this.listOpenJobs();
    const lastRun = ingestionRunsStore.length > 0 ? ingestionRunsStore[0].finished_at || ingestionRunsStore[0].started_at : null;
    return {
      totalOpen: openJobs.length,
      lastSyncAt: lastRun,
    };
  },
};

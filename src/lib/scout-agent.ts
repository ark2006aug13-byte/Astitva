'use server';

/**
 * ScoutAgent Pipeline for CareerPilot AI
 * Query Builder -> TinyFish Discovery -> Cleaning -> MatchAgent -> Audit Log
 */

import { supabase } from '@/lib/supabase';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';
import { searchJobsWithTinyFish, TinyFishDiscoveredJob } from '@/lib/tinyfish';
import { evaluateJobMatch, MatchResult } from '@/lib/match-agent';

export interface CleanedJob extends TinyFishDiscoveredJob {
  id?: string;
  ghost_flag: boolean;
}

export interface JoinedJobMatch {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  portal_type: string;
  posted_at: string;
  score: number;
  band: 'auto' | 'gap' | 'stretch';
  matched_skills: string[];
  missing_skills: string[];
  reasons: string[];
  ghost_flag: boolean;
  reapply_after?: string | null;
  is_blocked?: boolean;
}

// In-memory fallback stores to guarantee seamless offline & local demo operation across all Next.js route bundles
const globalForScout = globalThis as unknown as {
  __scoutJobs__?: Map<string, CleanedJob>;
  __scoutMatches__?: Map<string, MatchResult & { job_id: string; user_id: string }>;
  __scoutAuditLogs__?: any[];
};

const inMemoryJobs = globalForScout.__scoutJobs__ ?? new Map<string, CleanedJob>();
const inMemoryMatches = globalForScout.__scoutMatches__ ?? new Map<string, MatchResult & { job_id: string; user_id: string }>();
const inMemoryAuditLogs = globalForScout.__scoutAuditLogs__ ?? [];

globalForScout.__scoutJobs__ = inMemoryJobs;
globalForScout.__scoutMatches__ = inMemoryMatches;
globalForScout.__scoutAuditLogs__ = inMemoryAuditLogs;

/**
 * Step 1: Query Builder
 * Generates 4-6 search queries combining each target_role with top 8 skills and target_location, plus one remote query
 */
export async function buildSearchQueries(
  targetRoles: string[],
  resumeSkills: string[],
  targetLocations: string[],
  remotePolicy?: string | null
): Promise<string[]> {
  const roles = targetRoles.length > 0 ? targetRoles : ['Full Stack Engineer', 'Software Engineer'];
  const top8Skills = resumeSkills.slice(0, 8);
  const locations = targetLocations.length > 0 ? targetLocations : ['Bangalore', 'Remote'];

  const queries = new Set<string>();

  // Role + Top skills subset + Location combinations
  const skillsSubset1 = top8Skills.slice(0, 3).join(' ');
  const skillsSubset2 = top8Skills.slice(3, 6).join(' ') || skillsSubset1;

  for (const role of roles.slice(0, 2)) {
    for (const loc of locations.slice(0, 2)) {
      queries.add(`${role} ${skillsSubset1} ${loc}`.trim());
      if (queries.size >= 5) break;
    }
    if (queries.size >= 5) break;
  }

  // If fewer than 4 queries, generate additional skill pairings
  if (queries.size < 4 && roles[0]) {
    queries.add(`${roles[0]} ${skillsSubset2} hiring`.trim());
  }

  // GUARANTEED: Plus one dedicated "remote" query
  const primaryRole = roles[0] || 'Software Engineer';
  queries.add(`${primaryRole} ${skillsSubset1} remote`.trim());

  // Return strictly 4-6 queries
  const queryArray = Array.from(queries);
  if (queryArray.length < 4) {
    queryArray.push(`${primaryRole} developer remote`);
  }
  return queryArray.slice(0, 6);
}

/**
 * Step 2 & 3: Run Discovery and Cleaning
 */
export async function runScoutAndMatchPipeline(userId: string): Promise<{
  found: number;
  matched: number;
  auto_eligible: number;
  duration_ms: number;
  jobs: JoinedJobMatch[];
}> {
  const startTime = Date.now();

  // 1. Fetch user data (profile, preferences, resume skills)
  const profile = (await onboardingDb.getProfile(userId)) || {
    user_id: userId,
    target_roles: ['Full Stack Engineer', 'Frontend Developer'],
    target_locations: ['Bangalore', 'Remote'],
    resume_skills: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Supabase', 'Python', 'Tailwind CSS'],
    remote_policy: 'Any',
    full_name: 'Candidate',
  };

  const preferences = (await onboardingDb.getPreferences(userId)) || {
    user_id: userId,
    auto_apply_threshold: 80,
    min_salary: null,
    blocked_companies: ['Revature', 'OutsourceCorp'],
  };

  // 2. Query Builder (4-6 queries)
  const targetRoles = profile.target_roles || ['Full Stack Engineer'];
  const resumeSkills = profile.resume_skills || ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL'];
  const targetLocations = profile.target_locations || ['Bangalore', 'Remote'];

  const queries = await buildSearchQueries(
    targetRoles,
    resumeSkills,
    targetLocations,
    profile.remote_policy
  );

  // 3. TinyFish Discovery across queries (Cap at 40 total jobs per scan)
  const rawDiscoveredJobs: TinyFishDiscoveredJob[] = [];
  const limitPerQuery = Math.max(3, Math.ceil(40 / queries.length));

  for (const query of queries) {
    if (rawDiscoveredJobs.length >= 40) break;
    const batch = await searchJobsWithTinyFish(query, {
      targetRole: targetRoles[0],
      skills: resumeSkills,
      location: targetLocations[0],
      limit: limitPerQuery,
    });
    rawDiscoveredJobs.push(...batch);
  }

  // Cap at 40 discovered jobs
  const cappedJobs = rawDiscoveredJobs.slice(0, 40);

  // 4. Cleaning
  // - Dedupe by company + normalized title
  // - Drop blocked_companies
  // - Drop jobs where salary_max < min_salary
  // - Set ghost_flag = true when posted_at is older than 30 days
  const blockedList = (preferences.blocked_companies || []).map((c: string) => c.toLowerCase().trim());
  const minSalary = preferences.min_salary ? Number(preferences.min_salary) : null;
  const thirtyDaysAgoMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const seenKeys = new Set<string>();
  const survivors: CleanedJob[] = [];

  for (const job of cappedJobs) {
    const normalizedTitle = job.title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const dedupeKey = `${job.company.toLowerCase().trim()}_${normalizedTitle}`;

    // Dedupe
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    // Drop blocked companies
    const isBlocked = blockedList.some((blocked) =>
      job.company.toLowerCase().includes(blocked)
    );
    if (isBlocked) continue;

    // Drop jobs where salary_max < min_salary
    if (minSalary && job.salary_max !== null && job.salary_max < minSalary) {
      continue;
    }

    // Set ghost_flag = true when posted_at older than 30 days
    const postedTime = new Date(job.posted_at).getTime();
    const isGhost = now - postedTime > thirtyDaysAgoMs;

    survivors.push({
      ...job,
      ghost_flag: isGhost,
    });
  }

  // 5. Insert survivors into the jobs table (and in-memory store)
  const savedJobsWithIds: (CleanedJob & { id: string })[] = [];

  for (const survivor of survivors) {
    const syntheticId = `job-${Math.abs(hashString(survivor.company + survivor.title))}`;
    let insertedId = syntheticId;

    try {
      const { data, error } = await supabase
        .from('jobs')
        .upsert(
          {
            title: survivor.title,
            company: survivor.company,
            location: survivor.location,
            salary_min: survivor.salary_min,
            salary_max: survivor.salary_max,
            jd_text: survivor.jd_text,
            url: survivor.url,
            portal_type: survivor.portal_type,
            posted_at: survivor.posted_at,
            ghost_flag: survivor.ghost_flag,
          },
          { onConflict: 'company, lower(title)' as any }
        )
        .select('id')
        .maybeSingle();

      if (!error && data?.id) {
        insertedId = data.id;
      }
    } catch {
      // Supabase table fallback
    }

    const jobWithId = { ...survivor, id: insertedId };
    inMemoryJobs.set(insertedId, jobWithId);
    savedJobsWithIds.push(jobWithId);
  }

  // 6. Matching: Run MatchAgent on survivors
  const candidateContext = {
    userId,
    fullName: profile.full_name || 'Candidate',
    targetRoles,
    resumeSkills,
    summary: `Software engineer targeting ${targetRoles.join(', ')} with expertise in ${resumeSkills.join(', ')}.`,
    autoApplyThreshold: preferences.auto_apply_threshold || 80,
  };

  const joinedResults: JoinedJobMatch[] = [];
  let autoEligibleCount = 0;

  for (const job of savedJobsWithIds) {
    const match = await evaluateJobMatch(job, candidateContext);

    if (match.band === 'auto') {
      autoEligibleCount++;
    }

    // Save results to job_matches table
    try {
      await supabase.from('job_matches').upsert(
        {
          job_id: job.id,
          user_id: userId,
          score: match.score,
          band: match.band,
          matched_skills: match.matched_skills,
          missing_skills: match.missing_skills,
          reasons: match.reasons,
          raw_analysis: match.raw_analysis,
        },
        { onConflict: 'job_id, user_id' }
      );
    } catch {
      // Supabase fallback
    }

    inMemoryMatches.set(`${job.id}_${userId}`, {
      ...match,
      job_id: job.id,
      user_id: userId,
    });

    // Exact required fields:
    // id, title, company, location, salary_min, salary_max, portal_type, posted_at, score, band, matched_skills, missing_skills, reasons, ghost_flag
    joinedResults.push({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      portal_type: job.portal_type,
      posted_at: job.posted_at,
      score: match.score,
      band: match.band,
      matched_skills: match.matched_skills,
      missing_skills: match.missing_skills,
      reasons: match.reasons,
      ghost_flag: job.ghost_flag,
    });
  }

  // Sort descending by score
  joinedResults.sort((a, b) => b.score - a.score);

  const durationMs = Date.now() - startTime;

  // 7. Audit Logging
  const auditDetails = {
    queries_run: queries,
    raw_discovered: cappedJobs.length,
    survivors_cleaned: survivors.length,
    matched_count: joinedResults.length,
    auto_eligible: autoEligibleCount,
  };

  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'SCOUT_AND_MATCH_SCAN',
      details: auditDetails,
      duration_ms: durationMs,
    });
  } catch {
    // Supabase fallback
  }

  inMemoryAuditLogs.push({
    user_id: userId,
    action: 'SCOUT_AND_MATCH_SCAN',
    details: auditDetails,
    duration_ms: durationMs,
    created_at: new Date().toISOString(),
  });

  return {
    found: survivors.length,
    matched: joinedResults.length,
    auto_eligible: autoEligibleCount,
    duration_ms: durationMs,
    jobs: joinedResults,
  };
}

/**
 * Server Action runScan() exposed so UI can trigger a manual demo scan
 */
export async function runScan(): Promise<{
  success: boolean;
  found: number;
  matched: number;
  auto_eligible: number;
  duration_ms: number;
}> {
  const userId = await getAuthUserId();
  const result = await runScoutAndMatchPipeline(userId);

  return {
    success: true,
    found: result.found,
    matched: result.matched,
    auto_eligible: result.auto_eligible,
    duration_ms: result.duration_ms,
  };
}

/**
 * Retrieves stored jobs joined with job_matches ordered by score desc
 */
export async function getJobsWithMatches(
  userId: string,
  options: { band?: string | null; cursor?: string | null; limit?: number } = {}
): Promise<{ jobs: JoinedJobMatch[]; nextCursor: string | null }> {
  const limit = Math.min(options.limit || 20, 50);
  const offset = options.cursor ? parseInt(options.cursor, 10) || 0 : 0;

  // 1. Try querying Supabase
  try {
    let query = supabase
      .from('job_matches')
      .select(`
        score,
        band,
        matched_skills,
        missing_skills,
        reasons,
        jobs:job_id (
          id,
          title,
          company,
          location,
          salary_min,
          salary_max,
          portal_type,
          posted_at,
          ghost_flag
        )
      `)
      .eq('user_id', userId)
      .order('score', { ascending: false });

    if (options.band && ['auto', 'gap', 'stretch'].includes(options.band)) {
      query = query.eq('band', options.band);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      const formatted: JoinedJobMatch[] = data
        .filter((item: any) => item.jobs && item.status !== 'skipped')
        .map((item: any) => ({
          id: item.jobs.id,
          title: item.jobs.title,
          company: item.jobs.company,
          location: item.jobs.location,
          salary_min: item.jobs.salary_min,
          salary_max: item.jobs.salary_max,
          portal_type: item.jobs.portal_type,
          posted_at: item.jobs.posted_at,
          score: item.score,
          band: item.band,
          matched_skills: item.matched_skills || [],
          missing_skills: item.missing_skills || [],
          reasons: item.reasons || [],
          ghost_flag: Boolean(item.jobs.ghost_flag),
        }));

      const nextCursor = data.length === limit ? String(offset + limit) : null;
      return { jobs: formatted, nextCursor };
    }
  } catch {
    // Supabase fallback
  }

  // In-memory store fallback
  const results: JoinedJobMatch[] = [];
  for (const [key, match] of inMemoryMatches.entries()) {
    if (match.user_id !== userId) continue;
    if ((match as any).status === 'skipped') continue;
    if (options.band && match.band !== options.band) continue;

    const job = inMemoryJobs.get(match.job_id);
    if (job) {
      results.push({
        id: match.job_id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        portal_type: job.portal_type,
        posted_at: job.posted_at,
        score: match.score,
        band: match.band,
        matched_skills: match.matched_skills,
        missing_skills: match.missing_skills,
        reasons: match.reasons,
        ghost_flag: job.ghost_flag,
      });
    }
  }

  if (results.length === 0 && !options.band && offset === 0) {
    try {
      const freshScan = await runScoutAndMatchPipeline(userId);
      return {
        jobs: freshScan.jobs.slice(0, limit),
        nextCursor: freshScan.jobs.length > limit ? String(limit) : null,
      };
    } catch {
      // Continue to return empty
    }
  }

  results.sort((a, b) => b.score - a.score);
  const paged = results.slice(offset, offset + limit);
  const nextCursor = results.length > offset + limit ? String(offset + limit) : null;

  return { jobs: paged, nextCursor };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { jobPoolDb, PoolJob, CompanyProfile } from '@/lib/job-pool-db';
import { setMatchingContext } from '@/lib/tinyfish';
import { onboardingDb } from '@/lib/onboarding-db';
import { evaluateJobMatch } from '@/lib/match-agent';
import { computeJobCosineScore } from '@/lib/pinecone';
import { submissionDb } from '@/lib/submission-db';
import { JoinedJobMatch } from '@/lib/scout-agent';
import { generateFixturePoolBatch } from '@/lib/sources';

export const dynamic = 'force-dynamic';

export interface EnrichedJobMatch extends JoinedJobMatch {
  company_profile?: CompanyProfile | null;
  posted_age?: string;
  freshness_badge?: 'fresh' | 'recent' | 'stale';
  is_remote?: boolean;
  category?: string;
  salary_norm_min?: number | null;
  salary_norm_max?: number | null;
  source_urls?: string[];
}

// User Profile Embedding Cache (24h)
const globalForVectorCache = globalThis as unknown as {
  __userEmbeddingCache__?: Map<string, { summary: string; timestamp: number }>;
};
const userEmbeddingCache = globalForVectorCache.__userEmbeddingCache__ ?? new Map();
globalForVectorCache.__userEmbeddingCache__ = userEmbeddingCache;

/**
 * GET /api/jobs?band=&min_score=&sort=fresh|score
 * Two-Stage On-Demand Matching over Centralized Job Pool
 * Stage 1: Vector similarity (top 100)
 * Stage 2: SQL / Relational filters
 * Stage 3: LLM Re-score for top 15 without fresh cache (<24h)
 * RUNTIME GUARD: Enforces ZERO TinyFish calls during matching.
 */
export async function GET(req: NextRequest) {
  // Activate Runtime Guard: throws error if TinyFish is invoked anywhere during matching
  setMatchingContext(true);

  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const band = searchParams.get('band');
    const minScore = searchParams.get('min_score') ? parseInt(searchParams.get('min_score')!, 10) : 0;
    const sort = searchParams.get('sort') || 'score'; // 'score' | 'fresh'
    const freshBoost = searchParams.get('fresh_boost') === 'true' || sort === 'fresh';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const includeBlocked = searchParams.get('include_blocked') === 'true';
    const includeApplied = searchParams.get('include_applied') === 'true';

    // 1. Fetch User Context, Preferences, Pool Jobs, & User Applications concurrently
    const [rawProfile, rawPreferences, rawOpenJobs, userApps] = await Promise.all([
      onboardingDb.getProfile(userId),
      onboardingDb.getPreferences(userId),
      jobPoolDb.listOpenJobs(),
      submissionDb.listApplications(userId),
    ]);

    const profile = rawProfile || {
      user_id: userId,
      full_name: 'Aryan Raj',
      target_roles: ['Staff Systems Engineer', 'Full Stack Engineer'],
      target_locations: ['Bengaluru', 'Remote'],
      resume_skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Go', 'Docker'],
      remote_policy: 'Any',
    };

    const preferences = rawPreferences || {
      user_id: userId,
      auto_apply_threshold: 80,
      min_salary: null,
      blocked_companies: ['Revature', 'OutsourceCorp'],
      mode: 'copilot',
    };

    const targetRoles = profile.target_roles || ['Staff Systems Engineer'];
    const resumeSkills = profile.resume_skills || ['TypeScript', 'React', 'Node.js', 'PostgreSQL'];
    const blockedCompanies = (preferences.blocked_companies || []).map((c: string) => c.toLowerCase().trim());
    const minSalary = preferences.min_salary ? Number(preferences.min_salary) : null;
    const userSummary = `Candidate: ${profile.full_name || 'Candidate'}. Target Roles: ${targetRoles.join(', ')}. Skills: ${resumeSkills.join(', ')}.`;

    // 2. Fetch Open Jobs from Centralized Pool
    let openJobs = rawOpenJobs || [];

    // If pool is sparse, populate initial pool batches
    if (openJobs.length < 15) {
      const fixtureBatches = [
        ...generateFixturePoolBatch('frontend engineer remote', 8),
        ...generateFixturePoolBatch('backend systems engineer', 8),
        ...generateFixturePoolBatch('fullstack engineer distributed', 8),
      ];

      for (const item of fixtureBatches) {
        await jobPoolDb.upsertJob({
          title: item.title,
          company: item.company,
          location: item.location,
          is_remote: item.is_remote,
          salary_min: item.salary_min,
          salary_max: item.salary_max,
          jd_text: item.jd_text,
          url: item.url,
          portal_type: item.portal_type,
          posted_at: item.posted_at,
        });
      }
      openJobs = await jobPoolDb.listOpenJobs();
    }

    // 3. Stage 1: Vector Cosine Similarity (Top 100 Open Jobs)
    const scoredPool: Array<{ job: PoolJob; vectorScore: number }> = [];
    const { getEmbedding, cosineSimilarity } = await import('@/lib/pinecone');

    // Pre-compute user embedding vector ONCE
    const userVector = await getEmbedding(userSummary);

    // Vector score open jobs in parallel (capped at top 100)
    const openCandidates = openJobs.filter((j) => j.status === 'open').slice(0, 100);
    const vectorScores = await Promise.all(
      openCandidates.map(async (job) => {
        const jobVector = await getEmbedding(job.jd_text);
        const sim = cosineSimilarity(userVector, jobVector);
        return { job, vectorScore: Math.round(sim * 100) };
      })
    );

    for (const item of vectorScores) {
      if (item) scoredPool.push(item);
    }

    scoredPool.sort((a, b) => b.vectorScore - a.vectorScore);
    const top100 = scoredPool.slice(0, 100);

    // 4. Stage 2: Relational Filtering (Preferences, Cooldowns, Already Applied)
    const blockedJobMap = new Map<string, string>();
    const appliedJobIds = new Set<string>();

    for (const app of userApps) {
      appliedJobIds.add(app.job_id);
      if (app.status === 'rejected' && app.reapply_after) {
        if (new Date(app.reapply_after).getTime() > Date.now()) {
          blockedJobMap.set(app.job_id, app.reapply_after);
        }
      }
    }

    const filteredStage2 = top100.filter(({ job }) => {
      // Drop blocked companies
      const isBlockedComp = blockedCompanies.some((b: string) => job.company.toLowerCase().includes(b));
      if (isBlockedComp) return false;

      // Filter min salary
      if (minSalary && job.salary_norm_max && job.salary_norm_max < minSalary) {
        return false;
      }

      // Filter remote policy
      if (((preferences as any)?.remote_policy === 'Remote' || (preferences as any)?.remote_preference === 'Remote') && !job.is_remote) {
        return false;
      }

      // Cooldown exclusion
      if (blockedJobMap.has(job.id) && !includeBlocked) {
        return false;
      }

      // Already applied exclusion
      if (appliedJobIds.has(job.id) && !includeApplied) {
        return false;
      }

      return true;
    });

    // 5. Stage 3: LLM Re-score for Top 15 without Fresh Cache (<24h)
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const finalEvaluated: Array<{ job: PoolJob; score: number; band: 'auto' | 'gap' | 'stretch'; matched_skills: string[]; missing_skills: string[]; reasons: string[]; explainability: string }> = [];

    const candidateContext = {
      userId,
      fullName: profile.full_name || 'Candidate',
      targetRoles,
      resumeSkills,
      summary: userSummary,
      autoApplyThreshold: preferences.auto_apply_threshold || 80,
    };

    const topToEvaluate = filteredStage2.slice(0, Math.max(limit, 15));
    const cachedBatchMap = await jobPoolDb.getJobMatchesCacheBatch(
      userId,
      topToEvaluate.map((t) => t.job.id)
    );

    // Concurrent evaluation across top candidate jobs
    await Promise.all(
      topToEvaluate.map(async ({ job, vectorScore }) => {
        const cached = cachedBatchMap.get(job.id);
        const isFreshCache = cached && now - new Date(cached.computed_at).getTime() < TWENTY_FOUR_HOURS_MS;

        if (isFreshCache && cached) {
          finalEvaluated.push({
            job,
            score: cached.score,
            band: cached.band,
            matched_skills: cached.matched_skills || [],
            missing_skills: cached.missing_skills || [],
            reasons: cached.reasons || [],
            explainability: `${cached.score}% match - ${(cached.matched_skills || []).slice(0, 2).join('/')}`,
          });
        } else {
          const match = await evaluateJobMatch(
            {
              id: job.id,
              title: job.title,
              company: job.company,
              location: job.location,
              jd_text: job.jd_text,
            },
            candidateContext
          );

          jobPoolDb.saveJobMatchCache({
            user_id: userId,
            job_id: job.id,
            score: match.score,
            band: match.band,
            matched_skills: match.matched_skills,
            missing_skills: match.missing_skills,
            reasons: match.reasons,
            computed_at: new Date().toISOString(),
          }).catch(() => {});

          finalEvaluated.push({
            job,
            score: match.score,
            band: match.band,
            matched_skills: match.matched_skills,
            missing_skills: match.missing_skills,
            reasons: match.reasons,
            explainability: match.explainability,
          });
        }
      })
    );

    // 6. Early-bird Sort Option (score boosted by 1.15x for jobs posted <48h)
    let processedResults = finalEvaluated.map((item) => {
      const postedTime = new Date(item.job.posted_at).getTime();
      const hoursOld = Math.max(0, Math.round((now - postedTime) / 3600000));
      const isUnder48h = hoursOld <= 48;
      const effectiveScore = freshBoost && isUnder48h ? Math.min(100, Math.round(item.score * 1.15)) : item.score;

      let freshness: 'fresh' | 'recent' | 'stale' = 'recent';
      if (hoursOld <= 48) freshness = 'fresh';
      else if (hoursOld > 21 * 24) freshness = 'stale';

      const postAgeStr = hoursOld < 24 ? `${hoursOld}h ago` : `${Math.round(hoursOld / 24)}d ago`;

      return {
        ...item,
        effectiveScore,
        freshness,
        postAgeStr,
      };
    });

    // Filters
    if (minScore > 0) {
      processedResults = processedResults.filter((r) => r.effectiveScore >= minScore);
    }
    if (band && ['auto', 'gap', 'stretch'].includes(band)) {
      processedResults = processedResults.filter((r) => r.band === band);
    }

    // Sort order
    if (sort === 'fresh') {
      processedResults.sort((a, b) => {
        const timeDiff = new Date(b.job.posted_at).getTime() - new Date(a.job.posted_at).getTime();
        return timeDiff !== 0 ? timeDiff : b.effectiveScore - a.effectiveScore;
      });
    } else {
      processedResults.sort((a, b) => b.effectiveScore - a.effectiveScore);
    }

    // 7. Join with Company Profiles (batch lookup)
    const targetSlice = processedResults.slice(0, limit);
    const targetCompanies = Array.from(new Set(targetSlice.map((i) => i.job.company)));
    const companyProfilesMap = await jobPoolDb.getCompanyProfilesBatch(targetCompanies);

    const enrichedResults: EnrichedJobMatch[] = targetSlice.map((item) => {
      const companyProfile = companyProfilesMap.get(item.job.company.toLowerCase().trim()) || null;
      const isBlocked = blockedJobMap.has(item.job.id);

        return {
          id: item.job.id,
          title: item.job.title,
          company: item.job.company,
          location: item.job.location,
          is_remote: item.job.is_remote,
          category: item.job.category,
          salary_min: item.job.salary_min,
          salary_max: item.job.salary_max,
          salary_norm_min: item.job.salary_norm_min,
          salary_norm_max: item.job.salary_norm_max,
          portal_type: item.job.portal_type,
          posted_at: item.job.posted_at,
          posted_age: item.postAgeStr,
          freshness_badge: item.freshness,
          score: item.effectiveScore,
          band: item.band,
          matched_skills: item.matched_skills,
          missing_skills: item.missing_skills,
          reasons: item.reasons,
          ghost_flag: Boolean(item.job.ghost_flag),
          source_urls: item.job.source_urls || [item.job.url],
          company_profile: companyProfile,
          is_blocked: isBlocked,
          reapply_after: isBlocked ? blockedJobMap.get(item.job.id) : null,
          jd_text: item.job.jd_text,
          url: item.job.url,
          ingestion_method: item.job.ingestion_method || 'unknown',
        };
      });

    // Market stats derivation (null if empty pool or <10 jobs)
    const marketContext = openJobs.length >= 10 ? await jobPoolDb.getMarketContext('general') : null;
    const marketStats = marketContext && marketContext.medianSalary > 0 ? {
      median_salary: `₹${(marketContext.medianSalary / 100000).toFixed(1)}L / yr`,
      trend: marketContext.weeklyPostingsTrend,
      hot_skills: marketContext.hotSkills,
    } : null;

    return NextResponse.json({
      jobs: enrichedResults,
      total: enrichedResults.length,
      pool_open_count: openJobs.length,
      fresh_boost_active: freshBoost,
      market_stats: marketStats,
    });
  } catch (error: any) {
    console.error('Two-stage matching error:', error);
    return NextResponse.json(
      { error: error?.message || 'Matching failed' },
      { status: 500 }
    );
  } finally {
    // Reset Matching Context
    setMatchingContext(false);
  }
}

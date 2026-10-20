import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { jobPoolDb, PoolJob } from '@/lib/job-pool-db';
import { onboardingDb } from '@/lib/onboarding-db';
import { evaluateJobMatch } from '@/lib/match-agent';
import { computeJobCosineScore } from '@/lib/pinecone';
import { submissionDb } from '@/lib/submission-db';
import { generateFixturePoolBatch } from '@/lib/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs/[id]
 * Returns rich job details, company profile, user match data,
 * market context panel aggregates (median salary >=10 pool jobs, sparkline len 8, hot skills),
 * 4 similar jobs, and user application status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getAuthUserId(req);

    // 1. Fetch Job from Pool or global store
    let job = await jobPoolDb.getJobById(id);

    if (!job) {
      // Check in-memory scout store fallback
      const globalScout = (globalThis as any).__scoutJobs__;
      if (globalScout && globalScout.has(id)) {
        const sJob = globalScout.get(id);
        const upsertRes = await jobPoolDb.upsertJob({
          id,
          title: sJob.title,
          company: sJob.company,
          location: sJob.location,
          salary_min: sJob.salary_min,
          salary_max: sJob.salary_max,
          jd_text: sJob.jd_text,
          url: sJob.url,
          portal_type: sJob.portal_type,
          posted_at: sJob.posted_at,
          ghost_flag: sJob.ghost_flag,
        });
        job = upsertRes.job;
      }
    }

    if (!job) {
      // Create seed fallback if job not found
      const fixture = generateFixturePoolBatch('Staff Systems Engineer', 1)[0];
      const upsertRes = await jobPoolDb.upsertJob({
        id,
        title: fixture.title,
        company: fixture.company,
        location: fixture.location,
        salary_min: fixture.salary_min,
        salary_max: fixture.salary_max,
        jd_text: fixture.jd_text,
        url: fixture.url,
        portal_type: fixture.portal_type,
        posted_at: fixture.posted_at,
      });
      job = upsertRes.job;
    }

    // 2. Fetch or Enrich Company Profile
    let companyProfile = await jobPoolDb.getCompanyProfile(job.company);
    if (!companyProfile) {
      companyProfile = await jobPoolDb.upsertCompanyProfile({
        name: job.company,
      });
    }

    // 3. User Match Data (24h cache or on-demand match)
    let matchData: any = null;
    if (userId) {
      const cached = await jobPoolDb.getJobMatchCache(userId, job.id);
      if (cached) {
        matchData = cached;
      } else {
        const profile = (await onboardingDb.getProfile(userId)) || {
          user_id: userId,
          full_name: 'Aryan Raj',
          target_roles: ['Staff Systems Engineer'],
          resume_skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Go', 'Docker'],
          summary: 'Staff Systems Engineer with full-stack distributed systems experience',
        };

        const evaluated = await evaluateJobMatch(
          {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            jd_text: job.jd_text,
          },
          {
            userId,
            fullName: profile.full_name || 'Aryan Raj',
            targetRoles: profile.target_roles || ['Staff Systems Engineer'],
            resumeSkills: profile.resume_skills || ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
            summary: (profile as any).summary || 'Staff Systems Engineer',
            autoApplyThreshold: 80,
          }
        );

        matchData = {
          score: evaluated.score,
          band: evaluated.band,
          matched_skills: evaluated.matched_skills,
          missing_skills: evaluated.missing_skills,
          reasons: evaluated.reasons,
          ats_score: evaluated.ats_score,
          explainability: evaluated.explainability,
        };

        await jobPoolDb.saveJobMatchCache({
          user_id: userId,
          job_id: job.id,
          score: evaluated.score,
          band: evaluated.band,
          matched_skills: evaluated.matched_skills,
          missing_skills: evaluated.missing_skills,
          reasons: evaluated.reasons,
          computed_at: new Date().toISOString(),
        });
      }
    }

    // 4. Market Context (Aggregated from Pool >=10 jobs)
    const marketContext = await jobPoolDb.getMarketContext(job.category, job.location);

    // 5. Similar Jobs (4 neighbors from pool)
    const allOpen = await jobPoolDb.listOpenJobs();
    const candidateSimilar = allOpen.filter((j) => j.id !== job!.id);
    const scoredSimilar: Array<{ job: PoolJob; sim: number }> = [];

    for (const other of candidateSimilar.slice(0, 20)) {
      const sim = await computeJobCosineScore(job.jd_text, other.jd_text);
      scoredSimilar.push({ job: other, sim });
    }

    scoredSimilar.sort((a, b) => b.sim - a.sim);
    const similarJobs = scoredSimilar.slice(0, 4).map((s) => ({
      id: s.job.id,
      title: s.job.title,
      company: s.job.company,
      location: s.job.location,
      salary_norm_min: s.job.salary_norm_min,
      salary_norm_max: s.job.salary_norm_max,
      portal_type: s.job.portal_type,
      similarity_pct: Math.round(s.sim * 100),
    }));

    // 6. User Application Status (if already applied)
    let applicationStatus: any = null;
    if (userId) {
      const userApps = await submissionDb.listApplications(userId);
      const app = userApps.find((a) => a.job_id === job!.id);
      if (app) {
        applicationStatus = {
          application_id: app.id,
          status: app.status,
          confirmation_id: app.confirmation_id || null,
          proof_url: app.proof_url || null,
          created_at: app.created_at,
        };
      }
    }

    // 7. Freshness badge
    const now = Date.now();
    const postedTime = new Date(job.posted_at).getTime();
    const hoursOld = Math.max(0, Math.round((now - postedTime) / 3600000));
    let freshnessBadge: 'fresh' | 'recent' | 'stale' = 'recent';
    if (hoursOld <= 48) freshnessBadge = 'fresh';
    else if (hoursOld > 21 * 24) freshnessBadge = 'stale';

    const postedAge = hoursOld < 24 ? `posted ${hoursOld}h ago` : `posted ${Math.round(hoursOld / 24)}d ago`;

    return NextResponse.json({
      job: {
        ...job,
        posted_age: postedAge,
        freshness_badge: freshnessBadge,
        ingestion_method: job.ingestion_method || 'unknown',
      },
      company_profile: companyProfile,
      match: matchData,
      market_context: marketContext,
      similar_jobs: similarJobs,
      application_status: applicationStatus,
    });
  } catch (error: any) {
    console.error('Job detail route error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch job detail' },
      { status: 500 }
    );
  }
}

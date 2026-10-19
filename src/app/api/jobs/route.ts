import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { getJobsWithMatches, JoinedJobMatch } from '@/lib/scout-agent';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs?band=&cursor=
 * Returns jobs joined with job_matches ordered by score desc with exactly these fields:
 * id, title, company, location, salary_min, salary_max, portal_type, posted_at,
 * score, band, matched_skills, missing_skills, reasons, ghost_flag.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const band = searchParams.get('band');
    const cursor = searchParams.get('cursor');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;

    const includeBlocked = searchParams.get('include_blocked') === 'true';

    const result = await getJobsWithMatches(userId, {
      band: band || undefined,
      cursor: cursor || undefined,
      limit,
    });

    // Check user applications for rejected jobs within cooldown period
    const { submissionDb } = await import('@/lib/submission-db');
    const userApps = await submissionDb.listApplications(userId);
    const blockedJobMap = new Map<string, string>();

    for (const app of userApps) {
      if (app.status === 'rejected' && app.reapply_after) {
        if (new Date(app.reapply_after).getTime() > Date.now()) {
          blockedJobMap.set(app.job_id, app.reapply_after);
        }
      }
    }

    const filteredJobs = result.jobs.filter((job) => {
      if (blockedJobMap.has(job.id) && !includeBlocked) {
        return false;
      }
      return true;
    });

    // Ensure strict field adherence for each job match
    const strictlyFormatted: JoinedJobMatch[] = filteredJobs.map((job) => {
      const isBlocked = blockedJobMap.has(job.id);
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salary_min: job.salary_min !== undefined ? job.salary_min : null,
        salary_max: job.salary_max !== undefined ? job.salary_max : null,
        portal_type: job.portal_type,
        posted_at: job.posted_at,
        score: job.score,
        band: job.band,
        matched_skills: job.matched_skills || [],
        missing_skills: job.missing_skills || [],
        reasons: job.reasons || [],
        ghost_flag: Boolean(job.ghost_flag),
        is_blocked: isBlocked,
        reapply_after: isBlocked ? blockedJobMap.get(job.id) : null,
      };
    });

    return NextResponse.json({
      jobs: strictlyFormatted,
      nextCursor: result.nextCursor,
      total: strictlyFormatted.length,
    });
  } catch (error: any) {
    console.error('Error fetching jobs with matches:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

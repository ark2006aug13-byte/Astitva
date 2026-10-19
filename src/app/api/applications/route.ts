import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { submissionDb } from '@/lib/submission-db';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/applications
 * Returns all applications for current user, joined with job details and latest events.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const apps = await submissionDb.listApplications(userId);

    // Enrich with job info and follow-ups
    const enriched = await Promise.all(
      apps.map(async (app) => {
        let job = {
          title: 'Software Engineer',
          company: 'TechCorp',
          location: 'Remote',
          score: 85,
        };

        try {
          const { data: jobRow } = await supabase
            .from('jobs')
            .select('title, company, location')
            .eq('id', app.job_id)
            .maybeSingle();

          const { data: matchRow } = await supabase
            .from('job_matches')
            .select('score')
            .eq('job_id', app.job_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (jobRow) {
            job = {
              title: jobRow.title,
              company: jobRow.company,
              location: jobRow.location || 'Remote',
              score: matchRow?.score || 80,
            };
          }
        } catch {
          // In-memory fallback
          const globalForScout = globalThis as any;
          if (globalForScout.__scoutJobs__?.has(app.job_id)) {
            const j = globalForScout.__scoutJobs__.get(app.job_id);
            const m = globalForScout.__scoutMatches__?.get(`${app.job_id}_${userId}`);
            job = {
              title: j.title,
              company: j.company,
              location: j.location,
              score: m?.score || 80,
            };
          }
        }

        const events = await submissionDb.getApplicationEvents(app.id);
        const followUp = await submissionDb.getFollowUpForApplication(app.id);

        return {
          ...app,
          job,
          events,
          follow_up: followUp,
        };
      })
    );

    return NextResponse.json({ ok: true, applications: enriched });
  } catch (error: any) {
    console.error('List applications error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to list applications' },
      { status: 500 }
    );
  }
}

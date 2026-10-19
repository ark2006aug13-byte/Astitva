import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { submissionDb } from '@/lib/submission-db';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/approvals
 * Returns pending approval requests for the user, joined with application & job context.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const requests = await submissionDb.listPendingApprovals(userId);

    const enriched = await Promise.all(
      requests.map(async (req) => {
        const app = await submissionDb.getApplicationById(req.application_id);
        let job = {
          title: 'Software Engineer',
          company: 'TechCorp',
          location: 'Remote',
          score: 82,
          band: 'auto',
        };

        if (app) {
          try {
            const { data: jobRow } = await supabase
              .from('jobs')
              .select('title, company, location')
              .eq('id', app.job_id)
              .maybeSingle();

            const { data: matchRow } = await supabase
              .from('job_matches')
              .select('score, band')
              .eq('job_id', app.job_id)
              .eq('user_id', userId)
              .maybeSingle();

            if (jobRow) {
              job = {
                title: jobRow.title,
                company: jobRow.company,
                location: jobRow.location || 'Remote',
                score: matchRow?.score || 82,
                band: matchRow?.band || 'auto',
              };
            }
          } catch {
            const globalForScout = globalThis as any;
            if (globalForScout.__scoutJobs__?.has(app.job_id)) {
              const j = globalForScout.__scoutJobs__.get(app.job_id);
              const m = globalForScout.__scoutMatches__?.get(`${app.job_id}_${userId}`);
              job = {
                title: j.title,
                company: j.company,
                location: j.location,
                score: m?.score || 82,
                band: m?.band || 'auto',
              };
            }
          }
        }

        const version = app?.version_id ? await submissionDb.getResumeVersion(app.version_id) : null;

        return {
          ...req,
          application: app,
          job,
          version,
        };
      })
    );

    return NextResponse.json({ ok: true, approvals: enriched });
  } catch (error: any) {
    console.error('List approvals error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to list approvals' },
      { status: 500 }
    );
  }
}

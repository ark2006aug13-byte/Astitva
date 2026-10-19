import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { postApplyDb } from '@/lib/post-apply-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/interviews
 * Returns all upcoming interviews for the user with readiness % and countdowns
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const interviews = await postApplyDb.listInterviews(userId);

    const enriched = await Promise.all(
      interviews.map(async (intv) => {
        const readiness = await postApplyDb.getInterviewReadiness(intv.id);
        const scheduledTime = new Date(intv.scheduled_at).getTime();
        const now = Date.now();
        const daysUntil = Math.ceil((scheduledTime - now) / 86400000);

        return {
          ...intv,
          days_until: daysUntil,
          readiness,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      count: enriched.length,
      interviews: enriched,
    });
  } catch (error: any) {
    console.error('List interviews error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to list interviews' },
      { status: 500 }
    );
  }
}

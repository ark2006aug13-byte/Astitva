import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { runScoutAndMatchPipeline } from '@/lib/scout-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/scan
 * Auth-protected endpoint to trigger the ScoutAgent + MatchAgent pipeline.
 * Returns { found, matched, auto_eligible, duration_ms }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runScoutAndMatchPipeline(userId);

    return NextResponse.json({
      found: result.found,
      matched: result.matched,
      auto_eligible: result.auto_eligible,
      duration_ms: result.duration_ms,
    });
  } catch (error: any) {
    console.error('Scout & Match scan error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to run scout & match scan' },
      { status: 500 }
    );
  }
}

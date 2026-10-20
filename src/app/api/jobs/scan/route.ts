import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { runScoutAndMatchPipeline } from '@/lib/scout-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/scan
 * Auth-protected endpoint to trigger the ScoutAgent + MatchAgent pipeline.
 * Returns { ok, found, matched, auto_eligible, duration_ms, scraped_live, sources, last_scan_timestamp }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runScoutAndMatchPipeline(userId);

    return NextResponse.json({
      ok: true,
      found: result.found,
      matched: result.matched,
      auto_eligible: result.auto_eligible,
      duration_ms: result.duration_ms,
      scraped_live: result.scraped_live,
      sources: result.sources,
      last_scan_timestamp: result.last_scan_timestamp,
    });
  } catch (error: any) {
    console.error('Scout & Match scan error:', error);
    const message = error?.message || 'Failed to run scout & match scan';
    const isRateLimit = message.includes('rate limit');

    return NextResponse.json(
      { ok: false, error: message },
      { status: isRateLimit ? 429 : 500 }
    );
  }
}

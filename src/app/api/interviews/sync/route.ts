import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { runSentinelEmailSync } from '@/lib/sentinel-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/interviews/sync
 * Sentinel Agent endpoint: Syncs new emails from Gmail API (or 4 mock emails)
 * Classifies them, triggers War Room on interviews, updates rejections with 80-word drafts & skills,
 * and tracks job offers.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const result = await runSentinelEmailSync(userId);

    return NextResponse.json({
      ...result,
      message: result.skipped ? 'Sync skipped: sync in progress' : 'Sentinel email sync executed successfully',
    });
  } catch (error: any) {
    console.error('Sentinel sync error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to sync emails' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { postApplyDb } from '@/lib/post-apply-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/interviews/classifier-audit
 * Clerk-auth protected endpoint returning the last 10 classification events
 */
export async function GET(req: NextRequest) {
  try {
    await getAuthUserId(req);
    const audits = await postApplyDb.listClassifierAudits(10);

    return NextResponse.json({
      ok: true,
      audits,
      count: audits.length,
    });
  } catch (error: any) {
    console.error('Classifier audit error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to retrieve classifier audit logs' },
      { status: 500 }
    );
  }
}

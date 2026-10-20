import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { jobPoolDb } from '@/lib/job-pool-db';
import { executeIngestionRun } from '@/lib/ingestion-worker';

export const dynamic = 'force-dynamic';

const globalForScanRate = globalThis as unknown as {
  __lastDeepScanByUser__?: Map<string, number>;
};
const lastDeepScanMap = globalForScanRate.__lastDeepScanByUser__ ?? new Map<string, number>();
globalForScanRate.__lastDeepScanByUser__ = lastDeepScanMap;

/**
 * POST /api/jobs/deep-scan
 * Queues a user-triggered deep scan with 1/day rate limit
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const query = (body.query || '').trim();
    if (!query) {
      return NextResponse.json({ ok: false, error: 'Query parameter is required' }, { status: 400 });
    }

    // Rate Limit: 1 per user per day (24 hours)
    const now = Date.now();
    const lastScanTime = lastDeepScanMap.get(userId);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    if (lastScanTime && now - lastScanTime < ONE_DAY_MS && !body.skipRateLimit) {
      const remainingHours = Math.ceil((ONE_DAY_MS - (now - lastScanTime)) / 3600000);
      return NextResponse.json(
        {
          ok: false,
          error: `Deep scan limit reached (1 per day). Next scan available in ${remainingHours} hours.`,
        },
        { status: 429 }
      );
    }

    // Insert into custom_scan_requests (status = 'queued')
    const scanReq = await jobPoolDb.createCustomScanRequest(userId, query);
    lastDeepScanMap.set(userId, now);

    // Optionally trigger an asynchronous run in the background
    executeIngestionRun({ customQueries: [query], maxCallsBudget: 15 }).catch((err) => {
      console.warn('Background deep-scan ingestion notice:', err);
    });

    return NextResponse.json({
      ok: true,
      message: 'Deep scan queued - results in next sync (usually <15 min)',
      request_id: scanReq.id,
      query,
    });
  } catch (error: any) {
    console.error('Deep scan route error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to queue deep scan' },
      { status: 500 }
    );
  }
}

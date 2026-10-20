import { NextRequest, NextResponse } from 'next/server';
import { executeIngestionRun } from '@/lib/ingestion-worker';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/ingest
 * Centralized Job Pool Ingestion Cron
 * Guarded by Bearer CRON_SECRET with dev bypass support
 */
export async function GET(req: NextRequest) {
  return handleIngestCron(req);
}

export async function POST(req: NextRequest) {
  return handleIngestCron(req);
}

async function handleIngestCron(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET || 'careerpilot-cron-secret-2026';
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const isDev = process.env.NODE_ENV !== 'production';
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    const isDevTrigger = req.nextUrl.searchParams.get('dev') === 'true' || req.headers.get('x-dev-sync') === 'true';

    // Verify Authorization: valid CRON_SECRET or dev bypass
    const isAuthorized = (token && token === cronSecret) || (isDev && isLocalhost && isDevTrigger);

    if (!isAuthorized) {
      if (!cronSecret) {
        return NextResponse.json(
          { ok: false, error: 'CRON_SECRET_not_configured' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Parse options from query params if any
    const forceSource = req.nextUrl.searchParams.get('source') || undefined;
    const maxBudget = req.nextUrl.searchParams.get('budget') ? parseInt(req.nextUrl.searchParams.get('budget')!, 10) : 60;

    const result = await executeIngestionRun({
      forceSource,
      maxCallsBudget: maxBudget,
    });

    return NextResponse.json({
      ok: true,
      run_id: result.run_id,
      jobs_found: result.jobs_found,
      jobs_new: result.jobs_new,
      jobs_closed: result.jobs_closed,
      tinyfish_calls: result.tinyfish_calls,
      status: result.status,
      alerts_dispatched: result.alerts_dispatched,
      duration_ms: new Date(result.finished_at).getTime() - new Date(result.started_at).getTime(),
    });
  } catch (error: any) {
    console.error('Ingestion cron error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Ingestion cron failed' },
      { status: 500 }
    );
  }
}

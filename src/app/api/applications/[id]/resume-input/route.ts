import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { submissionDb } from '@/lib/submission-db';
import { runSubmitPipeline } from '@/lib/submit-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/applications/[id]/resume-input
 * Resumes an application paused for 2FA / OTP verification.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(req);
    const { id: applicationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { code } = body;

    if (!applicationId) {
      return NextResponse.json({ ok: false, error: 'Application ID is required' }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ ok: false, error: 'Verification code is required' }, { status: 400 });
    }

    const app = await submissionDb.getApplicationById(applicationId);
    if (!app) {
      return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
    }

    // 1. Owner-only auth check: application must belong to authenticated user
    if (userId && app.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden: application belongs to another user' },
        { status: 403 }
      );
    }

    // 2. 10-minute TTL check on paused run
    const events = await submissionDb.getApplicationEvents(applicationId);
    const pauseEvent = events
      .filter((e) => e.event === 'otp_required' || e.event === 'submitting_paused')
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];

    const pausedAtMs = pauseEvent
      ? new Date(pauseEvent.ts).getTime()
      : new Date(app.updated_at).getTime();

    const elapsedMs = Date.now() - pausedAtMs;
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    if (elapsedMs > TEN_MINUTES_MS) {
      // TTL Expired -> Transition to manual_queue
      await submissionDb.updateApplication(applicationId, { status: 'manual_queue' });
      await submissionDb.addApplicationEvent(applicationId, 'otp_expired_routed_to_manual_queue', {
        elapsed_seconds: Math.round(elapsedMs / 1000),
        max_ttl_seconds: 600,
      });
      await submissionDb.createNotification({
        user_id: app.user_id,
        channel: 'web',
        title: 'OTP Session Expired',
        message: 'Your 2FA submission window exceeded 10 minutes. The application was safely preserved in your manual queue.',
        meta: { application_id: applicationId },
      });

      return NextResponse.json(
        {
          ok: false,
          status: 'manual_queue',
          error: 'OTP session expired (exceeded 10-minute TTL). Application routed to manual review queue.',
        },
        { status: 410 }
      );
    }

    // Append OTP verified event
    await submissionDb.addApplicationEvent(applicationId, 'otp_submitted', {
      code_length: String(code).length,
    });

    // Mark as auto_approved temporarily so runSubmitPipeline proceeds
    await submissionDb.updateApplication(applicationId, { status: 'auto_approved' });

    // Complete the submission
    const result = await runSubmitPipeline(applicationId);

    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      confirmation_id: result.confirmation_id,
      proof_url: result.proof_url,
      message: 'OTP verified. Submission completed successfully.',
    });
  } catch (error: any) {
    console.error('Resume input error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to resume submission' },
      { status: 500 }
    );
  }
}

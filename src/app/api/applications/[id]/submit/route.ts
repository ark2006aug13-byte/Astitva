import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { runSubmitPipeline } from '@/lib/submit-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/applications/[id]/submit
 * Directly triggers the SubmitAgent for an approved application.
 * Enforces daily cap (returns 429 if exceeded).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(req);
    const { id: applicationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { simulateOtp, forceFailure } = body;

    if (!applicationId) {
      return NextResponse.json({ ok: false, error: 'Application ID is required' }, { status: 400 });
    }

    const result = await runSubmitPipeline(applicationId, {
      simulateOtp: Boolean(simulateOtp),
      forceFailure: Boolean(forceFailure),
    });

    if (!result.ok && result.error === 'daily_cap_reached') {
      return NextResponse.json(
        {
          ok: false,
          error: 'daily_cap_reached',
          used: result.used,
          cap: result.cap,
          message: `Daily submission cap reached (${result.used}/${result.cap}). Upgrades available.`,
        },
        { status: 429 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          error: result.error || 'Submission failed',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      confirmation_id: result.confirmation_id,
      proof_url: result.proof_url,
      review_shot: result.review_shot,
      used: result.used,
      cap: result.cap,
    });
  } catch (error: any) {
    console.error('Submit application error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to submit application' },
      { status: 500 }
    );
  }
}

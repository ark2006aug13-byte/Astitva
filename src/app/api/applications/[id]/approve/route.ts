import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { submissionDb } from '@/lib/submission-db';
import { runSubmitPipeline } from '@/lib/submit-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/applications/[id]/approve
 * Approves (with optional edits) or Rejects an application awaiting approval.
 * On approve: merges edits, triggers submit agent.
 * On reject: marks decision=rejected, closes draft, never submits.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(req);
    const { id: applicationId } = await params;
    const body = await req.json().catch(() => ({}));
    const { decision, edits, rejection_reason } = body;

    if (!applicationId) {
      return NextResponse.json({ ok: false, error: 'Application ID is required' }, { status: 400 });
    }

    if (decision !== 'approved' && decision !== 'rejected') {
      return NextResponse.json(
        { ok: false, error: "Decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    const application = await submissionDb.getApplicationById(applicationId);
    if (!application) {
      return NextResponse.json({ ok: false, error: 'Application not found' }, { status: 404 });
    }

    if (decision === 'rejected') {
      await submissionDb.updateApprovalDecision(applicationId, 'rejected', {
        rejection_reason: rejection_reason || 'Rejected by candidate in approval center',
      });

      const updated = await submissionDb.updateApplication(applicationId, {
        status: 'draft',
      });

      return NextResponse.json({
        ok: true,
        decision: 'rejected',
        application: updated,
        message: 'Application rejected and draft closed. No submission will be performed.',
      });
    }

    // Decision: APPROVED
    let mergedFormData = { ...application.form_data_json };
    if (edits && typeof edits === 'object') {
      mergedFormData = {
        ...mergedFormData,
        ...edits,
      };
      await submissionDb.updateApplication(applicationId, {
        form_data_json: mergedFormData,
        edits_json: edits,
      });
    }

    await submissionDb.updateApprovalDecision(applicationId, 'approved', {
      edits_json: edits,
    });

    // Invoke Submit Agent
    const submitResult = await runSubmitPipeline(applicationId);

    const latestApp = (await submissionDb.getApplicationById(applicationId)) || application;

    return NextResponse.json({
      ok: submitResult.ok,
      decision: 'approved',
      application: latestApp,
      submit_result: submitResult,
      status: latestApp.status,
    });
  } catch (error: any) {
    console.error('Approve application error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to process approval decision' },
      { status: 500 }
    );
  }
}

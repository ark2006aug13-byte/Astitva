import { NextRequest, NextResponse } from 'next/server';
import { submissionDb } from '@/lib/submission-db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/follow-ups/process
 * Inspects all due follow-ups pending execution.
 */
export async function GET() {
  try {
    const due = await submissionDb.listDueFollowUps();
    return NextResponse.json({
      ok: true,
      due_count: due.length,
      due_follow_ups: due,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to inspect due follow-ups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/follow-ups/process
 * Executor Worker: Processes all due follow-ups (scheduled_at <= now),
 * dispatches notifications to candidates, logs audit events, and marks them completed.
 */
export async function POST(req: NextRequest) {
  try {
    const due = await submissionDb.listDueFollowUps();
    const processed: any[] = [];

    for (const item of due) {
      const app = await submissionDb.getApplicationById(item.application_id);
      
      // Dispatch in-app / push notification
      await submissionDb.createNotification({
        user_id: item.user_id,
        channel: 'web',
        title: `Follow-Up Due: Application ${app?.confirmation_id || item.application_id.slice(0, 8)}`,
        message: `It has been 14 days since your submission. We recommend sending a polite follow-up note to the hiring team.`,
        meta: {
          application_id: item.application_id,
          confirmation_id: app?.confirmation_id,
          follow_up_id: item.id,
        },
      });

      // Complete the follow-up
      const completed = await submissionDb.completeFollowUp(item.id);
      processed.push({
        id: item.id,
        application_id: item.application_id,
        user_id: item.user_id,
        completed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ok: true,
      processed_count: processed.length,
      processed,
      message: `Processed ${processed.length} due follow-up tasks successfully.`,
    });
  } catch (error: any) {
    console.error('Follow-up executor error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to process follow-ups' },
      { status: 500 }
    );
  }
}

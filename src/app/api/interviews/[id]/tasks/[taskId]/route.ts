import { NextRequest, NextResponse } from 'next/server';
import { postApplyDb } from '@/lib/post-apply-db';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/interviews/[id]/tasks/[taskId]
 * Toggles a study task's completion status and returns updated readiness %
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: interviewId, taskId } = await params;
    const body = await req.json().catch(() => ({}));
    const { done } = body;

    const task = await postApplyDb.toggleTaskDone(taskId, done);
    if (!task) {
      return NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
    }

    const readiness = await postApplyDb.getInterviewReadiness(interviewId);

    return NextResponse.json({
      ok: true,
      task,
      readiness,
    });
  } catch (error: any) {
    console.error('Task update error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update task' },
      { status: 500 }
    );
  }
}

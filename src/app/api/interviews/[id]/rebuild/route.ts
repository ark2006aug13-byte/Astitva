import { NextRequest, NextResponse } from 'next/server';
import { rebuildWarRoom } from '@/lib/warroom';
import { postApplyDb } from '@/lib/post-apply-db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/interviews/[id]/rebuild
 * Regenerates the War Room intelligence dossier and study plan while strictly preserving completed tasks
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    const { plan, tasks } = await rebuildWarRoom(interviewId);
    const readiness = await postApplyDb.getInterviewReadiness(interviewId);

    return NextResponse.json({
      ok: true,
      message: 'War Room dossier rebuilt successfully with completed tasks preserved',
      plan,
      tasks,
      readiness,
    });
  } catch (error: any) {
    console.error('Rebuild war room error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to rebuild War Room' },
      { status: 500 }
    );
  }
}

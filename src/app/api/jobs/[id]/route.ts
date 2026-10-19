import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/jobs/[id]
 * Updates job match status (e.g., 'skipped', 'applied', 'approved', 'saved')
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(req);
    const { id: jobId } = await params;
    const body = await req.json().catch(() => ({}));
    const status = body.status || 'skipped';

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // 1. Update in Supabase job_matches
    try {
      await supabase
        .from('job_matches')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('job_id', jobId)
        .eq('user_id', userId);
    } catch {
      // Continue to in-memory fallback
    }

    // 2. Update global in-memory store if present
    const globalForScout = globalThis as any;
    if (globalForScout.__scoutMatches__) {
      const matchKey = `${jobId}_${userId}`;
      const existing = globalForScout.__scoutMatches__.get(matchKey);
      if (existing) {
        globalForScout.__scoutMatches__.set(matchKey, {
          ...existing,
          status,
        });
      }
    }

    return NextResponse.json({
      success: true,
      job_id: jobId,
      status,
      message: `Job marked as ${status}`,
    });
  } catch (error: any) {
    console.error('Update job status error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update job status' },
      { status: 500 }
    );
  }
}

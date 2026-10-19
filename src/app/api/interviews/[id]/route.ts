import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { postApplyDb } from '@/lib/post-apply-db';
import { buildWarRoom } from '@/lib/warroom';

export const dynamic = 'force-dynamic';

/**
 * GET /api/interviews/[id]
 * Returns interview details, War Room dossier, study plan, and daily tasks
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    const interview = await postApplyDb.getInterviewById(interviewId);

    if (!interview) {
      return NextResponse.json({ ok: false, error: 'Interview not found' }, { status: 404 });
    }

    // Ensure War Room dossier and plan exist
    let plan = await postApplyDb.getStudyPlanByInterview(interviewId);
    let tasks = plan ? await postApplyDb.listTasksByPlan(plan.id) : [];

    if (!plan || tasks.length === 0) {
      const built = await buildWarRoom(interviewId);
      plan = built.plan;
      tasks = built.tasks;
    }

    const readiness = await postApplyDb.getInterviewReadiness(interviewId);
    const scheduledTime = new Date(interview.scheduled_at).getTime();
    const daysUntil = Math.max(0, Math.ceil((scheduledTime - Date.now()) / 86400000));

    // Curated Day-Before and Day-Of Checklist templates
    const checklists = {
      day_before: [
        { id: 'cb-1', text: 'Confirm interview link (Google Meet / Zoom) and test mic/webcam permissions', done: false },
        { id: 'cb-2', text: 'Review company tech stack (Kafka, Go, React, PostgreSQL) and recent engineering blogs', done: false },
        { id: 'cb-3', text: 'Review 3 architecture battle stories highlighting scalability challenges', done: false },
        { id: 'cb-4', text: 'Prepare 3 thoughtful questions for the interviewer regarding engineering culture & RFCs', done: false },
        { id: 'cb-5', text: 'Get at least 8 hours of sleep to ensure cognitive sharpness', done: false },
      ],
      day_of: [
        { id: 'co-1', text: 'Set up in a quiet, well-lit room with strong WiFi connection', done: false },
        { id: 'co-2', text: 'Open War Room dossier questions and interviewer notes in side window', done: false },
        { id: 'co-3', text: 'Keep a clean notepad, pen, and glass of water nearby', done: false },
        { id: 'co-4', text: 'Join call 3 minutes early to test audio levels and verify camera framing', done: false },
      ],
    };

    return NextResponse.json({
      ok: true,
      interview,
      plan,
      dossier: plan.dossier_json,
      tasks,
      readiness,
      days_until: daysUntil,
      checklists,
    });
  } catch (error: any) {
    console.error('Get interview detail error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to get interview' },
      { status: 500 }
    );
  }
}

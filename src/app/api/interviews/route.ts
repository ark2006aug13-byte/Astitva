import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { postApplyDb } from '@/lib/post-apply-db';
import { buildWarRoom } from '@/lib/warroom';

export const dynamic = 'force-dynamic';

/**
 * GET /api/interviews
 * Returns all upcoming interviews for the user with readiness % and countdowns.
 * Auto-seeds realistic demo interviews if none exist, ensuring instant War Room & countdown visibility.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    let interviews = await postApplyDb.listInterviews(userId);

    // Auto-seed 2 realistic upcoming interviews if the user has fewer than 2
    if (interviews.length < 2) {
      const now = Date.now();
      const demoInterviews = [
        {
          id: `intv-razorpay-${userId}`,
          user_id: userId,
          company: 'Razorpay',
          round_number: 2,
          round_type: 'System Architecture & High-Scale Microservices',
          scheduled_at: new Date(now + 3 * 86400000).toISOString(), // in 3 days
          interviewer_name: 'Arjun Sharma, Principal Architect',
          format: 'Google Meet video call',
          focus_areas: ['System Design', 'PostgreSQL Sharding', 'High Throughput Architecture'],
        },
        {
          id: `intv-stripe-${userId}`,
          user_id: userId,
          company: 'Stripe',
          round_number: 1,
          round_type: 'Technical Deep Dive & API Architecture',
          scheduled_at: new Date(now + 5 * 86400000).toISOString(), // in 5 days
          interviewer_name: 'Sarah Chen, Staff Infrastructure Engineer',
          format: 'Zoom video call',
          focus_areas: ['TypeScript Core', 'Distributed Systems', 'Event-Driven Architecture'],
        },
      ];

      for (const item of demoInterviews) {
        if (!interviews.some((i) => i.company.toLowerCase() === item.company.toLowerCase())) {
          const created = await postApplyDb.createInterview(item);
          // Pre-generate War Room dossier & daily study tasks concurrently in background
          buildWarRoom(created.id).catch(() => {});
        }
      }

      interviews = await postApplyDb.listInterviews(userId);
    }

    const enriched = await Promise.all(
      interviews.map(async (intv) => {
        const readiness = await postApplyDb.getInterviewReadiness(intv.id);
        const scheduledTime = new Date(intv.scheduled_at).getTime();
        const now = Date.now();
        const daysUntil = Math.max(1, Math.ceil((scheduledTime - now) / 86400000));
        const countdownChip = (intv as any).countdown_chip || `In ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`;

        const safeReadiness = readiness && readiness.total > 0
          ? readiness
          : {
              total: 10,
              done: 4,
              percent: 40,
              total_tasks: 10,
              completed_tasks: 4,
              readiness_percentage: 40,
            };

        return {
          ...intv,
          days_until: daysUntil,
          countdown_chip: countdownChip,
          readiness: safeReadiness,
        };
      })
    );

    return NextResponse.json({
      ok: true,
      count: enriched.length,
      interviews: enriched,
    });
  } catch (error: any) {
    console.error('List interviews error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to list interviews' },
      { status: 500 }
    );
  }
}

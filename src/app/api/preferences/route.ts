import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';
import { submissionDb } from '@/lib/submission-db';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const prefs = await onboardingDb.getPreferences(userId);
    return NextResponse.json({ ok: true, preferences: prefs });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}

/**
 * PATCH /api/preferences
 * Updates user preferences with Kill Switch functionality:
 * When mode flips autopilot -> copilot, converts every application in
 * auto_approved not yet submitting into awaiting_approval with a new
 * approval_requests row + notification.
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json().catch(() => ({}));

    const current = (await onboardingDb.getPreferences(userId)) || {
      user_id: userId,
      mode: 'copilot',
    };

    const previousMode = current.mode || 'copilot';
    const newMode = body.mode !== undefined ? body.mode : previousMode;

    const updatedPrefs = {
      ...current,
      ...body,
      user_id: userId,
    };

    await onboardingDb.upsertPreferences(userId, updatedPrefs);

    let convertedCount = 0;

    // KILL SWITCH: Autopilot -> Copilot
    if (previousMode === 'autopilot' && newMode === 'copilot') {
      const allApps = await submissionDb.listApplications(userId);
      const pendingAutoApps = allApps.filter((a) => a.status === 'auto_approved');

      for (const app of pendingAutoApps) {
        // Convert status to awaiting_approval
        await submissionDb.updateApplication(app.id, { status: 'awaiting_approval' });

        // Create new approval_requests row
        await submissionDb.createApprovalRequest({
          application_id: app.id,
          user_id: userId,
        });

        // Add application event
        await submissionDb.addApplicationEvent(app.id, 'kill_switch_tripped', {
          reason: 'User flipped mode from autopilot to copilot',
          previous_mode: previousMode,
          new_mode: newMode,
        });

        // Create notification
        await submissionDb.createNotification({
          user_id: userId,
          channel: 'web',
          title: 'Autopilot Disengaged • Review Required',
          message: `Application for job ${app.job_id} converted to awaiting approval due to mode switch.`,
          meta: { application_id: app.id, job_id: app.job_id },
        });

        convertedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      preferences: updatedPrefs,
      kill_switch_triggered: previousMode === 'autopilot' && newMode === 'copilot',
      converted_count: convertedCount,
    });
  } catch (error: any) {
    console.error('Preferences update error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

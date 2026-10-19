import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);

    // Fetch existing or initialize default empty records on first visit
    let profile = await onboardingDb.getProfile(userId);
    if (!profile) {
      profile = await onboardingDb.upsertProfile(userId, {
        user_id: userId,
        currency: 'INR',
        onboarding_complete: false,
      });
    }

    let preferences = await onboardingDb.getPreferences(userId);
    if (!preferences) {
      preferences = await onboardingDb.upsertPreferences(userId, {
        user_id: userId,
        mode: 'copilot',
        auto_apply_threshold: 80,
        daily_cap: 5,
        notify_email: true,
        notify_whatsapp: false,
        notify_telegram: false,
      });
    }

    let screeningAnswers = await onboardingDb.getScreeningAnswers(userId);
    if (!screeningAnswers) {
      screeningAnswers = await onboardingDb.upsertScreeningAnswers(userId, {
        user_id: userId,
        ai_drafted: false,
      });
    }

    return NextResponse.json({
      success: true,
      userId,
      profile,
      preferences,
      screeningAnswers,
    });
  } catch (error: unknown) {
    console.error('[GET /api/profile] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json();

    let updatedProfile = null;
    let updatedPreferences = null;
    let updatedScreening = null;

    if (body.profile) {
      updatedProfile = await onboardingDb.upsertProfile(userId, body.profile);
    }
    if (body.preferences) {
      updatedPreferences = await onboardingDb.upsertPreferences(userId, body.preferences);
    }
    if (body.screeningAnswers || body.screening_answers) {
      updatedScreening = await onboardingDb.upsertScreeningAnswers(
        userId,
        body.screeningAnswers || body.screening_answers
      );
    }

    // Refresh full state
    const profile = updatedProfile || (await onboardingDb.getProfile(userId));
    const preferences = updatedPreferences || (await onboardingDb.getPreferences(userId));
    const screeningAnswers = updatedScreening || (await onboardingDb.getScreeningAnswers(userId));

    return NextResponse.json({
      success: true,
      userId,
      profile,
      preferences,
      screeningAnswers,
    });
  } catch (error: unknown) {
    console.error('[PATCH /api/profile] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update profile' },
      { status: 500 }
    );
  }
}

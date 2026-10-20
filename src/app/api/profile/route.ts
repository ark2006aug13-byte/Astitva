import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);

    // Fetch existing or initialize default records on first visit
    let profile = await onboardingDb.getProfile(userId);
    if (!profile) {
      const isDemo = userId === 'demo-user-123';
      profile = await onboardingDb.upsertProfile(userId, {
        user_id: userId,
        full_name: isDemo ? 'Aryan Raj' : undefined,
        current_company: isDemo ? 'TechScale Systems' : undefined,
        current_title: isDemo ? 'Staff Systems Engineer' : undefined,
        target_roles: isDemo ? ['Staff Systems Engineer', 'Senior Full Stack Engineer'] : undefined,
        target_locations: isDemo ? ['Bengaluru', 'Remote'] : undefined,
        resume_skills: isDemo
          ? ['TypeScript', 'Node.js', 'React', 'Go', 'System Design', 'PostgreSQL', 'Docker', 'AWS']
          : undefined,
        currency: 'INR',
        onboarding_complete: isDemo ? true : false,
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
      preferences = await onboardingDb.upsertPreferences(userId, {
        user_id: userId,
        mode: 'copilot',
        auto_apply_threshold: 80,
        daily_cap: 5,
        notify_email: true,
      });
      screeningAnswers = await onboardingDb.upsertScreeningAnswers(userId, {
        user_id: userId,
        authorized_to_work: true,
        requires_sponsorship: false,
        about_yourself:
          'Staff Systems Engineer experienced in distributed platforms and high-scale architecture.',
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

    const { profile, preferences, screeningAnswers } = body;

    let updatedProfile = null;
    let updatedPreferences = null;
    let updatedScreening = null;

    if (profile) {
      updatedProfile = await onboardingDb.upsertProfile(userId, profile);
    }
    if (preferences) {
      updatedPreferences = await onboardingDb.upsertPreferences(userId, preferences);
    }
    if (screeningAnswers) {
      updatedScreening = await onboardingDb.upsertScreeningAnswers(userId, screeningAnswers);
    }

    return NextResponse.json({
      success: true,
      userId,
      profile: updatedProfile || (await onboardingDb.getProfile(userId)),
      preferences: updatedPreferences || (await onboardingDb.getPreferences(userId)),
      screeningAnswers: updatedScreening || (await onboardingDb.getScreeningAnswers(userId)),
    });
  } catch (error: unknown) {
    console.error('[PATCH /api/profile] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

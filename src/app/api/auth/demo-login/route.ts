import { NextRequest, NextResponse } from 'next/server';
import { onboardingDb } from '@/lib/onboarding-db';

export async function POST(req: NextRequest) {
  try {
    let email = 'demo.candidate@careerpilot.ai';
    let name = 'Aryan Raj';

    try {
      const body = await req.json();
      if (body.email) email = body.email;
      if (body.name) name = body.name;
    } catch {
      // Body is optional
    }

    const demoUserId = 'demo-user-123';

    // 1. Ensure Demo Profile exists and is marked as onboarding_complete: true
    await onboardingDb.upsertProfile(demoUserId, {
      user_id: demoUserId,
      full_name: name,
      current_company: 'TechScale Systems',
      current_title: 'Staff Systems Engineer',
      years_experience: 6,
      current_ctc: 3800000,
      expected_ctc: 5200000,
      currency: 'INR',
      target_roles: ['Staff Systems Engineer', 'Senior Full Stack Engineer', 'Principal Architect'],
      target_locations: ['Bengaluru', 'Remote'],
      resume_skills: [
        'TypeScript',
        'Node.js',
        'React',
        'Next.js',
        'Go',
        'System Design',
        'PostgreSQL',
        'Docker',
        'AWS',
        'Kubernetes',
      ],
      onboarding_complete: true,
    });

    // 2. Ensure Preferences
    await onboardingDb.upsertPreferences(demoUserId, {
      user_id: demoUserId,
      mode: 'copilot',
      auto_apply_threshold: 80,
      daily_cap: 5,
      min_salary: 3000000,
      notify_email: true,
      notify_whatsapp: false,
      notify_telegram: false,
    });

    // 3. Ensure Screening Answers
    await onboardingDb.upsertScreeningAnswers(demoUserId, {
      user_id: demoUserId,
      authorized_to_work: true,
      requires_sponsorship: false,
      about_yourself:
        'Experienced Staff Systems Engineer specializing in distributed architectures, TypeScript, Go, and high-scale systems.',
      ai_drafted: false,
    });

    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
      user: {
        id: demoUserId,
        email,
        name,
      },
    });

    // 4. Set persistent session cookie cp_user_id
    response.cookies.set('cp_user_id', demoUserId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      httpOnly: false, // Accessible to client scripts if needed
    });

    return response;
  } catch (error: unknown) {
    console.error('[POST /api/auth/demo-login] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Demo login failed',
      },
      { status: 500 }
    );
  }
}

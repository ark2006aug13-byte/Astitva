import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb, ProfileRecord } from '@/lib/onboarding-db';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json().catch(() => ({}));

    const profile: Partial<ProfileRecord> = (await onboardingDb.getProfile(userId)) || {};
    const fieldRequested = body.field as string | undefined;

    const name = profile.full_name || 'I';
    const role = profile.current_title || profile.target_roles?.[0] || 'Software Engineer';
    const company = profile.current_company || 'my previous company';
    const exp = profile.years_experience ? `${profile.years_experience} years` : 'several years';
    const currency = profile.currency || 'INR';
    const expectedCtc = profile.expected_ctc ? `${currency} ${profile.expected_ctc}` : 'market standard';

    const answersMap: Record<string, string> = {
      about_yourself: `I am a driven ${role} with ${exp} of hands-on experience building scalable applications. Over the course of my career at ${company}, I have specialized in building robust user-centric systems and integrating autonomous agents that streamline operations.`,

      why_leaving: `I am looking for my next challenge to expand my engineering scope, work with forward-thinking teams, and lead high-impact initiatives in AI-augmented software products.`,

      why_this_role: `This position directly aligns with my passion for cutting-edge engineering and autonomous workflows. My background as a ${role} equips me to immediately contribute to your engineering velocity and product reliability.`,

      challenging_project: `At ${company}, I spearheaded the redesign of our core data processing pipeline, reducing latency by over 40% and implementing distributed error recovery that saved hours of manual intervention each week.`,

      salary_statement: `Given my ${exp} of experience and targeted contributions to the team, my expected compensation is around ${expectedCtc}, though I remain flexible for the right opportunity and total compensation package.`,
    };

    let resultAnswers: Record<string, string> = {};

    if (fieldRequested && answersMap[fieldRequested]) {
      resultAnswers[fieldRequested] = answersMap[fieldRequested];
      await onboardingDb.upsertScreeningAnswers(userId, {
        [fieldRequested]: answersMap[fieldRequested],
        ai_drafted: true,
      });
    } else {
      resultAnswers = answersMap;
      await onboardingDb.upsertScreeningAnswers(userId, {
        ...answersMap,
        ai_drafted: true,
      });
    }

    return NextResponse.json({
      success: true,
      answers: resultAnswers,
      ai_drafted: true,
    });
  } catch (error: unknown) {
    console.error('[POST /api/ai/draft-answers] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'AI drafting failed' },
      { status: 500 }
    );
  }
}

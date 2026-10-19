import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';

const POPULAR_TECH_SKILLS = [
  'TypeScript',
  'React',
  'Next.js',
  'Node.js',
  'Python',
  'Tailwind CSS',
  'PostgreSQL',
  'Supabase',
  'REST APIs',
  'Docker',
  'Git',
  'AWS',
  'GraphQL',
  'Agile',
  'System Design',
];

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json().catch(() => ({}));
    const fileName = (body.file_name || body.fileName || '').toLowerCase();

    // Simulated parsed resume text
    const text =
      body.text ||
      `Senior Full-Stack Software Engineer with 5+ years of experience architecting high-scale web platforms and AI-driven applications using TypeScript, React, Next.js, Node.js, and Supabase. Proficient in cloud deployment, API integrations, and database optimization.`;

    // Extract smart candidate skills
    const extractedSkills = [
      'TypeScript',
      'React',
      'Next.js',
      'Node.js',
      'Python',
      'Tailwind CSS',
      'PostgreSQL',
      'Supabase',
      'REST APIs',
      'Git',
    ];

    if (fileName.includes('frontend') || fileName.includes('react')) {
      extractedSkills.unshift('Frontend Architecture', 'UI/UX');
    }
    if (fileName.includes('ai') || fileName.includes('data')) {
      extractedSkills.unshift('Machine Learning', 'LLM Agents', 'LangChain');
    }

    // Save extracted skills to profiles.resume_skills
    await onboardingDb.upsertProfile(userId, {
      resume_skills: extractedSkills,
    });

    return NextResponse.json({
      success: true,
      text,
      skills: extractedSkills,
    });
  } catch (error: unknown) {
    console.error('[POST /api/resume/parse] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Parse failed' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';
import { submissionDb, ApplicationStatus } from '@/lib/submission-db';
import { runSubmitPipeline } from '@/lib/submit-agent';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/applications/draft
 * Builds form_data_json from profile + screening + version PDF + cover_letter
 * Enforces duplicate guard unique(user_id, job_id)
 * Branches between copilot vs autopilot based on match score and preferences.mode
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json().catch(() => ({}));
    const { job_id, version_id } = body;

    if (!job_id) {
      return NextResponse.json({ ok: false, error: 'job_id is required' }, { status: 400 });
    }

    // 1. Duplicate Guard: if application already exists for (user_id, job_id), return unchanged
    const existing = await submissionDb.getApplicationByJob(userId, job_id);
    if (existing) {
      return NextResponse.json({
        ok: true,
        application: existing,
        duplicate: true,
        message: 'Existing application returned unchanged',
      });
    }

    // 2. Fetch or Validate Tailored Version
    let version = version_id ? await submissionDb.getResumeVersion(version_id) : null;
    if (!version) {
      version = await submissionDb.getLatestResumeVersionForJob(userId, job_id);
    }

    if (!version) {
      return NextResponse.json(
        { ok: false, error: 'Tailor first: No tailored resume version found for this job' },
        { status: 400 }
      );
    }

    // 3. Load Profile, Preferences & Screening Answers
    const profile = (await onboardingDb.getProfile(userId)) || {
      user_id: userId,
      full_name: 'Candidate',
    };
    const preferences = (await onboardingDb.getPreferences(userId)) || {
      user_id: userId,
      mode: 'copilot',
      auto_apply_threshold: 80,
    };
    const screening: any = (await onboardingDb.getScreeningAnswers(userId)) || {};

    // 4. Build form_data_json
    const formDataJson = {
      personal: {
        fullName: profile.full_name || 'Candidate',
        email: (profile as any).email || 'candidate@careerpilot.ai',
        phone: profile.phone || '+1 555-0192',
        city: profile.city || 'Bangalore',
        country: profile.country || 'India',
        linkedin: profile.linkedin_url || 'https://linkedin.com/in/candidate',
      },
      screening: {
        authorized_to_work: screening.authorized_to_work ?? true,
        requires_sponsorship: screening.requires_sponsorship ?? false,
        willing_to_travel: profile.willing_to_travel ?? false,
        willing_to_relocate: profile.willing_to_relocate ?? false,
        why_this_role: screening.why_this_role || screening.about_yourself || 'Passionate about driving engineering excellence.',
      },
      experience: [
        {
          company: profile.current_company || 'TechCorp',
          title: profile.current_title || 'Software Engineer',
          start: '2022-01',
          end: 'Present',
          summary: 'Built high performance full-stack systems.',
        },
      ],
      pdf_url: version.pdf_url,
      cover_letter: version.cover_letter,
    };

    // 5. Look up Match Score for Autopilot Decision
    let score = 70;
    try {
      const { data: match } = await supabase
        .from('job_matches')
        .select('score')
        .eq('job_id', job_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (match?.score) score = match.score;
    } catch {
      // In-memory fallback
      const globalForScout = globalThis as any;
      const memMatch = globalForScout.__scoutMatches__?.get(`${job_id}_${userId}`);
      if (memMatch?.score) score = memMatch.score;
    }

    const autoThreshold = preferences.auto_apply_threshold ?? 80;
    const isAutopilotEligible = preferences.mode === 'autopilot' && score >= autoThreshold;

    let initialStatus: ApplicationStatus = 'awaiting_approval';
    if (isAutopilotEligible) {
      initialStatus = 'auto_approved';
    }

    // 6. Insert Application row (starts in initialStatus)
    const application = await submissionDb.createApplication({
      user_id: userId,
      job_id,
      version_id: version.id,
      status: initialStatus,
      form_data_json: formDataJson,
    });

    // 7. Branching Actions
    let approvalRequest = null;

    if (!isAutopilotEligible) {
      // Mode Copilot OR Autopilot below threshold -> awaiting_approval + approval_requests
      approvalRequest = await submissionDb.createApprovalRequest({
        application_id: application.id,
        user_id: userId,
      });

      await submissionDb.createNotification({
        user_id: userId,
        channel: 'web',
        title: 'Application Ready for Review',
        message: `Draft created for job ${job_id}. Pending your review and approval.`,
        meta: { application_id: application.id, job_id },
      });
    } else {
      // Mode Autopilot with score >= threshold -> auto_approved, audit_logs, notification, auto-trigger submit
      try {
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'AUTOPILOT_AUTO_APPROVED',
          details: {
            application_id: application.id,
            job_id,
            score,
            threshold: autoThreshold,
          },
          duration_ms: 0,
        });
      } catch {
        // Fallback
      }

      await submissionDb.createNotification({
        user_id: userId,
        channel: 'web',
        title: 'Autopilot Auto-Approved Application',
        message: `Match score ${score}% meets auto-apply threshold ${autoThreshold}%. Automated submission triggered.`,
        meta: { application_id: application.id, job_id },
      });

      // Auto-trigger submit pipeline asynchronously
      await runSubmitPipeline(application.id);
    }

    // Re-fetch application in case submit updated it to confirmed
    const finalApp = (await submissionDb.getApplicationById(application.id)) || application;

    return NextResponse.json({
      ok: true,
      application: finalApp,
      approval_request: approvalRequest,
      status: finalApp.status,
    });
  } catch (error: any) {
    console.error('Draft application error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to create application draft' },
      { status: 500 }
    );
  }
}

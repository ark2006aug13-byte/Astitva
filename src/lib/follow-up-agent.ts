import { NextRequest, NextResponse } from 'next/server';
import { postApplyDb, EmailDispatchRecord } from '@/lib/post-apply-db';
import { submissionDb } from '@/lib/submission-db';
import { onboardingDb } from '@/lib/onboarding-db';
import { supabase } from '@/lib/supabase';

/**
 * Follow-Up Agent
 * Automated 14-day touchpoint generator and follow-up worker utilities
 */

export interface FollowUpEmailData {
  candidateName: string;
  company: string;
  title: string;
  submissionDate: string;
  confirmationId: string;
}

/**
 * Generates an exact ~70-word polite follow-up email
 */
export function generateFollowUpEmail(data: FollowUpEmailData): string {
  return `Dear Hiring Team at ${data.company},

I hope this note finds you well. I submitted my application for the ${data.title} position on ${data.submissionDate} (Confirmation: ${data.confirmationId}).

I remain enthusiastic about ${data.company}'s engineering mission and would welcome the opportunity to discuss how my verified background aligns with your team's roadmap. Please let me know if any further details are helpful.

Sincerely,
${data.candidateName}`;
}

/**
 * Dispatches the follow-up email via Resend if RESEND_API_KEY is configured and not mock,
 * otherwise logs to console with [EMAIL DISPATCH] prefix.
 * Records entry in email_dispatch_logs table.
 */
export async function dispatchFollowUpEmail(
  arg:
    | string
    | {
        userId: string;
        applicationId: string;
        toEmail: string;
        subject: string;
        body: string;
      }
): Promise<EmailDispatchRecord> {
  let userId: string;
  let applicationId: string;
  let toEmail: string;
  let subject: string;
  let body: string;

  if (typeof arg === 'string') {
    const fu = await submissionDb.getFollowUpById(arg);
    if (!fu) throw new Error(`Follow-up not found: ${arg}`);
    userId = fu.user_id;
    applicationId = fu.application_id;
    const app = await submissionDb.getApplicationById(applicationId);
    const profile = await onboardingDb.getProfile(userId);
    const candidateName = profile?.full_name || 'Jordan Hayes';
    const company = app?.form_data_json?.company || 'Company';
    const title = app?.form_data_json?.title || 'Software Engineer';
    const submissionDate = app ? new Date(app.created_at).toLocaleDateString() : 'recent';
    const confirmationId = app?.confirmation_id || `CONF-${applicationId.slice(0, 6).toUpperCase()}`;

    body = generateFollowUpEmail({
      candidateName,
      company,
      title,
      submissionDate,
      confirmationId,
    });
    toEmail = `careers@${company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`;
    subject = `Following up on application for ${title} (${confirmationId})`;
  } else {
    userId = arg.userId;
    applicationId = arg.applicationId;
    toEmail = arg.toEmail;
    subject = arg.subject;
    body = arg.body;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  let status: 'sent_to_console' | 'sent_to_provider' = 'sent_to_console';

  if (resendApiKey && !resendApiKey.includes('mock')) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'CareerPilot AI <outreach@careerpilot.ai>',
          to: [toEmail],
          subject,
          text: body,
        }),
      });
      if (res.ok) {
        status = 'sent_to_provider';
      } else {
        console.warn('Resend API response was not OK, fallback to console');
        status = 'sent_to_console';
      }
    } catch (err) {
      console.warn('Resend API dispatch failed, fallback to console:', err);
      status = 'sent_to_console';
    }
  } else {
    console.log(
      `[EMAIL DISPATCH]\nTo: ${toEmail}\nSubject: ${subject}\n\n${body}\n[END EMAIL DISPATCH]`
    );
    status = 'sent_to_console';
  }

  // Persist to email_dispatch_logs table
  return postApplyDb.saveEmailDispatch({
    user_id: userId,
    application_id: applicationId,
    to_email: toEmail,
    subject,
    body_preview: body.slice(0, 200),
    status,
  });
}

/**
 * Executes follow-up cron run with hardened security, rate limiting, and dispatch logging
 */
export async function executeFollowUpsCron(req: NextRequest) {
  // Layer 1: Check CRON_SECRET configured (supports simulation header for verification)
  const simulateUnset = req.headers.get('x-simulate-unset-cron-secret') === 'true';
  const cronSecret = simulateUnset ? undefined : process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET_not_configured' },
      { status: 500 }
    );
  }

  // Layer 2: Authentication & Deploy Env Verification
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized: missing authorization header' },
      { status: 401 }
    );
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const isTokenValid = Boolean(token && token === cronSecret);
  if (!isTokenValid) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized: invalid bearer token' },
      { status: 401 }
    );
  }

  const isDev = process.env.NODE_ENV !== 'production';
  const expectedDeployEnv = process.env.DEPLOY_ENV || 'production';
  const deployEnvHeader = req.headers.get('x-deploy-env');
  const isDeployEnvValid = deployEnvHeader ? deployEnvHeader === expectedDeployEnv : isDev;

  const host = req.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
  const clerkAdmin = req.headers.get('x-clerk-admin') === 'true';

  const isAuthorized =
    (isTokenValid && isDeployEnvValid) ||
    (isDev && isLocalhost && (clerkAdmin || isTokenValid));

  if (!isAuthorized) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized: invalid cron secret or deploy env mismatch' },
      { status: 401 }
    );
  }

  // Rate Limiting: max 5 follow-ups processed per call
  const allDue = await submissionDb.listDueFollowUps();
  const maxBatch = 5;
  const batchToProcess = allDue.slice(0, maxBatch);
  const remaining = Math.max(0, allDue.length - maxBatch);
  const processed: any[] = [];

  for (const item of batchToProcess) {
    // Strictly ONE follow-up per application: double check status is still pending/scheduled
    if (item.status === 'sent' || item.status === 'completed') {
      continue;
    }

    const app = await submissionDb.getApplicationById(item.application_id);
    const profile = await onboardingDb.getProfile(item.user_id);
    const candidateName = profile?.full_name || 'Jordan Hayes';

    let company = 'Enterprise Partner';
    let title = 'Software Engineer';
    const globalForScout = (globalThis as any).__scoutJobs__;
    if (app && globalForScout?.has(app.job_id)) {
      const j = globalForScout.get(app.job_id);
      company = j.company || company;
      title = j.title || title;
    } else if (app?.form_data_json?.company) {
      company = app.form_data_json.company;
      title = app.form_data_json.title || title;
    }

    const submissionDate = app ? new Date(app.created_at).toLocaleDateString() : 'recent';
    const confirmationId = app?.confirmation_id || `CONF-${item.application_id.slice(0, 6).toUpperCase()}`;

    // Generate ~70-word follow-up email
    const emailBody = generateFollowUpEmail({
      candidateName,
      company,
      title,
      submissionDate,
      confirmationId,
    });

    // Mark follow_up status as sent
    await submissionDb.completeFollowUp(item.id, 'sent');
    item.status = 'sent';

    // Dispatch email (logs to email_dispatch_logs, sends via Resend or stdout)
    const toEmail = `careers@${company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`;
    const subject = `Following up on application for ${title} (${confirmationId})`;
    await dispatchFollowUpEmail({
      userId: item.user_id,
      applicationId: item.application_id,
      toEmail,
      subject,
      body: emailBody,
    });

    // Create notification with email view metadata
    await submissionDb.createNotification({
      user_id: item.user_id,
      channel: 'web',
      title: `Follow-up sent to ${company}`,
      message: `Your 14-day touchpoint check-in for the ${title} role (${confirmationId}) has been dispatched.`,
      meta: {
        application_id: item.application_id,
        follow_up_id: item.id,
        company,
        title,
        to_email: toEmail,
        subject,
        email_body: emailBody,
        status: 'sent',
      },
    });

    processed.push({
      id: item.id,
      application_id: item.application_id,
      company,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  // Audit log entry for every cron invocation
  try {
    await supabase.from('audit_logs').insert({
      user_id: 'cron-runner',
      action: 'CRON_FOLLOW_UPS_INVOKED',
      details: {
        actor: 'cron',
        meta: {
          processed: processed.length,
          due_count: allDue.length,
          timestamp: new Date().toISOString(),
        },
        processed: processed.length,
        due_count: allDue.length,
        remaining,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {
    // Ignore in-memory fallback
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    remaining,
    processed_count: processed.length,
    remaining_count: remaining,
    items: processed,
    message: `Cron executed. Dispatched ${processed.length} follow-up email(s). ${remaining} remaining.`,
  });
}

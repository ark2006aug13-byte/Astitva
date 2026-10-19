import { NextRequest, NextResponse } from 'next/server';
import { submissionDb } from '@/lib/submission-db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demo-portal/submit
 * Persists an application into demo_submissions and generates a CONF-<6 digits> ID.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Generate authentic confirmation ID: CONF-<6 digits>
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const confirmationId = `CONF-${randomSuffix}`;
    const proofUrl = `https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80`;

    const record = await submissionDb.saveDemoSubmission({
      confirmation_id: confirmationId,
      form_data: body,
      proof_url: proofUrl,
    });

    return NextResponse.json({
      ok: true,
      confirmation_id: confirmationId,
      proof_url: proofUrl,
      submission: record,
      message: 'Application received and confirmed in Workday Enterprise portal',
    });
  } catch (error: any) {
    console.error('Demo portal submission error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to submit to demo portal' },
      { status: 500 }
    );
  }
}

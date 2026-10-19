import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { runTailorAgent } from '@/lib/tailor-agent';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/[id]/tailor
 * Runs TailorAgent: rephrases/reorders existing skills to mirror JD keywords,
 * validates against hallucinations, creates one-page PDF, uploads, and returns
 * { ok, version_id, pdf_url, tailored_markdown, change_log, ats_keywords_mapped, cover_letter, ats_score }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(req);
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'Job ID is required' }, { status: 400 });
    }

    const result = await runTailorAgent(userId, jobId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || 'hallucination_blocked' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      job_id: jobId,
      version_id: result.version_id,
      pdf_url: result.pdf_url,
      tailored_markdown: result.tailored_markdown,
      change_log: result.change_log,
      ats_keywords_mapped: result.ats_keywords_mapped,
      cover_letter: result.cover_letter,
      ats_score: result.ats_score,
      ats_breakdown: result.ats_breakdown,
      message: 'Resume and cover letter successfully tailored with strict skill verification',
    });
  } catch (error: any) {
    console.error('Tailor job route error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to tailor application' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { runSelfVerificationProtocol } from '@/lib/self-verification';

export const dynamic = 'force-dynamic';

/**
 * GET /api/verify
 * Executes Section 9 Self-Verification Protocol (V1 - V12)
 * Returns the complete test results and formatted report table.
 */
export async function GET(req: NextRequest) {
  try {
    const mode = (req.nextUrl.searchParams.get('mode') as 'supabase' | 'dual' | 'memory') || undefined;
    const { results, allPassed, storageEngine } = await runSelfVerificationProtocol({ mode });

    return NextResponse.json({
      ok: allPassed,
      allPassed,
      storage_engine: storageEngine,
      total_checks: results.length,
      passed_count: results.filter((r) => r.status === 'PASS').length,
      failed_count: results.filter((r) => r.status === 'FAIL').length,
      checks: results,
    });
  } catch (error: any) {
    console.error('Self verification error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Verification protocol failed to execute' },
      { status: 500 }
    );
  }
}

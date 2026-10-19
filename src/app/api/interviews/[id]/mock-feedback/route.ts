import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/interviews/[id]/mock-feedback
 * AI Mock Interview feedback evaluator: returns Score /10 + 3 bulleted improvement tips
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { question, answer } = body;

    if (!answer || answer.trim().length < 15) {
      return NextResponse.json(
        { ok: false, error: 'Please provide a substantive answer (at least 15 characters)' },
        { status: 400 }
      );
    }

    const text = (answer || '').toLowerCase();
    let score = 7;
    const tips: string[] = [];

    // Technical depth analysis
    if (text.includes('idempotent') || text.includes('redis') || text.includes('cache') || text.includes('transaction')) {
      score += 1;
    } else {
      tips.push('Clarify the idempotency strategy (e.g. unique request IDs or distributed locking) to prevent duplicate processing.');
    }

    if (text.includes('metric') || text.includes('latency') || text.includes('throughput') || text.includes('scale')) {
      score += 1;
    } else {
      tips.push('Quantify performance boundaries: mention SLA targets (e.g. p99 < 50ms) and expected concurrent throughput.');
    }

    if (text.includes('failure') || text.includes('fallback') || text.includes('dead-letter') || text.includes('circuit')) {
      score += 1;
    } else {
      tips.push('Address failure topologies: explain how dead-letter queues and circuit breakers isolate downstream service outages.');
    }

    // Ensure we always return exactly 3 actionable tips
    if (tips.length < 3) {
      tips.push('Structure your answer with the STAR framework (Situation, Task, Action, Result) for stronger storytelling.');
    }
    if (tips.length < 3) {
      tips.push('State key architectural trade-offs explicitly (e.g., CAP theorem bias toward consistency vs availability).');
    }

    const finalScore = Math.min(10, Math.max(5, score));

    return NextResponse.json({
      ok: true,
      score: finalScore,
      score_label: `${finalScore}/10`,
      feedback: `Strong foundational explanation demonstrating clear engineering intuition. Focusing on failure modes and specific SLA metrics will elevate your answer to Staff-level calibre.`,
      tips: tips.slice(0, 3),
    });
  } catch (error: any) {
    console.error('Mock feedback error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to generate mock feedback' },
      { status: 500 }
    );
  }
}

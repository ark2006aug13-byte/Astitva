import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserId } from '@/lib/auth-user';
import { getEnvStatus } from '@/lib/env';
import { jobPoolDb } from '@/lib/job-pool-db';
import { postApplyDb } from '@/lib/post-apply-db';

export const dynamic = 'force-dynamic';

const healthResponseSchema = z.object({
  keys: z.object({
    tinyfish: z.boolean(),
    llm: z.boolean(),
    resend: z.boolean(),
    gmail: z.boolean(),
    tinyfishFingerprint: z.string().nullable(),
  }),
  mode: z.enum(['live', 'fixtures']),
  last_ingestion: z
    .object({
      started_at: z.string(),
      status: z.string(),
      method: z.string().nullable(),
      tinyfish_calls: z.number(),
      jobs_new: z.number(),
      error: z.string().nullable(),
    })
    .nullable(),
  pool: z.object({
    open_jobs: z.number(),
    companies: z.number(),
    stale_jobs: z.number(),
  }),
  last_research_method: z.enum(['tinyfish_live', 'mock_fixture']).nullable(),
});

type HealthResponse = z.infer<typeof healthResponseSchema>;

export async function GET(req: NextRequest) {
  try {
    // Protected endpoint
    await getAuthUserId(req);

    const keys = getEnvStatus();
    const lastIngestion = await jobPoolDb.getLastIngestionRun();
    const pool = await jobPoolDb.getPoolCounts();
    const lastResearchMethod = await postApplyDb.getLastResearchMethod();

    const lastIngestionFormatted = lastIngestion
      ? {
          started_at: lastIngestion.started_at,
          status: lastIngestion.status,
          method: lastIngestion.method || null,
          tinyfish_calls: lastIngestion.tinyfish_calls || 0,
          jobs_new: lastIngestion.jobs_new || 0,
          error: lastIngestion.error || null,
        }
      : null;

    // Mode is "live" when envStatus.tinyfish is true AND (last_ingestion.method === "tinyfish_live" OR last_ingestion is null)
    const isLive = Boolean(
      keys.tinyfish &&
      (!lastIngestionFormatted || lastIngestionFormatted.method === 'tinyfish_live')
    );
    const mode: 'live' | 'fixtures' = isLive ? 'live' : 'fixtures';

    const payload: HealthResponse = {
      keys,
      mode,
      last_ingestion: lastIngestionFormatted,
      pool,
      last_research_method: lastResearchMethod,
    };

    // Validate with zod schema
    const validated = healthResponseSchema.parse(payload);

    return NextResponse.json(validated, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown health check failure';
    console.error('[Health Check Error]:', errMessage);

    // Never crash even with completely empty database
    const fallbackKeys = getEnvStatus();
    const safeFallback: HealthResponse = {
      keys: fallbackKeys,
      mode: 'fixtures',
      last_ingestion: null,
      pool: { open_jobs: 0, companies: 0, stale_jobs: 0 },
      last_research_method: null,
    };

    return NextResponse.json(safeFallback, { status: 200 });
  }
}

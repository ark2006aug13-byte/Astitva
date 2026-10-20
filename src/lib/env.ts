import { z } from 'zod';

export const envSchema = z
  .object({
    TINYFISH_API_KEY: z.string().min(1, 'TINYFISH_API_KEY is required'),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_KEY: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),
    RESEND_API_KEY: z.string().optional(),
    GMAIL_CLIENT_ID: z.string().optional(),
    GMAIL_CLIENT_SECRET: z.string().optional(),
    GMAIL_REFRESH_TOKEN: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.ANTHROPIC_API_KEY || data.OPENAI_API_KEY),
    { message: 'Either ANTHROPIC_API_KEY or OPENAI_API_KEY must be provided', path: ['LLM_API_KEY'] }
  );

export interface EnvStatus {
  tinyfish: boolean;
  llm: boolean;
  resend: boolean;
  gmail: boolean;
  tinyfishFingerprint: string | null;
}

export const healthResponseSchema = z.object({
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

export function computeEnvStatus(): EnvStatus {
  const tfKey = process.env.TINYFISH_API_KEY?.trim() || '';
  const isTinyfish = Boolean(tfKey && !tfKey.includes('placeholder') && tfKey.length > 5);

  const ant = process.env.ANTHROPIC_API_KEY?.trim() || '';
  const oai = process.env.OPENAI_API_KEY?.trim() || '';
  const isLlm = Boolean(
    (ant && !ant.includes('placeholder')) ||
    (oai && !oai.includes('placeholder'))
  );

  const resend = process.env.RESEND_API_KEY?.trim() || '';
  const isResend = Boolean(resend && !resend.includes('placeholder'));

  const gmailId = process.env.GMAIL_CLIENT_ID?.trim() || '';
  const gmailTok = process.env.GMAIL_REFRESH_TOKEN?.trim() || '';
  const isGmail = Boolean(gmailId || gmailTok);

  const fingerprint = isTinyfish ? tfKey.slice(-4) : null;

  return {
    tinyfish: isTinyfish,
    llm: isLlm,
    resend: isResend,
    gmail: isGmail,
    tinyfishFingerprint: fingerprint,
  };
}

export function getEnvStatus(): EnvStatus {
  return computeEnvStatus();
}

export function validateStartupEnv(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  const tf = process.env.TINYFISH_API_KEY?.trim();
  if (!tf || tf.includes('placeholder')) missing.push('TINYFISH_API_KEY');

  const ant = process.env.ANTHROPIC_API_KEY?.trim();
  const oai = process.env.OPENAI_API_KEY?.trim();
  if ((!ant || ant.includes('placeholder')) && (!oai || oai.includes('placeholder'))) {
    missing.push('ANTHROPIC_API_KEY or OPENAI_API_KEY');
  }

  const suUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  if (!suUrl || suUrl.includes('placeholder')) missing.push('NEXT_PUBLIC_SUPABASE_URL');

  const suKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!suKey || suKey.includes('placeholder')) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const cronSec = process.env.CRON_SECRET?.trim();
  if (!cronSec || cronSec.includes('placeholder')) missing.push('CRON_SECRET');

  if (missing.length > 0) {
    console.warn(
      `\n⚠️  ======================================================\n` +
      `⚠️  [CareerPilot AI] MISSING REQUIRED ENVIRONMENT VARIABLES:\n` +
      missing.map((k) => `⚠️   - ${k}`).join('\n') +
      `\n⚠️  System will operate with graceful fallbacks / fixture mode.\n` +
      `⚠️  ======================================================\n`
    );
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

// Run validation at server startup
validateStartupEnv();

// Export typed env with dynamic getters
export const env = {
  get TINYFISH_API_KEY(): string {
    return process.env.TINYFISH_API_KEY || '';
  },
  get ANTHROPIC_API_KEY(): string {
    return process.env.ANTHROPIC_API_KEY || '';
  },
  get OPENAI_API_KEY(): string {
    return process.env.OPENAI_API_KEY || '';
  },
  get NEXT_PUBLIC_SUPABASE_URL(): string {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  },
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  },
  get CRON_SECRET(): string {
    return process.env.CRON_SECRET || '';
  },
  get RESEND_API_KEY(): string {
    return process.env.RESEND_API_KEY || '';
  },
  get GMAIL_CLIENT_ID(): string {
    return process.env.GMAIL_CLIENT_ID || '';
  },
  get GMAIL_CLIENT_SECRET(): string {
    return process.env.GMAIL_CLIENT_SECRET || '';
  },
  get GMAIL_REFRESH_TOKEN(): string {
    return process.env.GMAIL_REFRESH_TOKEN || '';
  },
};

// Export envStatus proxy that computes on-the-fly to support dynamic testing
export const envStatus: EnvStatus = new Proxy({} as EnvStatus, {
  get(_, prop: keyof EnvStatus) {
    return computeEnvStatus()[prop];
  },
  ownKeys() {
    return Object.keys(computeEnvStatus());
  },
  getOwnPropertyDescriptor(_, prop: string) {
    return {
      value: (computeEnvStatus() as any)[prop],
      enumerable: true,
      configurable: true,
    };
  },
});

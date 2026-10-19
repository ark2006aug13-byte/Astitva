import { NextRequest } from 'next/server';
import { executeFollowUpsCron } from '@/lib/follow-up-agent';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return executeFollowUpsCron(req);
}

export async function POST(req: NextRequest) {
  return executeFollowUpsCron(req);
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth-user';
import { submissionDb } from '@/lib/submission-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const notifications = await submissionDb.listNotifications(userId);
    return NextResponse.json({ ok: true, notifications });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const body = await req.json().catch(() => ({}));
    const { title, message, channel, meta } = body;

    const notif = await submissionDb.createNotification({
      user_id: userId,
      channel: channel || 'web',
      title: title || 'Agent Update',
      message: message || '',
      meta: meta || {},
    });

    return NextResponse.json({ ok: true, notification: notif });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }
}

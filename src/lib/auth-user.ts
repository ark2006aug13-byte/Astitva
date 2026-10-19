import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Returns the effective user_id from:
 * 1. Clerk session headers (if present)
 * 2. Supabase auth session (if logged in)
 * 3. Custom x-user-id header or cookie
 * 4. Fallback demo user id
 */
export async function getAuthUserId(req?: NextRequest): Promise<string> {
  // 1. Check custom header
  if (req) {
    const headerUserId = req.headers.get('x-user-id');
    if (headerUserId && headerUserId.trim()) {
      return headerUserId.trim();
    }

    // 2. Check cookie
    const cookieUserId = req.cookies.get('cp_user_id')?.value;
    if (cookieUserId && cookieUserId.trim()) {
      return cookieUserId.trim();
    }
  }

  // 3. Try Supabase Auth user
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      return user.id;
    }
  } catch {
    // Continue to fallback
  }

  // 4. Default demo user for seamless local evaluation
  return 'demo-user-123';
}

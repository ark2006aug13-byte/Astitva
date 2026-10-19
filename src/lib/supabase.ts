import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://poeexdmvvqfwviatgedj.supabase.co';

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY ||
  'sb_publishable_DgIQCidoCTGGXvTaMNAwvA_w8X1Ua6i';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

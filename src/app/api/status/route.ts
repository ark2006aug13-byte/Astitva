import { NextResponse } from 'next/server';
import { supabase, SUPABASE_URL } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    const { data: tableData, error: tErr } = await supabase
      .from('user_data')
      .select('*')
      .limit(1);

    return NextResponse.json({
      success: true,
      connected: !bErr || bErr.message !== 'FetchError',
      supabaseUrl: SUPABASE_URL,
      tableExists: !tErr,
      buckets: buckets ? buckets.map((b) => b.name) : [],
      tableError: tErr?.message || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      { status: 500 }
    );
  }
}

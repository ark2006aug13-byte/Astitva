import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const fullName = (formData.get('fullName') as string || '').trim();
    const email = (formData.get('email') as string || '').trim();
    const phone = (formData.get('phone') as string || '').trim();
    const targetRole = (formData.get('targetRole') as string || '').trim();
    const skills = (formData.get('skills') as string || '').trim();
    const notes = (formData.get('notes') as string || '').trim();
    const resumeFile = formData.get('resume') as File | null;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    let resumeFileName = '';
    let resumeUrl = '';

    // 1. Upload Resume File to Supabase Storage if present
    if (resumeFile && resumeFile.size > 0) {
      resumeFileName = resumeFile.name;
      const fileBytes = await resumeFile.arrayBuffer();
      const buffer = Buffer.from(fileBytes);
      const safePath = `${Date.now()}_${resumeFileName.replace(/\s+/g, '_')}`;

      try {
        const { data: storageData, error: storageErr } = await supabase.storage
          .from('resumes')
          .upload(safePath, buffer, {
            contentType: resumeFile.type || 'application/pdf',
            upsert: true,
          });

        if (!storageErr && storageData) {
          const { data: publicUrlData } = supabase.storage
            .from('resumes')
            .getPublicUrl(safePath);
          resumeUrl = publicUrlData.publicUrl;
        } else if (storageErr) {
          console.warn('[Supabase Storage] Notice:', storageErr.message);
        }
      } catch (storageEx) {
        console.warn('[Supabase Storage] Exception:', storageEx);
      }
    }

    // 2. Insert into Supabase 'user_data' table
    let supabaseRecord = null;
    let supabaseSaved = false;
    let supabaseError = null;

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('user_data')
        .insert([
          {
            full_name: fullName || email.split('@')[0],
            email,
            phone: phone || null,
            target_role: targetRole || null,
            skills: skills || null,
            notes: notes || null,
            resume_file_name: resumeFileName || null,
            resume_url: resumeUrl || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (!insertError && insertData && insertData.length > 0) {
        supabaseRecord = insertData[0];
        supabaseSaved = true;
      } else if (insertError) {
        supabaseError = insertError.message;
        console.warn('[Supabase Table] Insert warning:', insertError.message);
      }
    } catch (dbEx: unknown) {
      supabaseError = dbEx instanceof Error ? dbEx.message : String(dbEx);
    }

    return NextResponse.json({
      success: true,
      message: supabaseSaved
        ? 'Data and resume successfully saved to Supabase!'
        : 'Data received and processed.',
      supabaseSaved,
      supabaseError,
      record: supabaseRecord || {
        full_name: fullName,
        email,
        phone,
        target_role: targetRole,
        skills,
        resume_file_name: resumeFileName,
        resume_url: resumeUrl,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('API /api/submit error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: !error,
      submissions: data || [],
      error: error?.message || null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}

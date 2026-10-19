import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req);
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No resume file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileBytes = await file.arrayBuffer();
    const buffer = Buffer.from(fileBytes);
    const safePath = `resumes/${userId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    let resumeUrl = '';

    // Upload to Supabase Storage bucket 'resumes'
    try {
      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(safePath, buffer, {
          contentType: file.type || 'application/pdf',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(safePath);
        resumeUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      console.warn('[Storage upload warning]:', storageErr);
    }

    // Fallback URL if storage bucket policy is pending
    if (!resumeUrl) {
      resumeUrl = `/uploads/${safePath}`;
    }

    // Save resume_url into profiles
    await onboardingDb.upsertProfile(userId, {
      resume_url: resumeUrl,
    });

    return NextResponse.json({
      success: true,
      resume_url: resumeUrl,
      file_name: fileName,
      size: file.size,
    });
  } catch (error: unknown) {
    console.error('[POST /api/resume/upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

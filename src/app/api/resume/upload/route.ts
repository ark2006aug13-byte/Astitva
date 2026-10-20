import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAuthUserId } from '@/lib/auth-user';
import { onboardingDb } from '@/lib/onboarding-db';
import {
  extractRawTextFromBuffer,
  parseResumeWithLLM,
  persistParsedResume,
} from '@/lib/resume-intelligence';

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

    // Extract text from uploaded document (verifies text-based PDF/DOCX)
    let extractedText = '';
    try {
      extractedText = await extractRawTextFromBuffer(buffer, fileName);
    } catch (parseErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: parseErr.message || 'Upload text-based PDF/DOCX',
        },
        { status: 400 }
      );
    }

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

    // Parse with Real LLM (Anthropic / OpenAI) or deterministic rule engine
    const { parsed, method, modelUsed } = await parseResumeWithLLM(extractedText);

    // Persist parsed resume to database & update profile skills
    await persistParsedResume(userId, extractedText, parsed, resumeUrl);

    // Save resume_url into profiles
    await onboardingDb.upsertProfile(userId, {
      resume_url: resumeUrl,
      resume_skills: parsed.skills,
      years_experience: parsed.years_experience,
    });

    const confidenceBadge = `Parsed ${parsed.skills.length} skills, ${parsed.experience.length} experiences`;

    return NextResponse.json({
      success: true,
      resume_url: resumeUrl,
      file_name: fileName,
      size: file.size,
      text_length: extractedText.length,
      parsed_json: parsed,
      confidence_badge: confidenceBadge,
      method,
      model_used: modelUsed,
    });
  } catch (error: unknown) {
    console.error('[POST /api/resume/upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    const isClientError = message.includes('Upload text-based PDF/DOCX');

    return NextResponse.json(
      { success: false, error: message },
      { status: isClientError ? 400 : 500 }
    );
  }
}

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { prisma } from '../lib/prisma';
import { validateResumeBuffer } from '../lib/security/file-validator';
import { env } from '../config/env';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper: Ensure storage directories exist
function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================================================
// 1. GET /api/v1/supabase/status - Test Live Supabase Connectivity
// ============================================================================
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
    const { data: tableData, error: tErr } = await supabase.from('user_data').select('*').limit(1);

    const isConnected = !bErr || bErr.message !== 'FetchError';
    const tableExists = !tErr;

    res.json({
      success: true,
      connected: isConnected,
      supabaseUrl: SUPABASE_URL,
      tableExists,
      buckets: buckets ? buckets.map((b) => b.name) : [],
      tableError: tErr ? tErr.message : null,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to query Supabase',
    });
  }
});

// ============================================================================
// 2. POST /api/v1/supabase/submit - Save User Data & Resume to Supabase
// ============================================================================
router.post('/submit', upload.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    const fullName = (req.body.fullName || req.body.name || '').trim();
    const email = (req.body.email || '').trim();
    const phone = (req.body.phone || '').trim();
    const targetRole = (req.body.targetRole || req.body.role || '').trim();
    const skills = (req.body.skills || '').trim();
    const notes = (req.body.notes || '').trim();

    if (!fullName || !email) {
      res.status(400).json({
        success: false,
        error: 'Full Name and Email are required fields.',
      });
      return;
    }

    let resumeFileName = '';
    let resumeUrl = '';
    let resumeSha256 = '';

    // If resume file is uploaded
    if (req.file) {
      const buffer = req.file.buffer;
      const originalName = req.file.originalname;

      // Validate buffer magic bytes
      const validation = validateResumeBuffer(buffer, originalName);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: validation.error || 'Invalid resume file format. Allowed: PDF or DOCX.',
        });
        return;
      }

      resumeFileName = originalName;
      resumeSha256 = validation.sha256Hash;

      // 1. Try uploading to Supabase Storage (bucket "resumes")
      const safePath = `${Date.now()}_${path.basename(originalName)}`;
      try {
        const { data: storageData, error: sErr } = await supabase.storage
          .from('resumes')
          .upload(safePath, buffer, {
            contentType: validation.detectedMimeType || req.file.mimetype,
            upsert: true,
          });

        if (!sErr && storageData) {
          const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(safePath);
          resumeUrl = publicUrlData.publicUrl;
        }
      } catch (storageErr) {
        console.warn('[Supabase Storage] Notice: bucket upload skipped or requires bucket creation:', storageErr);
      }

      // 2. Always persist a local copy safely so file is never lost
      const localDir = path.resolve(env.RESUME_STORAGE_DIR, 'supabase_uploads');
      ensureDirectory(localDir);
      const localFilePath = path.join(localDir, safePath);
      fs.writeFileSync(localFilePath, buffer);
    }

    // 3. Insert user data into Supabase 'user_data' table
    let supabaseRecord = null;
    let supabaseInserted = false;
    let supabaseErrorMsg = null;

    try {
      const { data: insertData, error: insertError } = await supabase
        .from('user_data')
        .insert([
          {
            full_name: fullName,
            email,
            phone,
            target_role: targetRole,
            skills,
            notes,
            resume_file_name: resumeFileName || null,
            resume_url: resumeUrl || null,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (!insertError && insertData && insertData.length > 0) {
        supabaseRecord = insertData[0];
        supabaseInserted = true;
      } else if (insertError) {
        supabaseErrorMsg = insertError.message;
        console.warn('[Supabase Table] Insert warning:', insertError.message);
      }
    } catch (dbErr) {
      supabaseErrorMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    }

    // 4. Also store in local database as guaranteed fallback
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    let localUser;
    if (existingUser) {
      localUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          fullName,
          email,
          phone: phone || existingUser.phone,
          lastLoginAt: new Date(),
        },
      });
    } else {
      localUser = await prisma.user.create({
        data: {
          fullName,
          email,
          phone: phone || null,
          emailVerified: true,
        },
      });
    }

    if (resumeFileName) {
      await prisma.resume.create({
        data: {
          userId: localUser.id,
          fileName: resumeFileName,
          fileSha256Hash: resumeSha256 || 'manual_upload',
          storagePath: resumeUrl || `uploads/resumes/supabase_uploads/${resumeFileName}`,
          parsedSkillGraph: JSON.stringify({ skills: skills.split(',').map((s: string) => s.trim()) }),
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'User data and resume saved successfully!',
      supabaseSaved: supabaseInserted,
      supabaseError: supabaseErrorMsg,
      data: {
        id: supabaseRecord?.id || localUser.id,
        fullName,
        email,
        phone,
        targetRole,
        skills,
        resumeFileName: resumeFileName || null,
        resumeUrl: resumeUrl || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[supabase/submit] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save submission',
    });
  }
});

// ============================================================================
// 3. GET /api/v1/supabase/submissions - Fetch All Stored User Data
// ============================================================================
router.get('/submissions', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Try fetching from Supabase user_data table
    const { data: supaData, error: sErr } = await supabase
      .from('user_data')
      .select('*')
      .order('created_at', { ascending: false });

    if (!sErr && supaData) {
      res.json({
        success: true,
        source: 'supabase',
        submissions: supaData,
      });
      return;
    }

    // Fallback to local DB records if table not created yet in Supabase
    const localUsers = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { resumes: true },
    });

    const fallbackList = localUsers.map((u) => ({
      id: u.id,
      full_name: u.fullName || 'User',
      email: u.email || 'N/A',
      phone: u.phone || 'N/A',
      target_role: 'Candidate',
      skills: 'Technical',
      resume_file_name: u.resumes[0]?.fileName || null,
      resume_url: null,
      created_at: u.createdAt,
    }));

    res.json({
      success: true,
      source: 'local_database',
      supabaseNotice: sErr ? sErr.message : 'Supabase table not queried',
      submissions: fallbackList,
    });
  } catch (error) {
    console.error('[supabase/submissions] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

export default router;

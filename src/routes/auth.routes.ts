import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { OnboardingStep, SecurityEventType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signGuestToken,
  verifyGuestToken,
  hashToken,
} from '../lib/security/jwt';
import { generateOtp, hashOtp, verifyOtpHash } from '../lib/security/otp-crypto';
import { validateResumeBuffer } from '../lib/security/file-validator';
import { encryptForVault, decryptFromVault } from '../lib/security/vault-crypto';
import {
  otpSendRateLimiter,
  otpVerifyRateLimiter,
  guestResumeRateLimiter,
} from '../lib/security/rate-limiter';
import { smsService } from '../services/sms.service';
import { AuditService } from '../services/audit.service';
import { ResumeParserService } from '../services/resume-parser.service';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Zod Validation Schemas
const sendOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number. Must be in E.164 format (e.g. +919876543210)'),
});

const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number. Must be in E.164 format'),
  otp: z
    .string()
    .trim()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  guestToken: z.string().optional(),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  email: z.string().email('Invalid email address'),
  fullName: z.string().optional(),
  guestToken: z.string().optional(),
});

const clerkWebhookSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

// Helper: Ensure storage directories exist
function ensureDirectory(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Helper: Atomic Guest Resume Claim
async function claimGuestResume(
  userId: string,
  rawGuestToken?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<boolean> {
  if (!rawGuestToken) return false;

  try {
    const verifiedGuest = verifyGuestToken(rawGuestToken);
    const guestTokenHash = hashToken(rawGuestToken);

    const guestSession = await prisma.guestResumeSession.findUnique({
      where: { guestTokenHash },
    });

    if (!guestSession || guestSession.claimedByUserId || guestSession.expiresAt < new Date()) {
      return false;
    }

    // Run atomic transfer in transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create permanent Resume record
      await tx.resume.create({
        data: {
          userId,
          fileName: guestSession.fileName,
          fileSha256Hash: guestSession.fileSha256Hash,
          storagePath: guestSession.storagePath,
          parsedSkillGraph: guestSession.extractedSkillPreview,
          isPrimary: true,
        },
      });

      // 2. Mark guest session as claimed
      await tx.guestResumeSession.update({
        where: { id: guestSession.id },
        data: {
          claimedByUserId: userId,
          parseStatus: 'EXTRACTED',
        },
      });

      // 3. Advance user onboardingStep directly to A3_MASTER_PROFILE
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingStep: OnboardingStep.A3_MASTER_PROFILE,
        },
      });

      // 4. Log Audit Event
      await tx.securityAuditLog.create({
        data: {
          userId,
          eventType: SecurityEventType.GUEST_RESUME_CLAIMED,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: JSON.stringify({
            guestSessionId: guestSession.id,
            fileName: guestSession.fileName,
            fileSha256: guestSession.fileSha256Hash,
          }),
        },
      });
    });

    return true;
  } catch (error) {
    console.error('[claimGuestResume] Error claiming guest resume:', error);
    return false;
  }
}

// ============================================================================
// 1. POST /api/v1/auth/guest-resume (Unauthenticated Hook — Step A1/A2)
// ============================================================================
router.post(
  '/guest-resume',
  guestResumeRateLimiter,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      let fileBuffer: Buffer | null = null;
      let fileName = 'resume.pdf';
      let declaredMimeType = 'application/pdf';

      // Support either multipart form upload OR JSON Base64 payload
      if (req.file) {
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname;
        declaredMimeType = req.file.mimetype;
      } else if (req.body && req.body.fileBase64) {
        fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
        fileName = req.body.fileName || 'resume.pdf';
        declaredMimeType = req.body.fileMimeType || 'application/pdf';
      }

      if (!fileBuffer) {
        res.status(400).json({
          success: false,
          error: 'No resume file provided. Send a multipart file or base64 payload.',
        });
        return;
      }

      // Strict validation: Magic bytes inspection & 5MB size limit
      const validation = validateResumeBuffer(fileBuffer, fileName, declaredMimeType);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: validation.error,
        });
        return;
      }

      const guestStorageDir = path.resolve(env.RESUME_STORAGE_DIR, 'guest');
      ensureDirectory(guestStorageDir);

      const safeStorageName = `${validation.sha256Hash.substring(0, 16)}_${Date.now()}_${path.basename(fileName)}`;
      const storagePath = path.join(guestStorageDir, safeStorageName);
      fs.writeFileSync(storagePath, fileBuffer);

      // Extract realistic initial skill preview
      const skillPreview = ResumeParserService.extractInitialPreview(fileBuffer, fileName);

      const guestSessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour TTL

      const guestToken = signGuestToken({
        guestSessionId,
        fileSha256: validation.sha256Hash,
      });

      const guestTokenHash = hashToken(guestToken);
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;
      const userAgent = req.headers['user-agent'] || null;

      const session = await prisma.guestResumeSession.create({
        data: {
          id: guestSessionId,
          guestTokenHash,
          fileName,
          fileMimeType: validation.detectedMimeType!,
          fileSize: validation.sizeBytes,
          fileSha256Hash: validation.sha256Hash,
          storagePath,
          parseStatus: 'STAGED',
          extractedSkillPreview: JSON.stringify(skillPreview),
          expiresAt,
          ipAddress,
        },
      });

      // Audit Log
      await AuditService.log({
        eventType: SecurityEventType.GUEST_RESUME_STAGED,
        ipAddress,
        userAgent,
        metadata: {
          guestSessionId: session.id,
          fileName,
          fileSha256: validation.sha256Hash,
          fileSize: validation.sizeBytes,
        },
      });

      // Set HTTP-only Cookie for SPA / Web client
      res.cookie('sentinel_guest_token', guestToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.setHeader('X-Sentinel-Guest-Token', guestToken);

      res.status(201).json({
        success: true,
        message: 'Resume staged successfully. Complete signup to retain parsed matches.',
        guestToken,
        session: {
          id: session.id,
          fileName: session.fileName,
          fileSha256Hash: session.fileSha256Hash,
          parseStatus: session.parseStatus,
          extractedSkillPreview: skillPreview,
          expiresAt: session.expiresAt,
        },
      });
    } catch (error) {
      console.error('[guest-resume] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to stage guest resume' });
    }
  }
);

// ============================================================================
// 2. POST /api/v1/auth/otp/send (Phone Auth Step 1)
// ============================================================================
router.post(
  '/otp/send',
  otpSendRateLimiter,
  validateBody(sendOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;
      const userAgent = req.headers['user-agent'] || null;

      // 1. Generate CSPRNG 6-digit OTP
      const otp = generateOtp();
      const otpHash = hashOtp(phone, otp);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

      // 2. Store HMAC-SHA256 OTP Hash
      await prisma.otpVerification.create({
        data: {
          phone,
          otpHash,
          attempts: 0,
          expiresAt,
          verified: false,
          ipAddress,
        },
      });

      // 3. Log Audit Event
      await AuditService.log({
        eventType: SecurityEventType.OTP_SENT,
        ipAddress,
        userAgent,
        metadata: { phone },
      });

      // 4. Dispatch SMS via Adapter
      const dispatch = await smsService.sendOtp(phone, otp);

      res.status(200).json({
        success: true,
        message: 'OTP sent successfully. Valid for 5 minutes.',
        phone,
        expiresAt,
        devOtpPreview: env.NODE_ENV !== 'production' ? dispatch.devOtpPreview : undefined,
      });
    } catch (error) {
      console.error('[otp/send] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to dispatch verification code' });
    }
  }
);

// ============================================================================
// 3. POST /api/v1/auth/otp/verify (Phone Auth Step 2 + Atomic Guest Claim)
// ============================================================================
router.post(
  '/otp/verify',
  otpVerifyRateLimiter,
  validateBody(verifyOtpSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone, otp } = req.body;
      const guestToken =
        req.body.guestToken ||
        (req.headers['x-sentinel-guest-token'] as string) ||
        req.cookies?.sentinel_guest_token;

      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;
      const userAgent = req.headers['user-agent'] || null;

      // 1. Find most recent unverified OTP record within validity window
      const record = await prisma.otpVerification.findFirst({
        where: {
          phone,
          verified: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        res.status(400).json({
          success: false,
          error: 'No active OTP verification session found or code expired. Please request a new code.',
        });
        return;
      }

      if (record.attempts >= 5) {
        res.status(429).json({
          success: false,
          error: 'Maximum verification attempts exceeded (5/5). Please request a new OTP.',
        });
        return;
      }

      // 2. Constant-time verification of OTP Hash
      const isValid = verifyOtpHash(phone, otp, record.otpHash);

      if (!isValid) {
        const nextAttempts = record.attempts + 1;
        await prisma.otpVerification.update({
          where: { id: record.id },
          data: { attempts: nextAttempts },
        });

        await AuditService.log({
          eventType: SecurityEventType.OTP_FAILED,
          ipAddress,
          userAgent,
          metadata: { phone, attempts: nextAttempts },
        });

        res.status(401).json({
          success: false,
          error: 'Invalid verification code.',
          remainingAttempts: Math.max(0, 5 - nextAttempts),
        });
        return;
      }

      // 3. Mark OTP as verified
      await prisma.otpVerification.update({
        where: { id: record.id },
        data: { verified: true },
      });

      // 4. Find or Create User
      let isNewUser = false;
      let user = await prisma.user.findUnique({
        where: { phone },
      });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            phone,
            phoneVerified: true,
            onboardingStep: OnboardingStep.A1_AUTH,
            agentMode: 'COPILOT',
            lastLoginAt: new Date(),
          },
        });

        await AuditService.log({
          userId: user.id,
          eventType: SecurityEventType.SIGNUP,
          ipAddress,
          userAgent,
          metadata: { provider: 'PHONE', phone },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            phoneVerified: true,
            lastLoginAt: new Date(),
          },
        });
      }

      await AuditService.log({
        userId: user.id,
        eventType: SecurityEventType.OTP_VERIFIED,
        ipAddress,
        userAgent,
        metadata: { phone },
      });

      // 5. Atomic Guest Resume Handshake
      let resumeClaimed = false;
      if (guestToken) {
        resumeClaimed = await claimGuestResume(user.id, guestToken, ipAddress, userAgent);
      }

      // If user had no resume staged, and was on A1_AUTH, advance to A2_RESUME
      if (!resumeClaimed && user.onboardingStep === OnboardingStep.A1_AUTH) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { onboardingStep: OnboardingStep.A2_RESUME },
        });
      } else if (resumeClaimed) {
        user = (await prisma.user.findUnique({ where: { id: user.id } }))!;
      }

      // 6. Generate Session & Refresh Token Rotation
      const sessionId = crypto.randomUUID();
      const accessToken = signAccessToken({
        sub: user.id,
        phone: user.phone,
        email: user.email,
      });

      const refreshToken = signRefreshToken({
        sub: user.id,
        sessionId,
      });

      const tokenHash = hashToken(refreshToken);
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.refreshTokenSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          tokenHash,
          deviceInfo: userAgent || 'Unknown Device',
          ipAddress,
          expiresAt: refreshExpiresAt,
        },
      });

      // Set Cookies
      res.cookie('sentinel_access_token', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('sentinel_refresh_token', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      // Clear guest token cookie
      res.clearCookie('sentinel_guest_token');

      res.status(200).json({
        success: true,
        message: isNewUser ? 'User registered and authenticated successfully.' : 'Welcome back!',
        isNewUser,
        resumeClaimed,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          fullName: user.fullName,
          phoneVerified: user.phoneVerified,
          onboardingStep: user.onboardingStep,
          agentMode: user.agentMode,
          killSwitchActive: user.killSwitchActive,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('[otp/verify] Error:', error);
      res.status(500).json({ success: false, error: 'Verification failed' });
    }
  }
);

// ============================================================================
// 4. POST /api/v1/auth/oauth/google (Google OAuth Step A1)
// ============================================================================
router.post(
  '/oauth/google',
  validateBody(googleAuthSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, fullName, guestToken } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;
      const userAgent = req.headers['user-agent'] || null;

      let isNewUser = false;
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            email,
            emailVerified: true,
            fullName: fullName || null,
            onboardingStep: OnboardingStep.A1_AUTH,
            agentMode: 'COPILOT',
            lastLoginAt: new Date(),
          },
        });

        await AuditService.log({
          userId: user.id,
          eventType: SecurityEventType.SIGNUP,
          ipAddress,
          userAgent,
          metadata: { provider: 'GOOGLE', email },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            lastLoginAt: new Date(),
            fullName: fullName || user.fullName,
          },
        });
      }

      await AuditService.log({
        userId: user.id,
        eventType: SecurityEventType.LOGIN_GOOGLE,
        ipAddress,
        userAgent,
        metadata: { email },
      });

      // Atomic Guest Resume Handshake
      let resumeClaimed = false;
      const candidateGuestToken =
        guestToken ||
        (req.headers['x-sentinel-guest-token'] as string) ||
        req.cookies?.sentinel_guest_token;

      if (candidateGuestToken) {
        resumeClaimed = await claimGuestResume(user.id, candidateGuestToken, ipAddress, userAgent);
      }

      if (!resumeClaimed && user.onboardingStep === OnboardingStep.A1_AUTH) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { onboardingStep: OnboardingStep.A2_RESUME },
        });
      } else if (resumeClaimed) {
        user = (await prisma.user.findUnique({ where: { id: user.id } }))!;
      }

      // Generate Session
      const sessionId = crypto.randomUUID();
      const accessToken = signAccessToken({
        sub: user.id,
        email: user.email,
        phone: user.phone,
      });

      const refreshToken = signRefreshToken({
        sub: user.id,
        sessionId,
      });

      await prisma.refreshTokenSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          deviceInfo: userAgent || 'Google OAuth Session',
          ipAddress,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.cookie('sentinel_access_token', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('sentinel_refresh_token', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.clearCookie('sentinel_guest_token');

      res.status(200).json({
        success: true,
        message: 'Google authentication successful',
        isNewUser,
        resumeClaimed,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          emailVerified: user.emailVerified,
          onboardingStep: user.onboardingStep,
          agentMode: user.agentMode,
          killSwitchActive: user.killSwitchActive,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error('[oauth/google] Error:', error);
      res.status(500).json({ success: false, error: 'Google OAuth failed' });
    }
  }
);

// ============================================================================
// 5. POST /api/v1/auth/clerk/webhook (Clerk Session Sync)
// ============================================================================
router.post(
  '/clerk/webhook',
  validateBody(clerkWebhookSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, data } = req.body;
      const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;

      if (type === 'user.created' || type === 'user.updated') {
        const clerkId = data.id as string;
        const emailAddresses = (data.email_addresses as Array<{ email_address: string }>) || [];
        const phoneNumbers = (data.phone_numbers as Array<{ phone_number: string }>) || [];
        const firstName = (data.first_name as string) || '';
        const lastName = (data.last_name as string) || '';
        const fullName = `${firstName} ${lastName}`.trim() || null;

        const email = emailAddresses[0]?.email_address || null;
        const phone = phoneNumbers[0]?.phone_number || null;

        await prisma.user.upsert({
          where: { clerkId },
          update: {
            email: email || undefined,
            phone: phone || undefined,
            fullName: fullName || undefined,
            lastLoginAt: new Date(),
          },
          create: {
            clerkId,
            email,
            phone,
            fullName,
            emailVerified: !!email,
            phoneVerified: !!phone,
            onboardingStep: OnboardingStep.A1_AUTH,
            agentMode: 'COPILOT',
            lastLoginAt: new Date(),
          },
        });

        await AuditService.log({
          eventType: SecurityEventType.SIGNUP,
          ipAddress,
          metadata: { provider: 'CLERK_WEBHOOK', clerkId, type },
        });
      }

      res.status(200).json({ success: true, received: true });
    } catch (error) {
      console.error('[clerk/webhook] Error:', error);
      res.status(500).json({ success: false, error: 'Clerk webhook processing failed' });
    }
  }
);

// ============================================================================
// 6. POST /api/v1/auth/resume/skip (Protected — Step A2 Skip Option)
// ============================================================================
router.post('/resume/skip', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Allow user to advance to A3_MASTER_PROFILE while noting resume is pending
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingStep: OnboardingStep.A3_MASTER_PROFILE,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Resume upload step skipped. You can upload a tailored resume anytime in /resume.',
      onboardingStep: updatedUser.onboardingStep,
      resumePending: true,
    });
  } catch (error) {
    console.error('[resume/skip] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to skip resume upload' });
  }
});

// ============================================================================
// 7. GET /api/v1/auth/me (Protected Session Hydrator)
// ============================================================================
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        resumes: {
          where: { isPrimary: true },
          select: {
            id: true,
            fileName: true,
            fileSha256Hash: true,
            parsedSkillGraph: true,
            isPrimary: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            auditLogs: true,
            refreshTokens: { where: { isRevoked: false, expiresAt: { gt: new Date() } } },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const primaryResume = user.resumes[0] || null;

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        clerkId: user.clerkId,
        email: user.email,
        phone: user.phone,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        fullName: user.fullName,
        onboardingStep: user.onboardingStep,
        agentMode: user.agentMode,
        autoApplyThreshold: user.autoApplyThreshold,
        dailyApplicationCap: user.dailyApplicationCap,
        killSwitchActive: user.killSwitchActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      },
      resume: primaryResume
        ? {
            id: primaryResume.id,
            fileName: primaryResume.fileName,
            fileSha256Hash: primaryResume.fileSha256Hash,
            parsedSkillGraph: primaryResume.parsedSkillGraph
              ? JSON.parse(primaryResume.parsedSkillGraph)
              : null,
            isPrimary: primaryResume.isPrimary,
            createdAt: primaryResume.createdAt,
          }
        : null,
      security: {
        activeSessionsCount: user._count.refreshTokens,
        totalAuditEventsLogged: user._count.auditLogs,
      },
    });
  } catch (error) {
    console.error('[auth/me] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to hydrate session' });
  }
});

// ============================================================================
// 8. POST /api/v1/auth/refresh (Rotating Refresh Token)
// ============================================================================
router.post(
  '/refresh',
  validateBody(refreshSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const incomingRefreshToken =
        req.body.refreshToken || req.cookies?.sentinel_refresh_token;

      if (!incomingRefreshToken) {
        res.status(401).json({
          success: false,
          error: 'Refresh token is missing.',
        });
        return;
      }

      // Verify token signature & expiry
      let payload;
      try {
        payload = verifyRefreshToken(incomingRefreshToken);
      } catch {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired refresh token. Please log in again.',
        });
        return;
      }

      const tokenHash = hashToken(incomingRefreshToken);

      // Check database session
      const session = await prisma.refreshTokenSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        res.status(401).json({
          success: false,
          error: 'Refresh token has been revoked or expired.',
        });
        return;
      }

      // Rotate Refresh Token: Revoke old session, issue new one
      const newSessionId = crypto.randomUUID();
      const newRefreshToken = signRefreshToken({
        sub: session.userId,
        sessionId: newSessionId,
      });

      const newAccessToken = signAccessToken({
        sub: session.userId,
        email: session.user.email,
        phone: session.user.phone,
      });

      const newTokenHash = hashToken(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.$transaction([
        prisma.refreshTokenSession.update({
          where: { id: session.id },
          data: { isRevoked: true },
        }),
        prisma.refreshTokenSession.create({
          data: {
            id: newSessionId,
            userId: session.userId,
            tokenHash: newTokenHash,
            deviceInfo: req.headers['user-agent'] || session.deviceInfo,
            ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
            expiresAt: newExpiresAt,
          },
        }),
      ]);

      res.cookie('sentinel_access_token', newAccessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });

      res.cookie('sentinel_refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      res.status(200).json({
        success: true,
        message: 'Tokens rotated successfully.',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      console.error('[auth/refresh] Error:', error);
      res.status(500).json({ success: false, error: 'Token refresh failed' });
    }
  }
);

// ============================================================================
// 9. POST /api/v1/auth/logout (Revoke Session)
// ============================================================================
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.sentinel_refresh_token;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshTokenSession.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    res.clearCookie('sentinel_access_token');
    res.clearCookie('sentinel_refresh_token');
    res.clearCookie('sentinel_guest_token');

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('[auth/logout] Error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// ============================================================================
// 10. PATCH /api/v1/auth/settings (Update Agent Controls & Safety Thresholds)
// ============================================================================
const updateSettingsSchema = z.object({
  agentMode: z.enum(['COPILOT', 'AUTOPILOT']).optional(),
  autoApplyThreshold: z.number().int().min(50).max(100).optional(),
  dailyApplicationCap: z.number().int().min(1).max(50).optional(),
  killSwitchActive: z.boolean().optional(),
});

router.patch(
  '/settings',
  requireAuth,
  validateBody(updateSettingsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user!;
      const { agentMode, autoApplyThreshold, dailyApplicationCap, killSwitchActive } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          agentMode: agentMode || undefined,
          autoApplyThreshold: autoApplyThreshold !== undefined ? autoApplyThreshold : undefined,
          dailyApplicationCap: dailyApplicationCap !== undefined ? dailyApplicationCap : undefined,
          killSwitchActive: killSwitchActive !== undefined ? killSwitchActive : undefined,
        },
      });

      if (killSwitchActive !== undefined && killSwitchActive !== user.killSwitchActive) {
        await AuditService.log({
          userId: user.id,
          eventType: SecurityEventType.KILL_SWITCH_TOGGLED,
          ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
          userAgent: req.headers['user-agent'] || null,
          metadata: { killSwitchActive },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Settings updated successfully.',
        settings: {
          agentMode: updatedUser.agentMode,
          autoApplyThreshold: updatedUser.autoApplyThreshold,
          dailyApplicationCap: updatedUser.dailyApplicationCap,
          killSwitchActive: updatedUser.killSwitchActive,
        },
      });
    } catch (error) {
      console.error('[auth/settings] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  }
);

// ============================================================================
// 11. GET /api/v1/auth/audit-logs (User's Recent Security Audit Logs)
// ============================================================================
router.get('/audit-logs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const logs = await prisma.securityAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.status(200).json({
      success: true,
      logs: logs.map((log) => ({
        id: log.id,
        eventType: log.eventType,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error('[auth/audit-logs] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// ============================================================================
// 12. POST /api/v1/auth/vault/test (Interactive AES-256-GCM Vault Sandbox)
// ============================================================================
const vaultTestSchema = z.object({
  secretPayload: z.string().min(1, 'Secret payload cannot be empty'),
});

router.post(
  '/vault/test',
  requireAuth,
  validateBody(vaultTestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { secretPayload } = req.body;
      const encrypted = encryptForVault(secretPayload);
      const decrypted = decryptFromVault(encrypted);

      res.status(200).json({
        success: true,
        algorithm: 'AES-256-GCM',
        encrypted: {
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          payloadHex: encrypted.encryptedPayload.substring(0, 32) + '...',
          fullPayloadHex: encrypted.encryptedPayload,
        },
        decryptedMatch: decrypted === secretPayload,
      });
    } catch (error) {
      console.error('[vault/test] Error:', error);
      res.status(500).json({ success: false, error: 'Vault encryption test failed' });
    }
  }
);

export default router;

import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
  lastRequestTime?: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  cooldownMs?: number; // Optional minimum gap between requests (e.g. 30s resend cooldown)
  keyGenerator?: (req: Request) => string;
}

export function createSlidingWindowRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();
  const {
    windowMs,
    maxRequests,
    cooldownMs = 0,
    message = 'Too many requests. Please try again later.',
    keyGenerator = (req: Request) =>
      req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous',
  } = options;

  // Periodic cleanup to avoid memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, Math.max(windowMs / 2, 60000)).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // Filter out timestamps outside current sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    // Cooldown check (e.g. 30-second SMS resend cooldown)
    if (cooldownMs > 0 && record.lastRequestTime) {
      const elapsed = now - record.lastRequestTime;
      if (elapsed < cooldownMs) {
        const retryAfterSeconds = Math.ceil((cooldownMs - elapsed) / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        res.status(429).json({
          success: false,
          error: `Please wait ${retryAfterSeconds}s before requesting a new OTP.`,
          retryAfterSeconds,
        });
        return;
      }
    }

    // Rate limit check
    if (record.timestamps.length >= maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const retryAfterSeconds = Math.ceil((windowMs - (now - oldestInWindow)) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.status(429).json({
        success: false,
        error: message,
        retryAfterSeconds,
      });
      return;
    }

    // Record this hit
    record.timestamps.push(now);
    record.lastRequestTime = now;

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.timestamps.length);

    next();
  };
}

// Strict rate limiters for SentinelApply endpoints:

// 1. OTP Send: Max 3 sends per 10 minutes per phone/IP, 30s resend cooldown
export const otpSendRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 3,
  cooldownMs: 30 * 1000,
  message: 'OTP request limit exceeded (max 3 per 10 minutes). Please wait before trying again.',
  keyGenerator: (req: Request) => {
    const phone = req.body?.phone ? String(req.body.phone).trim() : '';
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '';
    return phone ? `otp-send:${phone}` : `otp-send:ip:${ip}`;
  },
});

// 2. OTP Verify: Max 5 verification attempts per 10 minutes per phone/IP
export const otpVerifyRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many failed verification attempts. Please request a new OTP.',
  keyGenerator: (req: Request) => {
    const phone = req.body?.phone ? String(req.body.phone).trim() : '';
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '';
    return phone ? `otp-verify:${phone}` : `otp-verify:ip:${ip}`;
  },
});

// 3. Guest Resume Staging: Max 10 uploads per hour per IP
export const guestResumeRateLimiter = createSlidingWindowRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Resume upload limit exceeded. Please wait before staging more resumes.',
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || 'anonymous';
    return `guest-resume:${ip}`;
  },
});

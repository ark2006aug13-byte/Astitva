import crypto from 'crypto';
import { env } from '../../config/env';

/**
 * Generates a cryptographically secure 6-digit OTP.
 * Uses CSPRNG via crypto.randomInt(100000, 1000000) ensuring unbiased distribution
 * in the range [100000, 999999].
 */
export function generateOtp(): string {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return otpNumber.toString();
}

/**
 * Computes an HMAC-SHA256 hash of the OTP bound to the user's phone number.
 * Storing hashes in this manner prevents plain-text exposure and rainbow table pre-computation.
 */
export function hashOtp(phone: string, otp: string): string {
  const hmac = crypto.createHmac('sha256', env.OTP_HMAC_SECRET);
  hmac.update(`${phone.trim()}:${otp.trim()}`);
  return hmac.digest('hex');
}

/**
 * Performs a constant-time comparison of the provided candidate OTP against the stored hash.
 * Prevents timing attacks by ensuring comparison duration is independent of matched byte positions.
 */
export function verifyOtpHash(phone: string, candidateOtp: string, storedHash: string): boolean {
  if (!candidateOtp || candidateOtp.length !== 6 || !storedHash) {
    return false;
  }

  const candidateHash = hashOtp(phone, candidateOtp);

  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
}

import crypto from 'crypto';
import { env } from '../../config/env';

export interface BaseJwtClaims {
  sub?: string;
  iat: number;
  exp: number;
  jti?: string;
}

export interface AccessTokenPayload extends BaseJwtClaims {
  sub: string;
  phone?: string | null;
  email?: string | null;
  type: 'access';
}

export interface RefreshTokenPayload extends BaseJwtClaims {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export interface GuestSessionPayload extends BaseJwtClaims {
  guestSessionId: string;
  fileSha256: string;
  type: 'guest';
}

function base64UrlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function createSignature(headerB64: string, payloadB64: string, secret: string): string {
  const data = `${headerB64}.${payloadB64}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return base64UrlEncode(hmac.digest());
}

function signToken<T extends Record<string, unknown>>(
  payload: T,
  secret: string,
  expiresInSeconds: number
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomUUID(),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureB64 = createSignature(headerB64, payloadB64, secret);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verifyToken<T extends BaseJwtClaims>(token: string, secret: string): T {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or invalid');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token structure');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Recreate signature
  const expectedSigB64 = createSignature(headerB64, payloadB64, secret);

  const sigBuf = Buffer.from(signatureB64, 'utf-8');
  const expectedBuf = Buffer.from(expectedSigB64, 'utf-8');

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid JWT signature');
  }

  const decodedPayload = JSON.parse(base64UrlDecode(payloadB64)) as T;
  const now = Math.floor(Date.now() / 1000);

  if (decodedPayload.exp && decodedPayload.exp < now) {
    throw new Error('JWT token has expired');
  }

  return decodedPayload;
}

// Access Token: 15 minutes (900 seconds)
export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'jti' | 'type'>): string {
  return signToken({ ...payload, type: 'access' as const }, env.JWT_ACCESS_SECRET, 15 * 60);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const verified = verifyToken<AccessTokenPayload>(token, env.JWT_ACCESS_SECRET);
  if (verified.type !== 'access') {
    throw new Error('Invalid token type: expected access token');
  }
  return verified;
}

// Rotating Refresh Token: 7 days (604800 seconds)
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'jti' | 'type'>): string {
  return signToken({ ...payload, type: 'refresh' as const }, env.JWT_REFRESH_SECRET, 7 * 24 * 60 * 60);
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const verified = verifyToken<RefreshTokenPayload>(token, env.JWT_REFRESH_SECRET);
  if (verified.type !== 'refresh') {
    throw new Error('Invalid token type: expected refresh token');
  }
  return verified;
}

// Guest Session Token: 24 hours (86400 seconds)
export function signGuestToken(payload: Omit<GuestSessionPayload, 'iat' | 'exp' | 'jti' | 'type'>): string {
  return signToken({ ...payload, type: 'guest' as const }, env.GUEST_SESSION_SECRET, 24 * 60 * 60);
}

export function verifyGuestToken(token: string): GuestSessionPayload {
  const verified = verifyToken<GuestSessionPayload>(token, env.GUEST_SESSION_SECRET);
  if (verified.type !== 'guest') {
    throw new Error('Invalid token type: expected guest token');
  }
  return verified;
}

// SHA-256 hash for database token lookup (refresh token & guest token hashes)
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/security/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      guestToken?: string;
    }
  }
}

/**
 * Extracts bearer access token from Authorization header or HTTP-only cookie.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  if (req.cookies && req.cookies.sentinel_access_token) {
    return req.cookies.sentinel_access_token;
  }
  return null;
}

/**
 * Middleware requiring a valid authenticated session.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Missing access token.',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found or session has been invalidated.',
      });
      return;
    }

    req.user = user;
    req.userId = user.id;

    next();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid or expired access token.';
    res.status(401).json({
      success: false,
      error: `Authentication failed: ${message}`,
    });
  }
}

/**
 * Optional authentication middleware for endpoints that can enrich data for logged-in users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (user) {
      req.user = user;
      req.userId = user.id;
    }
  } catch {
    // Silently continue for optional auth
  }

  next();
}

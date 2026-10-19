import { SecurityEventType } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface AuditLogParams {
  userId?: string | null;
  eventType: SecurityEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export class AuditService {
  /**
   * Logs security events asynchronously.
   * Does not throw to avoid crashing primary transaction flows if audit logging encounters an issue.
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      await prisma.securityAuditLog.create({
        data: {
          userId: params.userId || null,
          eventType: params.eventType,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        },
      });
    } catch (error) {
      console.error('[AuditService] Failed to write security audit log:', error);
    }
  }

  /**
   * Synchronous log returning the created log record.
   */
  static async logSync(params: AuditLogParams) {
    return prisma.securityAuditLog.create({
      data: {
        userId: params.userId || null,
        eventType: params.eventType,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
  }
}

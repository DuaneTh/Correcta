import { prisma } from '@/lib/prisma'

export type AuditAction =
    | 'USER_CREATE'
    | 'USER_UPDATE'
    | 'USER_ARCHIVE'
    | 'PASSWORD_CHANGE'
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAIL'
    | 'GRADE_UPDATE'
    | 'GRADE_HARMONIZE'
    | 'EXAM_PUBLISH'
    | 'EXAM_UNPUBLISH'
    | 'EXAM_CREATE'
    | 'EXAM_DELETE'
    | 'EXPORT_CSV'
    | 'EXPORT_PDF'
    | 'SETTING_UPDATE'
    | 'ENROLLMENT_CREATE'
    | 'ENROLLMENT_DELETE'
    | 'COURSE_CREATE'
    | 'COURSE_UPDATE'
    | 'INSTITUTION_CREATE'
    | 'INSTITUTION_UPDATE'

type AuditParams = {
    action: AuditAction
    actorId?: string | null
    institutionId?: string | null
    targetType?: string
    targetId?: string
    metadata?: Record<string, unknown>
    ipAddress?: string | null
}

/**
 * Log an audit event. Fire-and-forget — errors are caught and logged
 * to avoid disrupting the main request flow.
 */
export function logAudit(params: AuditParams): void {
    prisma.auditLog.create({
        data: {
            action: params.action,
            actorId: params.actorId ?? null,
            institutionId: params.institutionId ?? null,
            targetType: params.targetType ?? null,
            targetId: params.targetId ?? null,
            metadata: params.metadata ? (params.metadata as Record<string, string | number | boolean | null>) : undefined,
            ipAddress: params.ipAddress ?? null,
        }
    }).catch(err => {
        console.error('[Audit] Failed to write audit log:', err)
    })
}

/** Extract client IP from request headers. */
export function getClientIp(req: Request): string | null {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? req.headers.get('x-real-ip')
        ?? null
}

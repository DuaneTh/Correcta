import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { exportQueue } from '@/lib/queue'
import { verifyCsrf, getCsrfCookieName, getAllowedOrigins } from '@/lib/csrf'
import { logAudit, getClientIp } from '@/lib/audit'

// POST /api/exams/[examId]/export/pdf - Start PDF export job
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // Auth check
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: 'CSRF' }, { status: 403 })
        }

        // Verify access to exam
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: { select: { institutionId: true } }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Check queue availability
        if (!exportQueue) {
            return NextResponse.json({ error: 'Export service unavailable' }, { status: 503 })
        }

        // Parse optional class filter
        const body = await req.json().catch(() => ({}))
        const classIds = body.classIds as string[] | undefined

        // Queue export job
        const job = await exportQueue.add('pdf-export', {
            examId,
            classIds,
            type: 'pdf',
            requestedBy: session.user.id
        })

        logAudit({
            action: 'EXPORT_PDF',
            actorId: session.user.id,
            institutionId: session.user.institutionId,
            targetType: 'EXAM',
            targetId: examId,
            metadata: classIds ? { classIds: classIds.length } : undefined,
            ipAddress: getClientIp(req),
        })

        return NextResponse.json({
            jobId: job.id,
            status: 'queued'
        })

    } catch (error) {
        console.error('[API] PDF Export Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

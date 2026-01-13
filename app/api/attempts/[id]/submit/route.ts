import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { getExamEndAt } from "@/lib/exam-time"
import { canAccessAttemptAction } from "@/lib/attemptPermissions"
import { getAttemptAuthContext } from "@/lib/attempt-access"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"
import { ensureIdempotency, verifyAttemptNonce } from "@/lib/attemptIntegrity"

// POST /api/attempts/[id]/submit - Submit exam attempt
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isStudent(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        const attemptAuth = await getAttemptAuthContext(id)
        if (!attemptAuth) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        const isAllowed = canAccessAttemptAction('submitAttempt', {
            sessionUser: {
                id: session.user.id,
                role: session.user.role,
                institutionId: session.user.institutionId
            },
            attemptStudentId: attemptAuth.studentId,
            attemptInstitutionId: attemptAuth.institutionId,
            teacherCanAccess: false
        })

        if (!isAllowed) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        const requestId = req.headers.get('x-request-id')
        if (!requestId || requestId.length < 8 || requestId.length > 128) {
            return NextResponse.json({ error: "INTEGRITY" }, { status: 403 })
        }

        const nonceResult = await verifyAttemptNonce(id, req.headers.get('x-attempt-nonce'))
        if (!nonceResult.ok) {
            return NextResponse.json({ error: "INTEGRITY" }, { status: 403 })
        }
        const idempotency = await ensureIdempotency(id, requestId, 'submit')
        if (!idempotency.first) {
            return NextResponse.json({ success: true, replay: true })
        }

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                exam: true
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // Students should not access attempts for DRAFT exams or exams without valid duration/start date
        const hasValidDuration = attempt.exam.durationMinutes !== null && attempt.exam.durationMinutes > 0
        const hasValidStartDate = attempt.exam.startAt !== null && attempt.exam.startAt > new Date('2000-01-01')
        if (attempt.exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        if (attempt.status !== 'IN_PROGRESS') {
            return NextResponse.json({ error: "Attempt already submitted" }, { status: 400 })
        }

        // Check time window with 60-second grace period for submit
        // This allows auto-submit to succeed even if there's a small network delay
        const now = new Date()
        const gracePeriodSeconds = 60

        if (attempt.exam.startAt && now < attempt.exam.startAt) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 })
        }

        const examEndAt = getExamEndAt(attempt.exam.startAt, attempt.exam.durationMinutes, attempt.exam.endAt)
        if (examEndAt) {
            const endAtWithGrace = new Date(examEndAt.getTime() + gracePeriodSeconds * 1000)
            if (now > endAtWithGrace) {
                return NextResponse.json({ error: "Exam has ended, submission not allowed" }, { status: 400 })
            }
        }

        // Update attempt status
        const updatedAttempt = await prisma.attempt.update({
            where: { id },
            data: {
                status: 'SUBMITTED',
                submittedAt: new Date()
            }
        })

        // TODO: Trigger grading task creation (async processing)

        return NextResponse.json({ success: true, attempt: updatedAttempt })

    } catch (error) {
        console.error("[API] Submit Attempt Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

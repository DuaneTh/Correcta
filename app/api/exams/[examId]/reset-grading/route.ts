import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"

/**
 * POST /api/exams/[examId]/reset-grading
 *
 * Reset stuck attempts from GRADING_IN_PROGRESS back to SUBMITTED.
 * Useful when queue/worker fails and attempts get stuck.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // 1. Auth check
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: getCsrfCookieToken(req),
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // 3. Verify teacher has access to exam
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // 4. Reset all GRADING_IN_PROGRESS attempts back to SUBMITTED
        const result = await prisma.attempt.updateMany({
            where: {
                examId,
                status: 'GRADING_IN_PROGRESS'
            },
            data: {
                status: 'SUBMITTED'
            }
        })

        return NextResponse.json({
            success: true,
            resetCount: result.count,
            message: `${result.count} copie(s) reinitialise(s)`
        })

    } catch (error) {
        console.error("[API] Reset Grading Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

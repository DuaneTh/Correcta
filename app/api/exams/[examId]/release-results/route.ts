import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"

// POST /api/exams/[examId]/release-results - Release exam results to students
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const csrfResult = verifyCsrf({
            req,
            cookieToken: getCsrfCookieToken(req),
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // Fetch exam with attempts to check grading completion
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                },
                attempts: {
                    select: { id: true, status: true }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Verify teacher has access to this exam
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if all attempts are GRADED
        const hasUngradedAttempts = exam.attempts.some(attempt => attempt.status !== 'GRADED')

        if (hasUngradedAttempts) {
            return NextResponse.json({
                error: "EXAM_NOT_FULLY_GRADED",
                message: "Toutes les copies ne sont pas encore corrigées."
            }, { status: 400 })
        }

        // Merge gradesReleased flag into existing gradingConfig
        const existingConfig = (exam.gradingConfig as Record<string, unknown>) || {}
        const updatedConfig = {
            ...existingConfig,
            gradesReleased: true,
            gradesReleasedAt: new Date().toISOString()
        }

        // Update exam with new gradingConfig
        const updatedExam = await prisma.exam.update({
            where: { id: examId },
            data: {
                gradingConfig: updatedConfig
            }
        })

        return NextResponse.json({
            success: true,
            gradingConfig: updatedExam.gradingConfig
        })

    } catch (error) {
        console.error("[API] Release Results Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

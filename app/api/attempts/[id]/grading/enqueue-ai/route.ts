import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { aiGradingQueue } from "@/lib/queue"
import { canAccessAttemptAction } from "@/lib/attemptPermissions"
import { getAttemptAuthContext, getTeacherAccessForAttempt } from "@/lib/attempt-access"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"

// POST /api/attempts/[id]/grading/enqueue-ai
// Enqueue AI grading jobs for all answers in an attempt
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        // 1. Auth check
        if (!session || !session.user || !isTeacher(session)) {
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

        const teacherCanAccess = await getTeacherAccessForAttempt(attemptAuth.examId, {
            id: session.user.id,
            role: session.user.role,
            institutionId: session.user.institutionId
        })

        const isAllowed = canAccessAttemptAction('enqueueGrading', {
            sessionUser: {
                id: session.user.id,
                role: session.user.role,
                institutionId: session.user.institutionId
            },
            attemptStudentId: attemptAuth.studentId,
            attemptInstitutionId: attemptAuth.institutionId,
            teacherCanAccess
        })

        if (!isAllowed) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // 2. Queue availability check
        if (!aiGradingQueue) {
            return NextResponse.json({
                error: "QUEUE_NOT_AVAILABLE",
                message: "AI grading queue is not available."
            }, { status: 500 })
        }

        // 3. Fetch attempt with answers (including existing grades)
        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                answers: {
                    select: {
                        id: true,
                        questionId: true,
                        grades: {
                            select: {
                                gradedByUserId: true,
                                isOverridden: true
                            }
                        }
                    }
                },
                exam: {
                    include: {
                        course: {
                            select: { institutionId: true }
                        }
                    }
                }
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // 5. Filter answers: only enqueue those WITHOUT human grades
        const answersToGrade = attempt.answers.filter(answer => {
            // Skip if grade exists and is human (gradedByUserId not null OR isOverridden)
            const hasHumanGrade = answer.grades.length > 0 &&
                (answer.grades[0].gradedByUserId !== null || answer.grades[0].isOverridden)
            return !hasHumanGrade
        })

        // 6. Enqueue jobs for filtered answers
        const jobs = answersToGrade.map(answer => ({
            name: 'grade-answer',
            data: {
                attemptId: attempt.id,
                answerId: answer.id,
                questionId: answer.questionId
            }
        }))

        // Add jobs in bulk if possible, or loop
        // BullMQ addBulk is efficient
        if (jobs.length > 0) {
            await aiGradingQueue.addBulk(jobs)
        }

        return NextResponse.json({
            success: true,
            total: attempt.answers.length,
            enqueued: jobs.length,
            skipped: attempt.answers.length - jobs.length
        })

    } catch (error) {
        console.error("[API] Enqueue AI Grading Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

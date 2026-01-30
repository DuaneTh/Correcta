import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { aiGradingQueue } from "@/lib/queue"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"

// GET /api/exams/[examId]/grading-progress - Get batch grading progress
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // Auth check: Teacher only
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify teacher has access to exam
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

        // Count attempts (copies) and their grading status
        const attempts = await prisma.attempt.findMany({
            where: {
                examId,
                status: { in: ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'] }
            },
            select: {
                id: true,
                status: true
            }
        })

        // Count copies by status
        const totalCopies = attempts.length
        const gradedCopies = attempts.filter(a => a.status === 'GRADED').length
        const inProgressCopies = attempts.filter(a => a.status === 'GRADING_IN_PROGRESS').length

        // Determine overall status
        let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

        if (totalCopies === 0) {
            status = 'COMPLETED' // No copies to grade
        } else if (gradedCopies === totalCopies) {
            status = 'COMPLETED'
        } else if (inProgressCopies > 0 || gradedCopies > 0) {
            status = 'IN_PROGRESS'
        } else {
            status = 'NOT_STARTED'
        }

        const percentage = totalCopies > 0
            ? Math.round((gradedCopies / totalCopies) * 100)
            : 100

        return NextResponse.json({
            completed: gradedCopies,
            total: totalCopies,
            percentage,
            status,
            canCancel: status === 'IN_PROGRESS'
        })

    } catch (error) {
        console.error("[API] Grading Progress Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// DELETE /api/exams/[examId]/grading-progress - Cancel remaining grading jobs
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // Auth check: Teacher only
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // Verify teacher has access to exam
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

        // Count already graded answers (TEXT questions only)
        const gradedCount = await prisma.grade.count({
            where: {
                answer: {
                    attempt: { examId },
                    question: { type: 'TEXT' }
                }
            }
        })

        // Drain remaining jobs from queue for this exam
        // BullMQ doesn't have a direct "drain by filter" so we need to get waiting jobs
        // and remove those matching our exam's attempts
        if (aiGradingQueue) {
            try {
                // Get attempt IDs for this exam
                const attemptIds = await prisma.attempt.findMany({
                    where: { examId },
                    select: { id: true }
                }).then(attempts => attempts.map(a => a.id))

                // Get waiting and delayed jobs
                const waitingJobs = await aiGradingQueue.getJobs(['waiting', 'delayed'])

                // Remove jobs that belong to this exam's attempts
                let removedCount = 0
                for (const job of waitingJobs) {
                    if (job.data?.attemptId && attemptIds.includes(job.data.attemptId)) {
                        await job.remove()
                        removedCount++
                    }
                }

                console.log(`[Grade All Cancel] Removed ${removedCount} jobs for exam ${examId}`)
            } catch (queueError) {
                console.error('[Grade All Cancel] Queue error:', queueError)
                // Continue even if queue drain fails
            }
        }

        // Update attempt statuses back to SUBMITTED if they were GRADING_IN_PROGRESS
        // but only if they have no grades yet
        const attemptsToReset = await prisma.attempt.findMany({
            where: {
                examId,
                status: 'GRADING_IN_PROGRESS'
            },
            include: {
                answers: {
                    include: {
                        grades: { select: { id: true } }
                    }
                }
            }
        })

        for (const attempt of attemptsToReset) {
            const hasAnyGrades = attempt.answers.some(a => a.grades.length > 0)
            if (!hasAnyGrades) {
                await prisma.attempt.update({
                    where: { id: attempt.id },
                    data: { status: 'SUBMITTED' }
                })
            }
        }

        return NextResponse.json({
            cancelled: true,
            alreadyGraded: gradedCount
        })

    } catch (error) {
        console.error("[API] Cancel Grading Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

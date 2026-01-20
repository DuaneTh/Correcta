import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getCorrectionReleaseInfo } from "@/lib/correction-release"
import { canAccessAttemptAction } from "@/lib/attemptPermissions"
import { getAttemptAuthContext, getTeacherAccessForAttempt } from "@/lib/attempt-access"

// GET /api/attempts/[id]/results - Get graded results for student
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

        const isAllowed = canAccessAttemptAction('viewResults', {
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

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                student: {
                    select: { id: true, name: true }
                },
                exam: {
                    include: {
                        sections: {
                            include: {
                                questions: {
                                    include: {
                                        segments: true
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    }
                },
                answers: {
                    include: {
                        segments: true,
                        grades: true
                    }
                }
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // Authorization check: Student must own attempt, or be a teacher
        const isOwner = attempt.studentId === session.user.id
        const isTeacherUser = isTeacher(session)

        // Students should not access attempts for DRAFT exams or exams without valid duration/start date
        if (isOwner && !isTeacherUser) {
            const hasValidDuration = attempt.exam.durationMinutes !== null && attempt.exam.durationMinutes > 0
            const hasValidStartDate = attempt.exam.startAt !== null && attempt.exam.startAt > new Date('2000-01-01')
            if (attempt.exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
                return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
            }
        }

        // Gate results for students based on grading status
        // Teachers can always see results, students only when fully graded
        if (isOwner && !isTeacherUser && attempt.status !== 'GRADED') {
            return NextResponse.json({
                error: "RESULTS_NOT_AVAILABLE",
                message: "Results are not available yet."
            }, { status: 403 })
        }

        // Additional gate: check exam-level release rules for students
        if (isOwner && !isTeacherUser) {
            const gradingConfig = (attempt.exam.gradingConfig as Record<string, unknown>) || {}
            const releaseInfo = getCorrectionReleaseInfo({
                gradingConfig,
                startAt: attempt.exam.startAt,
                durationMinutes: attempt.exam.durationMinutes,
                endAt: attempt.exam.endAt,
            })
            if (!releaseInfo.isReleased) {
                return NextResponse.json({
                    error: "RESULTS_NOT_RELEASED",
                    message: "Les resultats de cet examen ne sont pas encore disponibles."
                }, { status: 403 })
            }
        }

        // Calculate total score
        let totalScore = 0
        let totalMaxPoints = 0

        const resultData = {
            examTitle: attempt.exam.title,
            studentName: attempt.student.name,
            submittedAt: attempt.submittedAt,
            totalScore,
            totalMaxPoints,
            sections: attempt.exam.sections.map(section => ({
                id: section.id,
                title: section.title,
                questions: section.questions.map(question => {
                    const answer = attempt.answers.find(a => a.questionId === question.id)
                    const grade = answer?.grades?.[0]

                    const maxPoints = question.segments.reduce((sum, seg) => sum + (seg.maxPoints || 0), 0)
                    totalMaxPoints += maxPoints
                    if (grade) totalScore += grade.score

                    // Determine if this is an AI-generated grade
                    const isAiGrade = grade ? (grade.gradedByUserId === null && !grade.isOverridden) : false

                    return {
                        id: question.id,
                        content: question.content,
                        maxPoints,
                        answer: answer ? {
                            segments: answer.segments.map(s => s.content)
                        } : null,
                        grade: grade ? {
                            score: grade.score,
                            feedback: grade.feedback,
                            isAiGrade
                        } : null
                    }
                })
            }))
        }

        // Update total scores after calculation
        resultData.totalScore = totalScore
        resultData.totalMaxPoints = totalMaxPoints

        return NextResponse.json(resultData)

    } catch (error) {
        console.error("[API] Get Results Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

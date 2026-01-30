import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"

// GET /api/exams/[examId]/grading - List attempts for grading
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch exam to verify access
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            select: {
                id: true,
                gradingConfig: true,
                course: {
                    select: { institutionId: true, archivedAt: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Fetch attempts with student info and grades
        const attempts = await prisma.attempt.findMany({
            where: { examId },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                answers: {
                    include: {
                        grades: true // Fetch question-level grades
                    }
                }
            },
            orderBy: {
                submittedAt: 'desc'
            }
        })

        // Get exam max points and rubric status
        const examWithQuestions = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sections: {
                    include: {
                        questions: {
                            include: { segments: true }
                        }
                    }
                }
            }
        })

        let examMaxPoints = 0
        let textQuestionsTotal = 0
        let textQuestionsWithRubric = 0

        if (examWithQuestions) {
            examWithQuestions.sections.forEach(section => {
                section.questions.forEach(question => {
                    question.segments.forEach(segment => {
                        examMaxPoints += segment.maxPoints || 0
                    })
                    // Count TEXT questions and their rubric status
                    if (question.type === 'TEXT') {
                        textQuestionsTotal++
                        if (question.generatedRubric !== null) {
                            textQuestionsWithRubric++
                        }
                    }
                })
            })
        }

        // Calculate scores
        const gradingList = attempts.map(attempt => {
            let totalScore = 0
            let gradedQuestionsCount = 0
            let humanModifiedCount = 0
            let latestGradedAt: Date | null = null

            // Sum up scores from question-level grades
            attempt.answers.forEach(answer => {
                if (answer.grades && answer.grades.length > 0) {
                    // Assuming one grade per question (enforced by app logic/unique constraint)
                    const grade = answer.grades[0]
                    totalScore += grade.score
                    gradedQuestionsCount++

                    // Track the latest grading date
                    if (grade.createdAt && (!latestGradedAt || grade.createdAt > latestGradedAt)) {
                        latestGradedAt = grade.createdAt
                    }

                    // Count human-modified grades
                    if (grade.isOverridden || grade.gradedByUserId !== null) {
                        humanModifiedCount++
                    }
                }
            })

            // isFullyGraded is now based on Attempt.status
            const isFullyGraded = attempt.status === 'GRADED'
            const hasGrades = gradedQuestionsCount > 0

            return {
                attemptId: attempt.id,
                student: attempt.student,
                status: attempt.status,
                submittedAt: attempt.submittedAt,
                gradedAt: latestGradedAt,
                totalScore: hasGrades ? totalScore : null,
                maxPoints: examMaxPoints || null,
                gradedQuestionsCount,
                isFullyGraded,
                humanModifiedCount
            }
        })

        const gradingConfig = exam.gradingConfig as Record<string, unknown> | null
        const gradesReleased = gradingConfig?.gradesReleased === true

        // Calculate grading status
        const submittedAttempts = gradingList.filter(a =>
            a.status === 'SUBMITTED' || a.status === 'GRADING_IN_PROGRESS' || a.status === 'GRADED'
        )
        const gradedAttempts = gradingList.filter(a => a.status === 'GRADED')

        const rubricStatus = {
            total: textQuestionsTotal,
            generated: textQuestionsWithRubric,
            allGenerated: textQuestionsTotal > 0 && textQuestionsWithRubric === textQuestionsTotal
        }

        const gradingStatus = {
            total: submittedAttempts.length,
            graded: gradedAttempts.length,
            allGraded: submittedAttempts.length > 0 && gradedAttempts.length === submittedAttempts.length
        }

        return NextResponse.json({
            attempts: gradingList,
            gradesReleased,
            rubricStatus,
            gradingStatus
        })

    } catch (error) {
        console.error("[API] Get Grading List Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

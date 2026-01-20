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
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
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

        // Get exam max points
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
        if (examWithQuestions) {
            examWithQuestions.sections.forEach(section => {
                section.questions.forEach(question => {
                    question.segments.forEach(segment => {
                        examMaxPoints += segment.maxPoints || 0
                    })
                })
            })
        }

        // Calculate scores
        const gradingList = attempts.map(attempt => {
            let totalScore = 0
            let gradedQuestionsCount = 0
            let humanModifiedCount = 0

            // Sum up scores from question-level grades
            attempt.answers.forEach(answer => {
                if (answer.grades && answer.grades.length > 0) {
                    // Assuming one grade per question (enforced by app logic/unique constraint)
                    const grade = answer.grades[0]
                    totalScore += grade.score
                    gradedQuestionsCount++

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
                totalScore: hasGrades ? totalScore : null,
                maxPoints: examMaxPoints || null,
                gradedQuestionsCount,
                isFullyGraded,
                humanModifiedCount
            }
        })

        return NextResponse.json({ attempts: gradingList })

    } catch (error) {
        console.error("[API] Get Grading List Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

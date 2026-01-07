import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"

// GET /api/attempts/[id]/grading - Get data for grading an attempt
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                student: {
                    select: { id: true, name: true, email: true }
                },
                exam: {
                    include: {
                        course: { select: { institutionId: true, archivedAt: true } },
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

        if (!attempt || attempt.exam.archivedAt || attempt.exam.course.archivedAt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        if (attempt.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Structure response for the UI
        const gradingData = {
            attempt: {
                id: attempt.id,
                student: attempt.student,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                status: attempt.status
            },
            exam: {
                id: attempt.exam.id,
                title: attempt.exam.title,
                sections: attempt.exam.sections.map(section => ({
                    id: section.id,
                    title: section.title,
                    questions: section.questions.map(question => {
                        // Find student answer
                        const answer = attempt.answers.find(a => a.questionId === question.id)
                        const grade = answer?.grades?.[0] // Question-level grade

                        // Calculate max points for question (sum of segments)
                        const maxPoints = question.segments.reduce((sum, seg) => sum + (seg.maxPoints || 0), 0)

                        return {
                            id: question.id,
                            content: question.content,
                            maxPoints,
                            answer: answer ? {
                                id: answer.id,
                                // Concatenate segments for display if needed, or send raw segments
                                segments: answer.segments.map(s => ({
                                    id: s.id,
                                    content: s.content
                                }))
                            } : null,
                            grade: grade ? {
                                id: grade.id,
                                score: grade.score,
                                feedback: grade.feedback
                            } : null
                        }
                    })
                }))
            }
        }

        return NextResponse.json(gradingData)

    } catch (error) {
        console.error("[API] Get Attempt Grading Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

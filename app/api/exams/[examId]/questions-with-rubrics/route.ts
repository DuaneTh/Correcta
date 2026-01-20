import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"

// GET /api/exams/[examId]/questions-with-rubrics - Get TEXT questions with their rubrics
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

        // Fetch exam with questions
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true }
                },
                sections: {
                    orderBy: { order: 'asc' },
                    include: {
                        questions: {
                            where: { type: 'TEXT' },
                            orderBy: { order: 'asc' },
                            include: {
                                segments: {
                                    select: { maxPoints: true },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Flatten questions with section info
        const questions = exam.sections.flatMap(section =>
            section.questions.map((question, index) => ({
                id: question.id,
                content: question.content,
                order: index + 1,
                sectionTitle: section.title || `Section ${section.order + 1}`,
                maxPoints: question.segments.reduce((sum, s) => sum + (s.maxPoints || 0), 0) || 10,
                generatedRubric: question.generatedRubric
            }))
        )

        return NextResponse.json({ questions })

    } catch (error) {
        console.error("[API] Get Questions With Rubrics Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

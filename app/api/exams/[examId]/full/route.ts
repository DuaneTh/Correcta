import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseContent } from "@/lib/content"

const resolveCourseTeacherName = (course: {
    classes?: Array<{
        enrollments?: Array<{ user?: { name?: string | null } | null }>
    }>
}) =>
    course.classes
        ?.flatMap((cls) => cls.enrollments ?? [])
        .map((enrollment) => enrollment.user?.name)
        .find(Boolean) ?? null

const mapExamContent = <T extends { sections: Array<{ questions: Array<{ content: unknown; answerTemplate?: unknown }> }> }>(
    exam: T
) => ({
    ...exam,
    sections: exam.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
            ...question,
            content: parseContent(question.content),
            answerTemplate: parseContent(question.answerTemplate),
        })),
    })),
})

export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Get complete exam structure with sections, questions, segments, and rubrics
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        institutionId: true,
                        archivedAt: true,
                        classes: {
                            where: { archivedAt: null },
                            select: {
                                enrollments: {
                                    where: { role: 'TEACHER', user: { archivedAt: null } },
                                    select: {
                                        user: { select: { name: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                author: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: {
                                    include: {
                                        rubric: true
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        // Authorization check
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const courseTeacherName = resolveCourseTeacherName(exam.course)
        const mapped = mapExamContent(exam)
        return NextResponse.json({
            ...mapped,
            course: {
                id: exam.course.id,
                code: exam.course.code,
                name: exam.course.name,
                teacherName: courseTeacherName ?? null,
                institutionId: exam.course.institutionId
            },
            courseId: exam.course.id
        })
    } catch (error) {
        console.error("[API] Get Full Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

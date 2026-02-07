import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseContent, serializeContent } from "@/lib/content"
import { getExamPermissions } from "@/lib/exam-permissions"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const resolvedParams = await params
        const urlExamId = (() => {
            try {
                const path = new URL(req.url).pathname
                const parts = path.split('/').filter(Boolean)
                return parts[parts.length - 2] // .../exams/:examId/questions
            } catch {
                return undefined
            }
        })()

        const examId = resolvedParams?.examId || urlExamId
        if (!examId || examId === 'undefined' || examId === 'null') {
            return NextResponse.json({ error: "Invalid exam id" }, { status: 400 })
        }

        const session = await getAuthSession(req)
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

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!exam || exam.archivedAt || exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const { canEdit } = await getExamPermissions(examId, {
            id: session.user.id,
            institutionId: session.user.institutionId,
            role: session.user.role,
        })
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Allow edits during live exams; changes will be tracked separately.

        const body = await req.json()
        const {
            content = 'New question',
            answerTemplate,
            answerTemplateLocked,
            type = 'TEXT',
            order,
            sectionId,
            atTop = false,
            afterQuestionId,
            outsideSection = false,
        } = body

        if (!['TEXT', 'MCQ', 'CODE'].includes(type)) {
            return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
        }

        const result = await prisma.$transaction(async (tx) => {
            let targetSection
            let referenceQuestion: {
                id: string
                order: number
                sectionId: string
                section: { examId: string; order: number }
            } | null = null

            if (afterQuestionId) {
                referenceQuestion = await tx.question.findUnique({
                    where: { id: afterQuestionId },
                    include: { section: true }
                })

                if (!referenceQuestion || referenceQuestion.section.examId !== examId) {
                    throw new Error("Invalid reference question")
                }

                if (!outsideSection) {
                    targetSection = referenceQuestion.section
                }
            }

            const firstSection = await tx.examSection.findFirst({
                where: { examId },
                orderBy: { order: 'asc' },
                select: { order: true }
            })
            const topOrder = (firstSection?.order ?? 0) - 1

            if (!targetSection) {
                if (outsideSection && referenceQuestion) {
                    const insertOrder = referenceQuestion.section.order + 1
                    const sectionsToShift = await tx.examSection.findMany({
                        where: { examId, order: { gte: insertOrder } },
                        orderBy: { order: 'desc' },
                        select: { id: true, order: true }
                    })

                    for (const section of sectionsToShift) {
                        await tx.examSection.update({
                            where: { id: section.id },
                            data: { order: section.order + 1 }
                        })
                    }

                    targetSection = await tx.examSection.create({
                        data: {
                            examId,
                            title: '',
                            order: insertOrder,
                            isDefault: true
                        }
                    })
                } else if (sectionId) {
                    // Use provided section
                    targetSection = await tx.examSection.findUnique({
                        where: { id: sectionId }
                    })
                    if (!targetSection || targetSection.examId !== examId) {
                        throw new Error("Invalid section")
                    }
                } else {
                    // Use or create default section.
                    const defaultSection = await tx.examSection.findFirst({
                        where: { examId, isDefault: true },
                        include: { _count: { select: { questions: true } } }
                    })

                    if (!defaultSection) {
                        targetSection = await tx.examSection.create({
                            data: {
                                examId,
                                title: '',
                                order: topOrder,
                                isDefault: true
                            }
                        })
                    } else if (atTop && defaultSection._count.questions > 0) {
                        // Keep existing standalone questions in place; create a new top section for the new question.
                        targetSection = await tx.examSection.create({
                            data: {
                                examId,
                                title: '',
                                order: topOrder,
                                isDefault: true
                            }
                        })
                    } else if (atTop && defaultSection._count.questions === 0 && defaultSection.order > topOrder) {
                        // Reuse empty default section, but lift it to the top.
                        targetSection = await tx.examSection.update({
                            where: { id: defaultSection.id },
                            data: { order: topOrder }
                        })
                    } else {
                        targetSection = defaultSection
                    }
                }
            }

            const questionsInSection = await tx.question.findMany({
                where: { sectionId: (targetSection as any).id },
                orderBy: { order: 'asc' },
                select: { id: true, order: true }
            })

            let questionOrder: number
            if (typeof order === 'number' && !Number.isNaN(order)) {
                questionOrder = order
            } else if (referenceQuestion) {
                questionOrder = referenceQuestion.order + 1
            } else if (atTop) {
                const firstQuestion = questionsInSection[0]
                questionOrder = firstQuestion ? firstQuestion.order - 1 : 0
            } else {
                const lastQuestion = questionsInSection[questionsInSection.length - 1]
                questionOrder = lastQuestion ? lastQuestion.order + 1 : 0
            }

            const hasOrderCollision = questionsInSection.some((q) => q.order === questionOrder)
            if (hasOrderCollision) {
                const toShift = questionsInSection
                    .filter((q) => q.order >= questionOrder)
                    .sort((a, b) => b.order - a.order)

                for (const item of toShift) {
                    await tx.question.update({
                        where: { id: item.id },
                        data: { order: item.order + 1 }
                    })
                }
            }

            const createdQuestion = await tx.question.create({
                data: {
                    sectionId: (targetSection as any).id,
                    content: serializeContent(parseContent(content)),
                    answerTemplate: serializeContent(parseContent(answerTemplate ?? '')),
                    answerTemplateLocked: Boolean(answerTemplateLocked),
                    type,
                    order: questionOrder
                }
            })

            // Only create a default segment for TEXT and CODE questions
            // MCQ questions require multiple options to be added manually
            if (type !== 'MCQ') {
                await tx.questionSegment.create({
                    data: {
                        questionId: createdQuestion.id,
                        order: 0,
                        instruction: '',
                        maxPoints: 0, // Start empty; teacher must set points
                        rubric: {
                            create: {
                                criteria: '',
                                levels: [],
                                examples: []
                            }
                        }
                    }
                })
            }

            const fullQuestion = await tx.question.findUnique({
                where: { id: createdQuestion.id },
                include: {
                    segments: {
                        include: {
                            rubric: true
                        }
                    }
                }
            })

            return {
                question: fullQuestion
                    ? { ...fullQuestion, content: parseContent(fullQuestion.content) }
                    : null,
                sectionId: (targetSection as any).id
            }
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error("[API] Create standalone question error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

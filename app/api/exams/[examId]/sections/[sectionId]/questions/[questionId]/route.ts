import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseContent, serializeContent } from "@/lib/content"
import { getExamPermissions } from "@/lib/exam-permissions"

type QuestionParams = { examId?: string; sectionId?: string; questionId?: string }

const resolveParams = (req: Request, params: QuestionParams) => {
    const urlPath = (() => {
        try {
            return new URL(req.url).pathname
        } catch {
            return ''
        }
    })()

    const parts = urlPath.split('/').filter(Boolean)
    // .../exams/:examId/sections/:sectionId/questions/:questionId
    const questionIdFromPath = parts[parts.length - 1]
    const sectionIdFromPath = parts[parts.length - 3]
    const examIdFromPath = parts[parts.length - 5]

    const examId = params.examId ?? examIdFromPath
    const sectionId = params.sectionId ?? sectionIdFromPath
    const questionId = params.questionId ?? questionIdFromPath

    return { examId, sectionId, questionId }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<QuestionParams> }
) {
    try {
        const resolvedParams = await params
        const { examId, sectionId, questionId } = resolveParams(req, resolvedParams)
        if (!examId || !sectionId || !questionId) {
            return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 })
        }
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify question belongs to section in user's institution
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                section: {
                    include: {
                        exam: {
                            include: { course: true }
                        }
                    }
                }
            }
        })

        if (!question || question.section.examId !== examId || question.section.exam.archivedAt || question.section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
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

        const body = (await req.json()) as {
            content?: unknown
            answerTemplate?: unknown
            answerTemplateLocked?: boolean
            studentTools?: unknown
            type?: 'TEXT' | 'MCQ' | 'CODE'
            order?: number
            customLabel?: string | null
            requireAllCorrect?: boolean
            shuffleOptions?: boolean
            maxPoints?: number | string | null
            targetSectionId?: string
            targetOrder?: number
        }
        const { content, answerTemplate, answerTemplateLocked, studentTools, type, order, customLabel, requireAllCorrect, shuffleOptions, maxPoints, targetSectionId, targetOrder } = body

        if (type && !['TEXT', 'MCQ', 'CODE'].includes(type)) {
            return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
        }
        if (targetSectionId) {
            const targetSection = await prisma.examSection.findUnique({
                where: { id: targetSectionId },
                select: { id: true, examId: true },
            })
            if (!targetSection || targetSection.examId !== examId) {
                return NextResponse.json({ error: "Invalid target section" }, { status: 400 })
            }
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {}
        if (content !== undefined) updateData.content = serializeContent(parseContent(content))
        if (answerTemplate !== undefined) updateData.answerTemplate = serializeContent(parseContent(answerTemplate))
        if (answerTemplateLocked !== undefined) updateData.answerTemplateLocked = Boolean(answerTemplateLocked)
        if (studentTools !== undefined) updateData.studentTools = studentTools ?? null
        if (type !== undefined) updateData.type = type
        if (targetOrder !== undefined) {
            updateData.order = targetOrder
        } else if (order !== undefined) {
            updateData.order = order
        }
        if (targetSectionId) {
            updateData.sectionId = targetSectionId
        }
        if (customLabel !== undefined) updateData.customLabel = customLabel
        if (requireAllCorrect !== undefined) updateData.requireAllCorrect = requireAllCorrect
        if (shuffleOptions !== undefined) updateData.shuffleOptions = shuffleOptions
        if (maxPoints !== undefined) {
            if (maxPoints === null || maxPoints === '') {
                updateData.maxPoints = null
            } else {
                const parsed = typeof maxPoints === 'number' ? maxPoints : parseFloat(String(maxPoints))
                updateData.maxPoints = isNaN(parsed) ? null : parsed
            }
        }

        const updatedQuestion = await prisma.question.update({
            where: { id: questionId },
            data: updateData,
            include: {
                segments: {
                    include: {
                        rubric: true
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        const { logExamChanges } = await import("@/lib/exam-change")
        const fallbackQuestionLabel = `Question ${question.order + 1}`
        const questionLabel = question.customLabel || fallbackQuestionLabel
        const questionChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
        if (content !== undefined) {
            questionChanges.push({
                examId,
                entityType: 'QUESTION',
                entityId: questionId,
                entityLabel: questionLabel,
                field: 'content',
                beforeValue: parseContent(question.content),
                afterValue: parseContent(content),
                createdById: session.user.id,
            })
        }
        if (answerTemplate !== undefined) {
            questionChanges.push({
                examId,
                entityType: 'QUESTION',
                entityId: questionId,
                entityLabel: questionLabel,
                field: 'answerTemplate',
                beforeValue: parseContent(question.answerTemplate || ''),
                afterValue: parseContent(answerTemplate),
                createdById: session.user.id,
            })
        }
        if (studentTools !== undefined) {
            questionChanges.push({
                examId,
                entityType: 'QUESTION',
                entityId: questionId,
                entityLabel: questionLabel,
                field: 'studentTools',
                beforeValue: question.studentTools ?? null,
                afterValue: studentTools ?? null,
                createdById: session.user.id,
            })
        }
        await logExamChanges({ status: question.section.exam.status, startAt: question.section.exam.startAt }, questionChanges)

        return NextResponse.json({
            ...updatedQuestion,
            content: parseContent(updatedQuestion.content),
            answerTemplate: parseContent(updatedQuestion.answerTemplate),
        })
    } catch (error: unknown) {
        console.error("[API] Update Question Error:", error)
        
        // Check if it's a Prisma error about unknown field
        const err = error as { code?: string; message?: string; stack?: string }
        if (err?.code === 'P2009' || err?.message?.includes('Unknown arg') || err?.message?.includes('Unknown field')) {
            return NextResponse.json({ 
                error: "Database schema mismatch. Please run database migration: npx prisma migrate dev",
                details: err.message 
            }, { status: 500 })
        }
        
        // Return more detailed error for debugging
        return NextResponse.json({ 
            error: err?.message || "Internal Server Error",
            code: err?.code,
            details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
        }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<QuestionParams> }
) {
    try {
        const resolvedParams = await params
        const { examId, sectionId, questionId } = resolveParams(req, resolvedParams)
        if (!examId || !sectionId || !questionId) {
            return NextResponse.json({ error: "Invalid identifiers" }, { status: 400 })
        }
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify question belongs to section in user's institution
        const question = await prisma.question.findUnique({
            where: { id: questionId },
            include: {
                section: {
                    include: {
                        exam: {
                            include: { course: true }
                        }
                    }
                }
            }
        })

        if (!question || question.sectionId !== sectionId || question.section.examId !== examId || question.section.exam.archivedAt || question.section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
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

        // Check if exam is locked (published)
        const { isExamLocked } = await import("@/lib/exam-lock")
        const locked = await isExamLocked(examId)
        if (locked) {
            return NextResponse.json(
                { error: "Exam is published and has started" },
                { status: 403 }
            )
        }

        await prisma.$transaction(async (tx) => {
            // Remove dependent rubrics/segments before deleting the question itself
            await tx.rubric.deleteMany({
                where: {
                    segment: {
                        questionId
                    }
                }
            })

            await tx.questionSegment.deleteMany({
                where: { questionId }
            })

            await tx.question.delete({
                where: { id: questionId }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Question Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

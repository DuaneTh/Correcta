import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getExamPermissions } from "@/lib/exam-permissions"

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ examId: string, questionId: string, segmentId: string }> }
) {
    try {
        const { examId, questionId, segmentId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify segment belongs to question in user's institution
        const segment = await prisma.questionSegment.findUnique({
            where: { id: segmentId },
            include: {
                question: {
                    include: {
                        section: {
                            include: {
                                exam: {
                                    include: { course: true }
                                }
                            }
                        }
                    }
                },
                rubric: true
            }
        })

        if (!segment || segment.questionId !== questionId || segment.question.section.examId !== examId || segment.question.section.exam.archivedAt || segment.question.section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (segment.question.section.exam.course.institutionId !== session.user.institutionId) {
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

        let body: {
            instruction?: string | null
            maxPoints?: number | string | null
            rubric?: {
                criteria?: string
                levels?: unknown[]
                examples?: unknown
            } | null
            isCorrect?: boolean | string
            order?: number
        } = {}
        try {
            body = await req.json()
        } catch (parseError) {
            console.error("[API] Failed to parse request body:", parseError)
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
        }
        const { instruction, maxPoints, rubric, isCorrect, order } = body

        // Update segment
        const updateData: Record<string, unknown> = {}
        if (instruction !== undefined) {
            // Allow empty strings for drafts
            updateData.instruction = instruction === null ? '' : String(instruction)
        }
        if (maxPoints !== undefined) {
            if (maxPoints === null || maxPoints === '') {
                updateData.maxPoints = null
            } else {
                const parsed = typeof maxPoints === 'number' ? maxPoints : parseFloat(String(maxPoints))
                // Only update if parsed is a valid number (not NaN) and is finite
                if (!isNaN(parsed) && isFinite(parsed)) {
                    updateData.maxPoints = parsed
                }
            }
        }
        if (isCorrect !== undefined) {
            updateData.isCorrect = isCorrect === true || isCorrect === 'true'
        }
        if (order !== undefined) {
            const parsed = typeof order === 'number' ? order : parseInt(String(order), 10)
            if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
                updateData.order = parsed
            }
        }

        const hasUpdateData = Object.keys(updateData).length > 0

        if (hasUpdateData) {
            try {
                await prisma.questionSegment.update({
                    where: { id: segmentId },
                    data: updateData
                })
            } catch (prismaError: unknown) {
                console.error("[API] Prisma update error:", prismaError)
                if ((prismaError as { code?: string })?.code === 'P2025') {
                    return NextResponse.json({ error: "Segment not found" }, { status: 404 })
                }
                throw prismaError
            }
        }

        if (rubric === undefined && !hasUpdateData) {
            const currentSegment = await prisma.questionSegment.findUnique({
                where: { id: segmentId },
                include: { rubric: true }
            })
            return NextResponse.json(currentSegment)
        }

        // Handle rubric update/creation/deletion
        if (rubric !== undefined) {
            if (rubric === null) {
                // Delete rubric if exists
                if (segment.rubric) {
                    await prisma.rubric.delete({
                        where: { id: segment.rubric.id }
                    })
                }
            } else {
                // Update or create rubric
                if (segment.rubric) {
                    await prisma.rubric.update({
                        where: { id: segment.rubric.id },
                        data: {
                            criteria: rubric.criteria,
                            levels: rubric.levels as any,
                            examples: (rubric.examples || null) as any
                        }
                    })
                } else {
                    await prisma.rubric.create({
                        data: {
                            segmentId,
                            criteria: rubric.criteria || '',
                            levels: (rubric.levels || []) as any,
                            examples: (rubric.examples || null) as any
                        }
                    })
                }
            }
        }

        // Fetch updated segment with rubric
        const finalSegment = await prisma.questionSegment.findUnique({
            where: { id: segmentId },
            include: {
                rubric: true
            }
        })

        const { logExamChanges } = await import("@/lib/exam-change")
        const fallbackQuestionLabel = `Question ${segment.question.order + 1}`
        const segmentLabel = segment.question.customLabel || fallbackQuestionLabel
        const segmentChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
        if (instruction !== undefined) {
            segmentChanges.push({
                examId,
                entityType: 'SEGMENT',
                entityId: segmentId,
                entityLabel: segmentLabel,
                field: 'instruction',
                beforeValue: segment.instruction,
                afterValue: instruction ?? '',
                createdById: session.user.id,
            })
        }
        await logExamChanges({ status: segment.question.section.exam.status, startAt: segment.question.section.exam.startAt }, segmentChanges)

        return NextResponse.json(finalSegment)
    } catch (error: unknown) {
        console.error("[API] Update Segment Error:", error)
        // Return more specific error information
        const err = error as { message?: string; code?: string; stack?: string }
        const errorMessage = err?.message || "Internal Server Error"
        const statusCode = err?.code === 'P2025' ? 404 : 500 // Prisma not found error
        return NextResponse.json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
        }, { status: statusCode })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ examId: string, questionId: string, segmentId: string }> }
) {
    try {
        const { examId, questionId, segmentId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify segment belongs to question in user's institution
        const segment = await prisma.questionSegment.findUnique({
            where: { id: segmentId },
            include: {
                question: {
                    include: {
                        section: {
                            include: {
                                exam: {
                                    include: { course: true }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!segment || segment.questionId !== questionId || segment.question.section.examId !== examId || segment.question.section.exam.archivedAt || segment.question.section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (segment.question.section.exam.course.institutionId !== session.user.institutionId) {
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
            return NextResponse.json({
                error: "Exam is published and has started"
            }, { status: 403 })
        }

        // Delete related entities first (rubric and answer segments)
        // Delete rubric if it exists
        const segmentWithRubric = await prisma.questionSegment.findUnique({
            where: { id: segmentId },
            include: { rubric: true }
        })

        if (segmentWithRubric?.rubric) {
            await prisma.rubric.delete({
                where: { id: segmentWithRubric.rubric.id }
            })
        }

        // Delete answer segments if they exist
        await prisma.answerSegment.deleteMany({
            where: { segmentId }
        })

        // Now delete the segment
        await prisma.questionSegment.delete({
            where: { id: segmentId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Segment Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseContent } from "@/lib/content"
import { getExamPermissions } from "@/lib/exam-permissions"

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ examId: string, sectionId: string }> }
) {
    try {
        const { examId, sectionId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify section belongs to exam in user's institution
        const section = await prisma.examSection.findUnique({
            where: { id: sectionId },
            include: {
                exam: {
                    include: { course: true }
                }
            }
        })

        if (!section || section.examId !== examId || section.exam.archivedAt || section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (section.exam.course.institutionId !== session.user.institutionId) {
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

        if (section.isDefault) {
            return NextResponse.json({ error: "Default section cannot be modified" }, { status: 400 })
        }

        // Allow edits during live exams; changes will be tracked separately.

        const body = await req.json()
        const { title, order, customLabel, introContent } = body

        const updatedSection = await prisma.examSection.update({
            where: { id: sectionId },
            data: {
                ...(title !== undefined && { title }),
                ...(order !== undefined && { order }),
                ...(customLabel !== undefined && { customLabel: customLabel || null }),
                ...(introContent !== undefined && { introContent })
            }
        })

        const { logExamChanges } = await import("@/lib/exam-change")
        const fallbackSectionLabel = section.title?.trim() ? section.title : 'Section'
        const sectionLabel = section.customLabel || fallbackSectionLabel
        const sectionChanges: Array<Parameters<typeof logExamChanges>[1][number]> = []
        if (title !== undefined) {
            sectionChanges.push({
                examId,
                entityType: 'SECTION',
                entityId: sectionId,
                entityLabel: sectionLabel,
                field: 'title',
                beforeValue: section.title,
                afterValue: title,
                createdById: session.user.id,
            })
        }
        if (customLabel !== undefined) {
            sectionChanges.push({
                examId,
                entityType: 'SECTION',
                entityId: sectionId,
                entityLabel: sectionLabel,
                field: 'customLabel',
                beforeValue: section.customLabel ?? null,
                afterValue: customLabel || null,
                createdById: session.user.id,
            })
        }
        if (introContent !== undefined) {
            sectionChanges.push({
                examId,
                entityType: 'SECTION',
                entityId: sectionId,
                entityLabel: sectionLabel,
                field: 'introContent',
                beforeValue: parseContent(section.introContent || ''),
                afterValue: parseContent(introContent || ''),
                createdById: session.user.id,
            })
        }
        await logExamChanges({ status: section.exam.status, startAt: section.exam.startAt }, sectionChanges)

        return NextResponse.json(updatedSection)
    } catch (error) {
        console.error("[API] Update Section Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ examId: string, sectionId: string }> }
) {
    try {
        const { examId, sectionId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify section belongs to exam in user's institution
        const section = await prisma.examSection.findUnique({
            where: { id: sectionId },
            include: {
                exam: {
                    include: { course: true }
                }
            }
        })

        if (!section || section.examId !== examId || section.exam.archivedAt || section.exam.course.archivedAt) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (section.exam.course.institutionId !== session.user.institutionId) {
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

        if (section.isDefault) {
            return NextResponse.json({ error: "Default section cannot be modified" }, { status: 400 })
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

        // Get all questions in the section
        const questions = await prisma.question.findMany({
            where: { sectionId: sectionId },
            select: { id: true }
        })

        const questionIds = questions.map(q => q.id)

        // Delete all related data in cascade order using a transaction
        await prisma.$transaction(async (tx) => {
            if (questionIds.length > 0) {
                // Get all segments for these questions
                const segments = await tx.questionSegment.findMany({
                    where: { questionId: { in: questionIds } },
                    select: { id: true }
                })
                const segmentIds = segments.map(s => s.id)

                // Get all answers for these questions
                const answers = await tx.answer.findMany({
                    where: { questionId: { in: questionIds } },
                    select: { id: true }
                })
                const answerIds = answers.map(a => a.id)

                // Get all answer segments (both linked to segments and answers)
                const answerSegments = await tx.answerSegment.findMany({
                    where: {
                        OR: [
                            { segmentId: { in: segmentIds } },
                            { answerId: { in: answerIds } }
                        ]
                    },
                    select: { id: true }
                })
                const answerSegmentIds = answerSegments.map(as => as.id)

                // Delete grades (linked to answers and answer segments)
                if (answerIds.length > 0 || answerSegmentIds.length > 0) {
                    await tx.grade.deleteMany({
                        where: {
                            OR: [
                                { answerId: { in: answerIds } },
                                { answerSegmentId: { in: answerSegmentIds } }
                            ]
                        }
                    })
                }

                // Delete rubrics (linked to segments)
                if (segmentIds.length > 0) {
                    await tx.rubric.deleteMany({
                        where: { segmentId: { in: segmentIds } }
                    })
                }

                // Delete answer segments
                if (answerSegmentIds.length > 0) {
                    await tx.answerSegment.deleteMany({
                        where: { id: { in: answerSegmentIds } }
                    })
                }

                // Delete question segments
                if (segmentIds.length > 0) {
                    await tx.questionSegment.deleteMany({
                        where: { id: { in: segmentIds } }
                    })
                }

                // Delete answers
                if (answerIds.length > 0) {
                    await tx.answer.deleteMany({
                        where: { id: { in: answerIds } }
                    })
                }
            }

            // Delete questions
            await tx.question.deleteMany({
                where: { sectionId: sectionId }
            })

            // Finally delete the section
            await tx.examSection.delete({
                where: { id: sectionId }
            })
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Section Error:", error)
        console.error("[API] Delete Section Error Details:", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        })
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : "Internal Server Error" 
        }, { status: 500 })
    }
}

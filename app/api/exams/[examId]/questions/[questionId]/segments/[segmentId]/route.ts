import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

        if (!segment || segment.questionId !== questionId || segment.question.section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (segment.question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if exam is locked (T-10 rule)
        const { isExamLocked } = await import("@/lib/exam-lock")
        const locked = await isExamLocked(examId)
        if (locked) {
            return NextResponse.json({
                error: "Exam is locked: cannot be edited less than 10 minutes before start time"
            }, { status: 403 })
        }

        const body = await req.json()
        const { instruction, maxPoints, rubric } = body

        // Update segment
        const updatedSegment = await prisma.questionSegment.update({
            where: { id: segmentId },
            data: {
                ...(instruction !== undefined && { instruction }),
                ...(maxPoints !== undefined && { maxPoints: parseFloat(maxPoints) })
            }
        })

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
                            levels: rubric.levels,
                            examples: rubric.examples || null
                        }
                    })
                } else {
                    await prisma.rubric.create({
                        data: {
                            segmentId,
                            criteria: rubric.criteria || '',
                            levels: rubric.levels || [],
                            examples: rubric.examples || null
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

        return NextResponse.json(finalSegment)
    } catch (error) {
        console.error("[API] Update Segment Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
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

        if (!segment || segment.questionId !== questionId || segment.question.section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (segment.question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if exam is locked (T-10 rule)
        const { isExamLocked } = await import("@/lib/exam-lock")
        const locked = await isExamLocked(examId)
        if (locked) {
            return NextResponse.json({
                error: "Exam is locked: cannot be edited less than 10 minutes before start time"
            }, { status: 403 })
        }

        await prisma.questionSegment.delete({
            where: { id: segmentId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Segment Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

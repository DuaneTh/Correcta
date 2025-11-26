import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ examId: string, sectionId: string, questionId: string }> }
) {
    try {
        const { examId, sectionId, questionId } = await params
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

        if (!question || question.sectionId !== sectionId || question.section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if exam is locked (T-10 rule)
        const { isExamLocked } = await import("@/lib/exam-lock")
        const locked = await isExamLocked(examId)
        if (locked) {
            return NextResponse.json(
                { error: "Exam is locked less than 10 minutes before start time" },
                { status: 403 }
            )
        }

        const body = await req.json()
        const { content, type, order } = body

        if (type && !['TEXT', 'MCQ', 'CODE'].includes(type)) {
            return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
        }

        const updatedQuestion = await prisma.question.update({
            where: { id: questionId },
            data: {
                ...(content !== undefined && { content }),
                ...(type !== undefined && { type }),
                ...(order !== undefined && { order })
            },
            include: {
                segments: {
                    include: {
                        rubric: true
                    }
                }
            }
        })

        return NextResponse.json(updatedQuestion)
    } catch (error) {
        console.error("[API] Update Question Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ examId: string, sectionId: string, questionId: string }> }
) {
    try {
        const { examId, sectionId, questionId } = await params
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

        if (!question || question.sectionId !== sectionId || question.section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if exam is locked (T-10 rule)
        const { isExamLocked } = await import("@/lib/exam-lock")
        const locked = await isExamLocked(examId)
        if (locked) {
            return NextResponse.json(
                { error: "Exam is locked less than 10 minutes before start time" },
                { status: 403 }
            )
        }

        await prisma.question.delete({
            where: { id: questionId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Question Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

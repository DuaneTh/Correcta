import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: true,
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: {
                                    include: {
                                        rubric: true
                                    }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        // Authorization check
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        return NextResponse.json(exam)
    } catch (error) {
        console.error("[API] Get Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()

        // Validate ownership before update
        const existingExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!existingExam || existingExam.course.institutionId !== session.user.institutionId) {
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

        const updatedExam = await prisma.exam.update({
            where: { id: examId },
            data: {
                title: body.title,
                startAt: body.startAt ? new Date(body.startAt) : undefined,
                durationMinutes: body.durationMinutes ? parseInt(body.durationMinutes) : undefined,
                antiCheatConfig: body.antiCheatConfig,
                gradingConfig: body.gradingConfig
            }
        })

        return NextResponse.json(updatedExam)
    } catch (error) {
        console.error("[API] Update Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ examId: string }> }) {
    try {
        const { examId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const existingExam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!existingExam || existingExam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        await prisma.exam.delete({
            where: { id: examId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Exam Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

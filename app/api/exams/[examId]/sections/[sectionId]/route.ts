import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

        if (!section || section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (section.exam.course.institutionId !== session.user.institutionId) {
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
        const { title, order } = body

        const updatedSection = await prisma.examSection.update({
            where: { id: sectionId },
            data: {
                ...(title !== undefined && { title }),
                ...(order !== undefined && { order })
            }
        })

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

        if (!section || section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (section.exam.course.institutionId !== session.user.institutionId) {
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

        await prisma.examSection.delete({
            where: { id: sectionId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[API] Delete Section Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

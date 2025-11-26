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

        // Verify exam belongs to user's institution
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!exam) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        const sections = await prisma.examSection.findMany({
            where: { examId },
            orderBy: { order: 'asc' }
        })

        return NextResponse.json(sections)
    } catch (error) {
        console.error("[API] Get Sections Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
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

        // Verify exam belongs to user's institution
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: { course: true }
        })

        if (!exam) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
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

        if (!title) {
            return NextResponse.json({ error: "Missing title" }, { status: 400 })
        }

        const section = await prisma.examSection.create({
            data: {
                examId,
                title,
                order: order ?? 0
            }
        })

        return NextResponse.json(section)
    } catch (error) {
        console.error("[API] Create Section Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

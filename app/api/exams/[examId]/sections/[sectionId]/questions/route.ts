import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseContent, serializeContent } from "@/lib/content"
import { getExamPermissions } from "@/lib/exam-permissions"

export async function GET(
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

        if (!session || !session.user) {
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

        const questions = await prisma.question.findMany({
            where: { sectionId },
            include: {
                segments: {
                    include: {
                        rubric: true
                    },
                    orderBy: { order: 'asc' }
                }
            },
            orderBy: [{ order: 'asc' }, { id: 'asc' }]
        })

        return NextResponse.json(questions)
    } catch (error) {
        console.error("[API] Get Questions Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function POST(
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

        // Allow edits during live exams; changes will be tracked separately.

        const body = await req.json()
        const { content, answerTemplate, answerTemplateLocked, type, order } = body

        if (!content || !type) {
            return NextResponse.json({ error: "Missing content or type" }, { status: 400 })
        }

        if (!['TEXT', 'MCQ', 'CODE'].includes(type)) {
            return NextResponse.json({ error: "Invalid question type" }, { status: 400 })
        }

        const question = await prisma.question.create({
            data: {
                sectionId,
                content: serializeContent(parseContent(content)),
                answerTemplate: serializeContent(parseContent(answerTemplate ?? '')),
                answerTemplateLocked: Boolean(answerTemplateLocked),
                type,
                order: order ?? 0
            },
            include: {
                segments: {
                    include: {
                        rubric: true
                    }
                }
            }
        })

        return NextResponse.json(question)
    } catch (error) {
        console.error("[API] Create Question Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

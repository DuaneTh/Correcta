import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getExamPermissions } from "@/lib/exam-permissions"

export async function POST(
    req: Request,
    { params }: { params: Promise<{ examId: string, questionId: string }> }
) {
    try {
        const { examId, questionId } = await params
        const cookieStore = req.headers.get('cookie') || ''
        const match = cookieStore.match(/correcta-institution=([^;]+)/)
        const institutionId = match ? match[1] : undefined

        const authOptions = await buildAuthOptions(institutionId)
        const session = await getServerSession(authOptions)

        if (!session || !session.user || session.user.role === 'STUDENT') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Verify question belongs to exam in user's institution
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

        const body = await req.json()
        const { instruction, maxPoints, rubric } = body

        if (instruction === undefined || instruction === null || maxPoints === undefined) {
            return NextResponse.json({ error: "Missing instruction or maxPoints" }, { status: 400 })
        }

        const parsedMaxPoints = (() => {
            if (maxPoints === null || maxPoints === '') {
                return null
            }
            const parsed = typeof maxPoints === 'number' ? maxPoints : parseFloat(String(maxPoints))
            if (Number.isNaN(parsed)) {
                return undefined
            }
            return parsed
        })()

        if (parsedMaxPoints === undefined) {
            return NextResponse.json({ error: "Invalid maxPoints" }, { status: 400 })
        }

        const lastOrder = await prisma.questionSegment.aggregate({
            where: { questionId },
            _max: { order: true }
        })
        const nextOrder = (lastOrder._max.order ?? -1) + 1

        // Create segment with optional rubric
        const segment = await prisma.questionSegment.create({
            data: {
                questionId,
                order: nextOrder,
                instruction,
                maxPoints: parsedMaxPoints,
                ...(rubric && {
                    rubric: {
                        create: {
                            criteria: rubric.criteria || '',
                            levels: rubric.levels || [],
                            examples: rubric.examples || null
                        }
                    }
                })
            },
            include: {
                rubric: true
            }
        })

        return NextResponse.json(segment)
    } catch (error) {
        console.error("[API] Create Segment Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

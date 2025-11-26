import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

        if (!question || question.section.examId !== examId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        if (question.section.exam.course.institutionId !== session.user.institutionId) {
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

        if (!instruction || maxPoints === undefined) {
            return NextResponse.json({ error: "Missing instruction or maxPoints" }, { status: 400 })
        }

        // Create segment with optional rubric
        const segment = await prisma.questionSegment.create({
            data: {
                questionId,
                instruction,
                maxPoints: parseFloat(maxPoints),
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

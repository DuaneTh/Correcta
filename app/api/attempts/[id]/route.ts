import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isStudent } from "@/lib/api-auth"
import { assertAttemptContentEditable, AttemptNotEditableError } from "@/lib/attemptPermissions"

// GET /api/attempts/[id] - Get attempt details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                exam: {
                    include: {
                        sections: {
                            include: {
                                questions: {
                                    include: {
                                        segments: {
                                            include: {
                                                answerSegments: {
                                                    where: {
                                                        answer: {
                                                            attemptId: id
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            },
                            orderBy: { order: 'asc' }
                        }
                    }
                },
                answers: {
                    include: {
                        segments: true
                    }
                }
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        // Verify ownership (students can only access their own attempts, teachers can access all)
        if (isStudent(session) && attempt.studentId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        return NextResponse.json(attempt)

    } catch (error) {
        console.error("[API] Get Attempt Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// PUT /api/attempts/[id]/autosave - Autosave answer
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isStudent(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const attempt = await prisma.attempt.findUnique({
            where: { id },
            include: {
                exam: true
            }
        })

        if (!attempt) {
            return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
        }

        if (attempt.studentId !== session.user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Check if attempt content is editable (centralized permission check)
        try {
            await assertAttemptContentEditable(id, {
                id: session.user.id,
                role: session.user.role as any // Session role matches UserRole
            })
        } catch (error) {
            if (error instanceof AttemptNotEditableError) {
                return NextResponse.json({ error: error.message }, { status: 403 })
            }
            throw error
        }

        // Check time window
        const now = new Date()
        if (now < attempt.exam.startAt) {
            return NextResponse.json({ error: "Exam has not started yet" }, { status: 400 })
        }
        if (attempt.exam.endAt && now > attempt.exam.endAt) {
            return NextResponse.json({ error: "Exam has ended" }, { status: 400 })
        }

        const body = await req.json()
        const { questionId, segmentId, content } = body

        if (!questionId || !segmentId || content === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Find or create Answer for this question
        let answer = await prisma.answer.findUnique({
            where: {
                attemptId_questionId: {
                    attemptId: id,
                    questionId
                }
            }
        })

        if (!answer) {
            answer = await prisma.answer.create({
                data: {
                    attemptId: id,
                    questionId
                }
            })
        }

        // Upsert AnswerSegment
        const answerSegment = await prisma.answerSegment.upsert({
            where: {
                answerId_segmentId: {
                    answerId: answer.id,
                    segmentId
                }
            },
            create: {
                answerId: answer.id,
                segmentId,
                content,
                autosavedAt: new Date()
            },
            update: {
                content,
                autosavedAt: new Date()
            }
        })

        return NextResponse.json({ success: true, answerSegment })

    } catch (error) {
        console.error("[API] Autosave Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

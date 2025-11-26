import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { recomputeAttemptStatus } from "@/lib/attemptStatus"

// POST /api/grades - Upsert a grade
export async function POST(req: NextRequest) {
    try {
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { answerId, score, feedback } = body

        if (!answerId || score === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        // Verify teacher access and fetch question with segments to get maxPoints
        const answer = await prisma.answer.findUnique({
            where: { id: answerId },
            include: {
                question: {
                    include: {
                        segments: {
                            select: { maxPoints: true }
                        }
                    }
                },
                attempt: {
                    include: {
                        exam: {
                            include: {
                                course: true
                            }
                        }
                    }
                }
            }
        })

        if (!answer) {
            return NextResponse.json({ error: "Answer not found" }, { status: 404 })
        }

        if (answer.attempt.exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Compute questionMaxPoints from segments
        const questionMaxPoints = answer.question.segments.reduce(
            (sum, segment) => sum + segment.maxPoints,
            0
        )

        if (!questionMaxPoints || questionMaxPoints <= 0) {
            return NextResponse.json({
                error: "Question has no maxPoints (segments missing or invalid)"
            }, { status: 400 })
        }

        // Parse and validate score
        const rawScore = Number(score)
        if (isNaN(rawScore)) {
            return NextResponse.json({ error: "Invalid score" }, { status: 400 })
        }

        // Clamp score between 0 and questionMaxPoints
        const clampedScore = Math.min(Math.max(rawScore, 0), questionMaxPoints)

        // Check if there's an existing grade to determine if this is an override
        const existingGrade = await prisma.grade.findUnique({
            where: { answerId: answerId }
        })

        // Determine if this is an override of an AI-generated grade
        const isOverridingAIGrade = existingGrade !== null && existingGrade.gradedByUserId === null

        // Upsert grade with clamped score
        const grade = await prisma.grade.upsert({
            where: {
                answerId: answerId
            },
            update: {
                score: clampedScore,
                feedback: feedback || null,
                gradedByUserId: session.user.id,
                isOverridden: isOverridingAIGrade || existingGrade?.isOverridden || false
            },
            create: {
                answerId: answerId,
                score: clampedScore,
                feedback: feedback || null,
                gradedByUserId: session.user.id,
                isOverridden: false
            }
        })

        // Update attempt status using centralized logic
        await recomputeAttemptStatus(answer.attemptId)

        return NextResponse.json({ success: true, grade })

    } catch (error) {
        console.error("[API] Save Grade Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

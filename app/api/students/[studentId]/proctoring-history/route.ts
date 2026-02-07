import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { analyzeFocusLossPatterns, analyzeExternalPastes, computeEnhancedAntiCheatScore } from "@/lib/proctoring/patternAnalysis"
import { analyzeCopyPasteEvents } from "@/lib/antiCheat"

// GET /api/students/[studentId]/proctoring-history
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    try {
        const { studentId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch all attempts for this student that have proctor events
        const attempts = await prisma.attempt.findMany({
            where: {
                studentId,
                proctorEvents: { some: {} }
            },
            include: {
                exam: {
                    select: {
                        id: true,
                        title: true,
                        course: {
                            select: {
                                code: true,
                                institutionId: true
                            }
                        }
                    }
                },
                proctorEvents: {
                    select: {
                        type: true,
                        timestamp: true,
                        metadata: true
                    },
                    orderBy: { timestamp: 'asc' }
                },
                answers: {
                    select: {
                        questionId: true,
                        segments: {
                            select: { autosavedAt: true }
                        }
                    }
                }
            },
            orderBy: { startedAt: 'desc' }
        })

        // Filter to same institution as teacher
        const filteredAttempts = attempts.filter(
            a => a.exam.course.institutionId === session.user.institutionId
        )

        const history = filteredAttempts.map(attempt => {
            const eventCounts: Record<string, number> = {}
            attempt.proctorEvents.forEach(event => {
                eventCounts[event.type] = (eventCounts[event.type] || 0) + 1
            })

            const answerTimestamps = attempt.answers.flatMap(answer =>
                answer.segments
                    .filter(segment => segment.autosavedAt !== null)
                    .map(segment => ({
                        questionId: answer.questionId,
                        savedAt: segment.autosavedAt!
                    }))
            )

            const focusLossPattern = analyzeFocusLossPatterns(attempt.proctorEvents, answerTimestamps)
            const externalPasteAnalysis = analyzeExternalPastes(attempt.proctorEvents)
            const copyPasteAnalysis = analyzeCopyPasteEvents(attempt.proctorEvents)

            const antiCheatScore = computeEnhancedAntiCheatScore({
                eventCounts,
                focusLossPattern,
                externalPasteAnalysis,
                copyPasteAnalysis
            })

            return {
                attemptId: attempt.id,
                examId: attempt.exam.id,
                examTitle: attempt.exam.title,
                courseCode: attempt.exam.course.code,
                date: attempt.startedAt.toISOString(),
                totalEvents: attempt.proctorEvents.length,
                antiCheatScore,
                focusLossFlag: focusLossPattern.flag
            }
        })

        return NextResponse.json({ history })
    } catch (error) {
        console.error("[API] Get Student Proctoring History Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

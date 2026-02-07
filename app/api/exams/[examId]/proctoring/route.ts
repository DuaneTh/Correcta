import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { analyzeCopyPasteEvents } from "@/lib/antiCheat"
import { getExamEndAt } from "@/lib/exam-time"
import { analyzeFocusLossPatterns, analyzeExternalPastes, computeEnhancedAntiCheatScore } from "@/lib/proctoring/patternAnalysis"

// GET /api/exams/[examId]/proctoring - Get proctoring summary for an exam
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Fetch exam to verify access
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        // Verify teacher belongs to same institution
        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // Fetch all attempts for this exam with proctor events and answer timestamps
        const attempts = await prisma.attempt.findMany({
            where: { examId },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                proctorEvents: {
                    select: {
                        type: true,
                        timestamp: true,
                        metadata: true
                    },
                    orderBy: {
                        timestamp: 'asc'
                    }
                },
                answers: {
                    select: {
                        questionId: true,
                        segments: {
                            select: {
                                autosavedAt: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                startedAt: 'desc'
            }
        })

        // Calculate deadline for each attempt
        const now = new Date()

        // Aggregate event counts and calculate suspicion scores
        const summary = attempts.map(attempt => {
            const eventCounts: Record<string, number> = {
                FOCUS_LOST: 0,
                FOCUS_GAINED: 0,
                TAB_SWITCH: 0,
                FULLSCREEN_EXIT: 0,
                COPY: 0,
                PASTE: 0
            }

            // Count events by type
            attempt.proctorEvents.forEach(event => {
                if (eventCounts.hasOwnProperty(event.type)) {
                    eventCounts[event.type]++
                } else {
                    eventCounts[event.type] = 1
                }
            })

            // Flatten answer timestamps
            const answerTimestamps = attempt.answers.flatMap(answer =>
                answer.segments
                    .filter(segment => segment.autosavedAt !== null)
                    .map(segment => ({
                        questionId: answer.questionId,
                        savedAt: segment.autosavedAt!
                    }))
            )

            // Analyze focus loss patterns
            const focusLossPattern = analyzeFocusLossPatterns(attempt.proctorEvents, answerTimestamps)

            // Analyze external pastes
            const externalPasteAnalysis = analyzeExternalPastes(attempt.proctorEvents)

            // Analyze COPY→PASTE pairs using shared helper for consistent scoring
            const copyPasteAnalysis = analyzeCopyPasteEvents(attempt.proctorEvents)

            // Calculate enhanced antiCheatScore with pattern analysis
            const antiCheatScore = computeEnhancedAntiCheatScore({
                eventCounts,
                focusLossPattern,
                externalPasteAnalysis,
                copyPasteAnalysis
            })

            // Calculate deadline and determine status
            const examEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
            const deadlineAt = examEndAt ?? new Date(attempt.startedAt.getTime() + (exam.durationMinutes || 60) * 60 * 1000)
            let attemptStatus: string

            if (attempt.submittedAt) {
                attemptStatus = 'submitted'
            } else if (now > deadlineAt) {
                attemptStatus = 'expired'
            } else {
                attemptStatus = 'in_progress'
            }

            return {
                attemptId: attempt.id,
                student: attempt.student,
                startedAt: attempt.startedAt.toISOString(),
                submittedAt: attempt.submittedAt?.toISOString() || null,
                status: attemptStatus,
                eventCounts,
                totalEvents: attempt.proctorEvents.length,
                antiCheatScore,
                focusLossPattern: {
                    flag: focusLossPattern.flag,
                    ratio: focusLossPattern.ratio,
                    suspiciousPairs: focusLossPattern.suspiciousPairs,
                    totalAnswers: focusLossPattern.totalAnswers
                },
                externalPastes: externalPasteAnalysis.externalPastes,
                internalPastes: externalPasteAnalysis.internalPastes
            }
        })

        // Sort by antiCheatScore descending
        summary.sort((a, b) => b.antiCheatScore - a.antiCheatScore)

        return NextResponse.json({ summary })

    } catch (error) {
        console.error("[API] Get Proctoring Summary Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

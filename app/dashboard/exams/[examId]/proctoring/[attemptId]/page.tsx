import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isTeacher } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { analyzeFocusLossPatterns, analyzeExternalPastes, computeEnhancedAntiCheatScore } from "@/lib/proctoring/patternAnalysis"
import { analyzeCopyPasteEvents } from "@/lib/antiCheat"
import ProctoringDetail from "./ProctoringDetail"

export const metadata: Metadata = {
    title: "Détails de proctoring | Correcta",
}

const asObjectRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }
    return value as Record<string, unknown>
}

interface ProctoringDetailPageProps {
    params: Promise<{
        examId: string
        attemptId: string
    }>
}

export default async function ProctoringDetailPage({ params }: ProctoringDetailPageProps) {
    const { examId, attemptId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/login")
    }

    if (!isTeacher(session)) {
        redirect("/dashboard")
    }

    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            student: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },
            exam: {
                include: {
                    course: {
                        select: {
                            code: true,
                            name: true,
                            institutionId: true
                        }
                    }
                }
            },
            proctorEvents: {
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
        }
    })

    if (!attempt) {
        notFound()
    }

    // Verify teacher belongs to same institution
    if (attempt.exam.course.institutionId !== session.user.institutionId) {
        redirect("/dashboard")
    }

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

    // Calculate event counts
    const eventCounts: Record<string, number> = {}
    attempt.proctorEvents.forEach(event => {
        eventCounts[event.type] = (eventCounts[event.type] || 0) + 1
    })

    // Analyze copy-paste pairs
    const copyPasteAnalysis = analyzeCopyPasteEvents(attempt.proctorEvents)

    // Calculate enhanced anti-cheat score
    const antiCheatScore = computeEnhancedAntiCheatScore({
        eventCounts,
        focusLossPattern,
        externalPasteAnalysis,
        copyPasteAnalysis
    })

    const serializedAttempt = {
        id: attempt.id,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() || null,
        status: attempt.status,
        student: attempt.student,
        exam: {
            id: attempt.exam.id,
            title: attempt.exam.title,
            course: attempt.exam.course
        },
        proctorEvents: attempt.proctorEvents.map(event => ({
            id: event.id,
            type: event.type,
            timestamp: event.timestamp.toISOString(),
            metadata: asObjectRecord(event.metadata)
        })),
        focusLossPattern: {
            flag: focusLossPattern.flag,
            ratio: focusLossPattern.ratio,
            suspiciousPairs: focusLossPattern.suspiciousPairs,
            totalAnswers: focusLossPattern.totalAnswers
        },
        externalPastes: externalPasteAnalysis.externalPastes,
        internalPastes: externalPasteAnalysis.internalPastes,
        antiCheatScore
    }

    return <ProctoringDetail attempt={serializedAttempt} examId={examId} />
}

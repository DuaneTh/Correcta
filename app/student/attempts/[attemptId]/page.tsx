
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import ExamRoomClient from "./ExamRoomClient"

export const metadata: Metadata = {
    title: "Passage d'examen | Correcta",
}

interface ExamRoomPageProps {
    params: Promise<{
        attemptId: string
    }>
}

export default async function ExamRoomPage({ params }: ExamRoomPageProps) {
    const { attemptId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
        redirect("/login")
    }

    if (!isStudent(session)) {
        redirect("/dashboard")
    }

    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            exam: {
                include: {
                    sections: {
                        include: {
                            questions: {
                                include: {
                                    segments: true
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
        notFound()
    }

    if (attempt.studentId !== session.user.id) {
        redirect("/dashboard")
    }

    if (attempt.status !== 'IN_PROGRESS') {
        redirect("/student/exams")
    }

    // Calculate deadline for this attempt
    const deadlineAt = new Date(attempt.startedAt.getTime() + attempt.exam.durationMinutes * 60 * 1000)
    const now = new Date()

    // If already past deadline, redirect
    if (now >= deadlineAt) {
        redirect("/student/exams")
    }

    // Transform data for client component if necessary, or pass as is if types match
    // We need to ensure the types match what ExamRoomClient expects.
    // The Prisma types are complex, so we might need to cast or map.
    // For now, we'll pass it and let TypeScript complain if there's a mismatch, 
    // but since we defined types in Client component loosely based on Prisma, it should be close.
    // However, dates need to be serialized if passing from server to client component in Next.js < 13.4+ (sometimes).
    // But usually it's fine. Let's map to be safe and clean.

    const examData = {
        id: attempt.exam.id,
        title: attempt.exam.title,
        durationMinutes: attempt.exam.durationMinutes,
        sections: attempt.exam.sections.map(s => ({
            id: s.id,
            title: s.title,
            order: s.order,
            questions: s.questions.map(q => ({
                id: q.id,
                content: q.content,
                type: q.type,
                order: q.order,
                segments: q.segments.map(seg => ({
                    id: seg.id,
                    questionId: seg.questionId,
                    instruction: seg.instruction,
                    maxPoints: seg.maxPoints
                }))
            }))
        }))
    }

    const attemptData = {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
        deadlineAt: deadlineAt.toISOString(),
        answers: attempt.answers.map(a => ({
            segments: a.segments.map(s => ({
                segmentId: s.segmentId,
                content: s.content
            }))
        }))
    }

    return <ExamRoomClient attempt={attemptData} exam={examData} />
}

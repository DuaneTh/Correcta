
import { Metadata } from "next"
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { buildAuthOptions } from "@/lib/auth"
import { isStudent } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import ExamRoomClient from "./ExamRoomClient"
import { getDictionary, getLocale } from "@/lib/i18n/server"
import { parseContent } from "@/lib/content"
import { getExamEndAt } from "@/lib/exam-time"
import { ensureAttemptNonce } from "@/lib/attemptIntegrity"
import type { StudentToolsConfig } from "@/types/exams"

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
        const role = session.user.role
        if (role === 'TEACHER') {
            redirect('/teacher/courses')
        }
        if (role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN') {
            redirect('/admin')
        }
        redirect('/login')
    }

    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            exam: {
                include: {
                    course: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
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
                    },
                    changes: {
                        orderBy: { createdAt: 'desc' }
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
        redirect("/student/exams")
    }

    // Students should not access attempts for DRAFT exams or exams without valid duration/start date
    const hasValidDuration = attempt.exam.durationMinutes !== null && attempt.exam.durationMinutes > 0
    const hasValidStartDate = attempt.exam.startAt !== null && attempt.exam.startAt > new Date('2000-01-01')
    if (attempt.exam.status === 'DRAFT' || !hasValidDuration || !hasValidStartDate) {
        redirect("/student/exams")
    }

    if (attempt.status !== 'IN_PROGRESS') {
        redirect("/student/exams")
    }

    // Calculate deadline for this attempt
    const durationMinutes = attempt.exam.durationMinutes ?? 0
    const examEndAt = getExamEndAt(attempt.exam.startAt, durationMinutes, attempt.exam.endAt)
    const deadlineAt = examEndAt ?? new Date(attempt.startedAt.getTime() + durationMinutes * 60 * 1000)
    const now = new Date()

    // If already past deadline, redirect
    if (now >= deadlineAt) {
        redirect("/student/exams")
    }

    const attemptNonce = await ensureAttemptNonce(attempt.id)

    // Transform data for client component if necessary, or pass as is if types match
    // We need to ensure the types match what ExamRoomClient expects.
    // The Prisma types are complex, so we might need to cast or map.
    // For now, we'll pass it and let TypeScript complain if there's a mismatch, 
    // but since we defined types in Client component loosely based on Prisma, it should be close.
    // However, dates need to be serialized if passing from server to client component in Next.js < 13.4+ (sometimes).
    // But usually it's fine. Let's map to be safe and clean.

    const locale = await getLocale()
    const examData = {
        id: attempt.exam.id,
        title: attempt.exam.title,
        startAt: attempt.exam.startAt?.toISOString() ?? null,
        durationMinutes: attempt.exam.durationMinutes,
        course: {
            code: attempt.exam.course.code,
            name: attempt.exam.course.name,
            teacherName: attempt.exam.author?.name ?? null,
        },
        author: attempt.exam.author
            ? {
                id: attempt.exam.author.id,
                name: attempt.exam.author.name,
                email: attempt.exam.author.email,
            }
            : null,
        requireHonorCommitment: attempt.exam.requireHonorCommitment,
        allowedMaterials: attempt.exam.allowedMaterials ?? null,
        antiCheatConfig: attempt.exam.antiCheatConfig
            ? (attempt.exam.antiCheatConfig as { webcamDeterrent?: boolean; browserLockdown?: boolean })
            : null,
        changes: attempt.exam.changes.map((change) => ({
            ...change,
            createdAt: change.createdAt.toISOString(),
        })),
        sections: attempt.exam.sections.map(s => ({
            id: s.id,
            title: s.title,
            order: s.order,
            isDefault: s.isDefault,
            customLabel: s.customLabel,
            introContent: parseContent(s.introContent),
            questions: s.questions.map(q => ({
                id: q.id,
                content: parseContent(q.content),
                answerTemplate: parseContent(q.answerTemplate),
                answerTemplateLocked: q.answerTemplateLocked,
                studentTools: (q.studentTools ?? null) as StudentToolsConfig | null,
                type: q.type,
                order: q.order,
                customLabel: q.customLabel,
                requireAllCorrect: q.requireAllCorrect,
                shuffleOptions: q.shuffleOptions,
                maxPoints: q.maxPoints,
                segments: q.segments.map(seg => ({
                    id: seg.id,
                    questionId: seg.questionId,
                    instruction: seg.instruction,
                    maxPoints: seg.maxPoints,
                    order: seg.order,
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
        honorStatementText: attempt.honorStatementText ?? null,
        nonce: attemptNonce,
        answers: attempt.answers.map(a => ({
            segments: a.segments.map(s => ({
                segmentId: s.segmentId,
                content: s.content
            }))
        }))
    }

    const dictionary = await getDictionary()

    return <ExamRoomClient attempt={attemptData} exam={examData} studentName={session.user.name} dictionary={dictionary} locale={locale} />
}

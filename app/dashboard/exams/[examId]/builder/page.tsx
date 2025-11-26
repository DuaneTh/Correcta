import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { buildAuthOptions } from "@/lib/auth"
import ExamBuilder from "@/components/exams/ExamBuilder"
import { redirect, notFound } from "next/navigation"

export default async function ExamBuilderPage({ params }: { params: Promise<{ examId: string }> }) {
    const { examId } = await params
    const authOptions = await buildAuthOptions()
    const session = await getServerSession(authOptions)

    console.log("[ExamBuilder] Session:", JSON.stringify(session, null, 2))

    // Check authentication
    if (!session?.user?.institutionId) {
        console.log("[ExamBuilder] Missing institutionId, redirecting to login")
        redirect('/login')
    }

    // Check role - only teachers and admins can build exams
    if (session.user.role === 'STUDENT') {
        redirect('/dashboard/exams')
    }

    // Fetch exam with full structure
    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
            course: {
                select: { code: true, name: true, institutionId: true }
            },
            sections: {
                include: {
                    questions: {
                        include: {
                            segments: {
                                include: {
                                    rubric: true
                                }
                            }
                        },
                        orderBy: { order: 'asc' }
                    }
                },
                orderBy: { order: 'asc' }
            }
        }
    })

    if (!exam) {
        redirect('/dashboard/exams')
    }

    // Calculate if exam is locked (T-10 rule)
    const now = new Date()
    const lockTime = exam.startAt ? new Date(exam.startAt.getTime() - 10 * 60 * 1000) : null
    const isLocked = !!(lockTime && now >= lockTime)


    const serializedExam = {
        ...exam,
        startAt: exam.startAt.toISOString(),
        sections: exam.sections.map(section => ({
            ...section,
            questions: section.questions.map(question => ({
                ...question,
                segments: question.segments.map(segment => ({
                    ...segment,
                    rubric: segment.rubric ? {
                        ...segment.rubric,
                        criteria: segment.rubric.criteria || '',
                        levels: segment.rubric.levels as any,
                        examples: segment.rubric.examples as any
                    } : undefined
                }))
            }))
        }))
    }

    return <ExamBuilder examId={examId} initialData={serializedExam} isLocked={isLocked} />
}

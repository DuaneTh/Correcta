import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { aiGradingQueue } from "@/lib/queue"
import { getAllowedOrigins, getCsrfCookieName, verifyCsrf } from "@/lib/csrf"
import { generateRubric } from "@/lib/grading/rubric-generator"
import { segmentsToLatexString, parseContent } from "@/lib/content"

// POST /api/exams/[examId]/grade-all - Enqueue batch grading for all answers
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // 1. Auth check: Teacher only
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: req.cookies.get(getCsrfCookieName())?.value,
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // 3. Verify teacher has access to exam (same institution)
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                },
                sections: {
                    include: {
                        questions: {
                            where: { type: 'TEXT' }, // Only TEXT questions need AI grading
                            include: {
                                segments: {
                                    select: {
                                        id: true,
                                        instruction: true,
                                        maxPoints: true,
                                        rubric: {
                                            select: { criteria: true }
                                        }
                                    },
                                    orderBy: { order: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: "Exam not found" }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
        }

        // 4. Check queue availability
        // Note: Queue-based grading requires Redis + worker process running separately
        // Default to indicating queue not available so frontend uses sync grading
        // To enable queue-based grading, set ENABLE_GRADING_QUEUE=true
        const useQueue = process.env.ENABLE_GRADING_QUEUE === 'true' && aiGradingQueue

        if (!useQueue) {
            return NextResponse.json({
                error: "QUEUE_NOT_AVAILABLE",
                message: "Queue grading not enabled. Using synchronous grading."
            }, { status: 500 })
        }

        // 5. Fetch all submitted attempts with their answers
        const attempts = await prisma.attempt.findMany({
            where: {
                examId,
                status: { in: ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'] }
            },
            include: {
                answers: {
                    include: {
                        question: {
                            select: { type: true }
                        },
                        grades: {
                            select: {
                                gradedByUserId: true,
                                isOverridden: true
                            }
                        }
                    }
                }
            }
        })

        // 6. Filter answers: only TEXT questions without human grades
        const answersToGrade: { attemptId: string; answerId: string; questionId: string }[] = []

        for (const attempt of attempts) {
            for (const answer of attempt.answers) {
                // Skip non-TEXT questions (MCQ is auto-scored)
                if (answer.question.type !== 'TEXT') continue

                // Skip if grade exists and is human (gradedByUserId not null OR isOverridden)
                const hasHumanGrade = answer.grades.length > 0 &&
                    (answer.grades[0].gradedByUserId !== null || answer.grades[0].isOverridden)
                if (hasHumanGrade) continue

                answersToGrade.push({
                    attemptId: attempt.id,
                    answerId: answer.id,
                    questionId: answer.questionId
                })
            }
        }

        // 7. For each TEXT question, ensure rubric exists (generate if needed)
        const questions = exam.sections.flatMap(s => s.questions)
        const questionMap = new Map(questions.map(q => [q.id, q]))
        const questionIds = [...new Set(answersToGrade.map(a => a.questionId))]

        for (const questionId of questionIds) {
            const question = questionMap.get(questionId)
            if (!question) continue

            // Check if rubric already exists
            const existingRubric = await prisma.question.findUnique({
                where: { id: questionId },
                select: { generatedRubric: true, content: true, segments: true }
            })

            if (!existingRubric?.generatedRubric) {
                // Generate rubric for this question
                const questionContent = segmentsToLatexString(parseContent(existingRubric?.content))

                // Get correction guidelines from segments
                const correctionGuidelines = question.segments
                    .filter(s => s.rubric?.criteria)
                    .map(s => s.rubric!.criteria)
                    .join('\n') || null

                // Calculate max points from segments
                const maxPoints = question.segments.reduce(
                    (sum, s) => sum + (s.maxPoints || 0),
                    0
                ) || 10

                try {
                    const rubric = await generateRubric({
                        questionContent,
                        correctionGuidelines,
                        maxPoints
                    })

                    // Store generated rubric
                    await prisma.question.update({
                        where: { id: questionId },
                        data: { generatedRubric: rubric }
                    })
                } catch (error) {
                    console.error(`[Grade All] Failed to generate rubric for question ${questionId}:`, error)
                    // Continue without rubric - worker will handle fallback
                }
            }
        }

        // 8. Enqueue all answer grading jobs
        const jobs = answersToGrade.map(answer => ({
            name: 'grade-answer',
            data: {
                attemptId: answer.attemptId,
                answerId: answer.answerId,
                questionId: answer.questionId
            }
        }))

        if (jobs.length > 0) {
            await aiGradingQueue!.addBulk(jobs)

            // Update attempt statuses to GRADING_IN_PROGRESS
            const attemptIds = [...new Set(answersToGrade.map(a => a.attemptId))]
            await prisma.attempt.updateMany({
                where: {
                    id: { in: attemptIds },
                    status: 'SUBMITTED'
                },
                data: { status: 'GRADING_IN_PROGRESS' }
            })
        }

        return NextResponse.json({
            batchId: examId,
            totalJobs: jobs.length,
            enqueuedCount: jobs.length,
            totalAttempts: attempts.length
        })

    } catch (error) {
        console.error("[API] Grade All Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

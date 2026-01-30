import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession, isTeacher } from "@/lib/api-auth"
import { getAllowedOrigins, getCsrfCookieToken, verifyCsrf } from "@/lib/csrf"
import { generateRubric } from "@/lib/grading/rubric-generator"
import { gradeAnswer } from "@/lib/grading/grader"
import { segmentsToLatexString, parseContent } from "@/lib/content"
import { recomputeAttemptStatus } from "@/lib/attemptStatus"
import type { ContentSegment } from "@/types/exams"

/**
 * POST /api/exams/[examId]/grade-sync
 *
 * Synchronous grading - grades all answers immediately without requiring
 * Redis queue or worker. Useful for small batches or when queue is unavailable.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        // 1. Auth check
        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // 2. CSRF check
        const csrfResult = verifyCsrf({
            req,
            cookieToken: getCsrfCookieToken(req),
            headerToken: req.headers.get('x-csrf-token'),
            allowedOrigins: getAllowedOrigins()
        })
        if (!csrfResult.ok) {
            return NextResponse.json({ error: "CSRF" }, { status: 403 })
        }

        // 3. Verify teacher has access to exam
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: {
                    select: { institutionId: true, archivedAt: true }
                },
                sections: {
                    include: {
                        questions: {
                            where: { type: 'TEXT' },
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

        // 4. Fetch all submitted attempts with their answers
        const attempts = await prisma.attempt.findMany({
            where: {
                examId,
                status: { in: ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'] }
            },
            include: {
                answers: {
                    include: {
                        question: {
                            select: { type: true, id: true, content: true },
                        },
                        segments: true,
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

        // 5. Filter answers needing grading
        const answersToGrade: Array<{
            attemptId: string
            answerId: string
            questionId: string
            answer: typeof attempts[0]['answers'][0]
        }> = []

        for (const attempt of attempts) {
            for (const answer of attempt.answers) {
                if (answer.question.type !== 'TEXT') continue

                const hasHumanGrade = answer.grades.length > 0 &&
                    (answer.grades[0].gradedByUserId !== null || answer.grades[0].isOverridden)
                if (hasHumanGrade) continue

                answersToGrade.push({
                    attemptId: attempt.id,
                    answerId: answer.id,
                    questionId: answer.questionId,
                    answer
                })
            }
        }

        if (answersToGrade.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No answers to grade",
                gradedCount: 0
            })
        }

        // 6. Update attempts to GRADING_IN_PROGRESS
        const attemptIds = [...new Set(answersToGrade.map(a => a.attemptId))]
        await prisma.attempt.updateMany({
            where: {
                id: { in: attemptIds },
                status: 'SUBMITTED'
            },
            data: { status: 'GRADING_IN_PROGRESS' }
        })

        // 7. Process each answer synchronously
        const questions = exam.sections.flatMap(s => s.questions)
        const questionMap = new Map(questions.map(q => [q.id, q]))
        const rubricCache = new Map<string, string>()

        let gradedCount = 0
        const errors: Array<{ answerId: string; error: string }> = []

        for (const item of answersToGrade) {
            try {
                const question = questionMap.get(item.questionId)
                if (!question) {
                    errors.push({ answerId: item.answerId, error: "Question not found" })
                    continue
                }

                // Get or generate rubric
                let rubricString = rubricCache.get(item.questionId)

                if (!rubricString) {
                    const questionWithRubric = await prisma.question.findUnique({
                        where: { id: item.questionId },
                        select: { generatedRubric: true, content: true }
                    })

                    if (questionWithRubric?.generatedRubric) {
                        rubricString = JSON.stringify(questionWithRubric.generatedRubric)
                    } else {
                        // Generate rubric
                        const questionContent = segmentsToLatexString(parseContent(questionWithRubric?.content))
                        const correctionGuidelines = question.segments
                            .filter(s => s.rubric?.criteria)
                            .map(s => s.rubric!.criteria)
                            .join('\n') || null

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

                            await prisma.question.update({
                                where: { id: item.questionId },
                                data: { generatedRubric: rubric }
                            })

                            rubricString = JSON.stringify(rubric)
                        } catch (rubricError) {
                            rubricString = `Points maximum: ${maxPoints}. Evaluer la justesse et la completude de la reponse.`
                        }
                    }

                    rubricCache.set(item.questionId, rubricString)
                }

                // Compute maxPoints
                const maxPoints = question.segments.reduce(
                    (sum, s) => sum + (s.maxPoints || 0),
                    0
                ) || 10

                // Get question content
                const questionContentSegments = parseContent(item.answer.question.content) as ContentSegment[]
                const questionContent = segmentsToLatexString(questionContentSegments)

                // Get student answer
                const answerContentSegments = item.answer.segments.map(seg => {
                    const parsed = parseContent(seg.content) as ContentSegment[]
                    return parsed
                }).flat()
                const studentAnswer = segmentsToLatexString(answerContentSegments)

                // Grade the answer
                const gradingResult = await gradeAnswer({
                    question: questionContent,
                    rubric: rubricString,
                    studentAnswer: studentAnswer || '(Aucune reponse)',
                    maxPoints
                })

                // Save grade
                await prisma.grade.upsert({
                    where: { answerId: item.answerId },
                    update: {
                        score: gradingResult.score,
                        feedback: gradingResult.feedback,
                        aiRationale: gradingResult.aiRationale,
                        gradedByUserId: null,
                        isOverridden: false
                    },
                    create: {
                        answerId: item.answerId,
                        score: gradingResult.score,
                        feedback: gradingResult.feedback,
                        aiRationale: gradingResult.aiRationale,
                        gradedByUserId: null,
                        isOverridden: false
                    }
                })

                gradedCount++
            } catch (error) {
                console.error(`[Grade Sync] Error grading answer ${item.answerId}:`, error)
                errors.push({
                    answerId: item.answerId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                })
            }
        }

        // 8. Update attempt statuses
        for (const attemptId of attemptIds) {
            await recomputeAttemptStatus(attemptId)
        }

        return NextResponse.json({
            success: true,
            gradedCount,
            totalAnswers: answersToGrade.length,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error) {
        console.error("[API] Grade Sync Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

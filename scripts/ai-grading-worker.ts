/* eslint-disable @typescript-eslint/no-unused-vars */
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { recomputeAttemptStatus } from '../lib/attemptStatus'
import { gradeAnswer } from '../lib/grading/grader'
import { segmentsToLatexString, parseContent } from '../lib/content'
import { isOpenAIConfigured, isOpenAIConfiguredSync } from '../lib/grading/openai-client'
import type { ContentSegment } from '@/types/exams'
import type { Rubric } from '../lib/grading/schemas'

/**
 * AI Grading Worker
 *
 * Consumes jobs from 'ai-grading' queue.
 * Uses GPT-4 to grade student answers with personalized feedback.
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('[AI Worker] Starting worker...')
console.log(`[AI Worker] Connecting to Redis at ${redisUrl}`)

if (!isOpenAIConfiguredSync()) {
    console.warn('[AI Worker] WARNING: OPENAI_API_KEY is not configured in environment. Will check database on first job.')
}

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
    }
})

connection.on('error', (error) => {
    console.error('[AI Worker] Redis connection error:', error.message)
})

connection.on('connect', () => {
    console.log('[AI Worker] Redis connected successfully')
})

const worker = new Worker('ai-grading', async (job: Job) => {
    try {
        if (job.name === 'grade-answer') {
            const { attemptId, answerId, questionId } = job.data
            console.log(`[AI Worker] Processing grading for attempt ${attemptId}, question ${questionId}, answer ${answerId}`)

            // 1. Fetch Answer with Question Segments, generatedRubric, and answer segments
            const answer = await prisma.answer.findUnique({
                where: { id: answerId },
                include: {
                    question: {
                        include: {
                            segments: {
                                include: {
                                    rubric: true
                                },
                                orderBy: { order: 'asc' }
                            }
                        }
                    },
                    segments: true,
                    attempt: true
                }
            })

            if (!answer) {
                console.error(`[AI Worker] Answer ${answerId} not found, skipping.`)
                return
            }

            // 2. Compute maxPoints
            const maxPoints = answer.question.segments.reduce(
                (sum, segment) => sum + (segment.maxPoints ?? 0),
                0
            )

            if (!maxPoints || maxPoints <= 0) {
                console.warn(`[AI Worker] Question has no valid maxPoints, skipping answerId=${answerId}`)
                return
            }

            // 3. Check for existing human grade (skip if present)
            const existingGrade = await prisma.grade.findUnique({
                where: { answerId: answerId }
            })

            // Skip if human grade present (gradedByUserId not null OR isOverridden = true)
            if (existingGrade && (existingGrade.gradedByUserId !== null || existingGrade.isOverridden)) {
                console.log(`[AI Worker] Skip AI grading for answer ${answerId} (human grade present or overridden)`)
                return // Skip this answer, don't update the grade
            }

            // 4. Convert question content to string
            const questionContentSegments = parseContent(answer.question.content) as ContentSegment[]
            const questionContent = segmentsToLatexString(questionContentSegments)

            // 5. Convert student answer segments to string
            const answerContentSegments = answer.segments.map(seg => {
                const parsed = parseContent(seg.content) as ContentSegment[]
                return parsed
            }).flat()
            const studentAnswer = segmentsToLatexString(answerContentSegments)

            // 6. Get rubric - prefer generatedRubric, fallback to segment rubric criteria
            let rubricString: string

            // First try to fetch the question with generatedRubric directly
            const questionWithRubric = await prisma.question.findUnique({
                where: { id: answer.question.id },
                select: { generatedRubric: true }
            })

            if (questionWithRubric?.generatedRubric) {
                // Use generated rubric
                rubricString = JSON.stringify(questionWithRubric.generatedRubric)
                console.log(`[AI Worker] Using generated rubric for question ${answer.question.id}`)
            } else {
                // Fallback to segment rubric criteria
                const correctionGuidelines = answer.question.segments
                    .filter(s => s.rubric?.criteria)
                    .map(s => s.rubric!.criteria)
                    .filter(Boolean)
                    .join('\n\n')

                if (correctionGuidelines) {
                    rubricString = correctionGuidelines
                    console.log(`[AI Worker] Using segment correction guidelines for question ${answer.question.id}`)
                } else {
                    // No rubric available - create a simple default
                    rubricString = `Points maximum: ${maxPoints}. Evaluer la justesse et la completude de la reponse.`
                    console.log(`[AI Worker] No rubric found, using default guidelines for question ${answer.question.id}`)
                }
            }

            // 7. Call GPT-4 for grading
            console.log(`[AI Worker] Calling GPT-4 for grading answer ${answerId}...`)

            const gradingResult = await gradeAnswer({
                question: questionContent,
                rubric: rubricString,
                studentAnswer: studentAnswer || '(Aucune reponse)',
                maxPoints: maxPoints
            })

            console.log(`[AI Worker] GPT-4 returned score ${gradingResult.score}/${maxPoints}`)

            // 8. Upsert Grade with AI results
            await prisma.grade.upsert({
                where: {
                    answerId: answerId
                },
                update: {
                    score: gradingResult.score,
                    feedback: gradingResult.feedback,
                    aiRationale: gradingResult.aiRationale,
                    gradedByUserId: null,
                    isOverridden: false
                },
                create: {
                    answerId: answerId,
                    score: gradingResult.score,
                    feedback: gradingResult.feedback,
                    aiRationale: gradingResult.aiRationale,
                    gradedByUserId: null,
                    isOverridden: false
                }
            })

            console.log(`[AI Worker] Graded answer ${answerId} with score ${gradingResult.score}/${maxPoints} (attempt ${attemptId})`)

            // 9. Update attempt status using centralized logic
            await recomputeAttemptStatus(answer.attemptId)
            console.log(`[AI Worker] Updated attempt ${attemptId} status via recomputeAttemptStatus`)

        } else {
            console.log(`[AI Worker] Unknown job name: ${job.name}`)
        }
    } catch (error) {
        console.error(`[AI Worker] Job ${job.id} failed:`, error)
        // Let BullMQ retry logic handle transient failures
        throw error
    }
}, {
    connection,
    concurrency: 5
})

worker.on('completed', (job) => {
    console.log(`[AI Worker] Job ${job.id} completed successfully`)
})

worker.on('failed', (job, err) => {
    console.error(`[AI Worker] Job ${job?.id} has failed with ${err.message}`)
})

// Graceful shutdown
const shutdown = async () => {
    console.log('[AI Worker] Shutting down...')
    await worker.close()
    await connection.quit()
    console.log('[AI Worker] Shutdown complete')
    process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

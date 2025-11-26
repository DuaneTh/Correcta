import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { recomputeAttemptStatus } from '../lib/attemptStatus'

/**
 * AI Grading Worker Stub
 * 
 * Consumes jobs from 'ai-grading' queue.
 * Fetches data, stubs a grade, and updates attempt status.
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('[AI Worker] Starting worker...')
console.log(`[AI Worker] Connecting to Redis at ${redisUrl}`)

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
            // console.log(`[AI Worker] Processing grading for attempt ${attemptId}, question ${questionId}, answer ${answerId}`)

            // 1. Fetch Answer with Question Segments and Attempt
            const answer = await prisma.answer.findUnique({
                where: { id: answerId },
                include: {
                    question: {
                        include: {
                            segments: true
                        }
                    },
                    attempt: true
                }
            })

            if (!answer) {
                console.error(`[AI Worker] Answer ${answerId} not found, skipping.`)
                return
            }

            // 2. Compute maxPoints
            const maxPoints = answer.question.segments.reduce(
                (sum, segment) => sum + segment.maxPoints,
                0
            )

            if (!maxPoints || maxPoints <= 0) {
                console.warn(`[AI Worker] Question has no valid maxPoints, skipping answerId=${answerId}`)
                return
            }

            // 3. Stub AI Score (70% of maxPoints)
            const rawScore = maxPoints * 0.7
            const clampedScore = Math.min(maxPoints, Math.max(0, rawScore))
            const feedback = "Correction automatique (stub IA) – à vérifier."
            const aiRationale = "Stub only – no real AI model was called."

            // 4. Check for existing human grade (skip if present)
            const existingGrade = await prisma.grade.findUnique({
                where: { answerId: answerId }
            })

            // Skip if human grade present (gradedByUserId not null OR isOverridden = true)
            if (existingGrade && (existingGrade.gradedByUserId !== null || existingGrade.isOverridden)) {
                console.log(`[AI Worker] Skip AI grading for answer ${answerId} (human grade present or overridden)`)
                return // Skip this answer, don't update the grade
            }

            // 5. Upsert Grade (only if no human grade exists)
            await prisma.grade.upsert({
                where: {
                    answerId: answerId
                },
                update: {
                    score: clampedScore,
                    feedback: feedback,
                    aiRationale: aiRationale,
                    gradedByUserId: null,
                    isOverridden: false
                },
                create: {
                    answerId: answerId,
                    score: clampedScore,
                    feedback: feedback,
                    aiRationale: aiRationale,
                    gradedByUserId: null,
                    isOverridden: false
                }
            })

            console.log(`[AI Worker] Stub-graded answer ${answerId} with score ${clampedScore}/${maxPoints} (attempt ${attemptId})`)

            // 5. Update attempt status using centralized logic
            await recomputeAttemptStatus(answer.attemptId)
            console.log(`[AI Worker] Updated attempt ${attemptId} status via recomputeAttemptStatus`)

        } else {
            console.log(`[AI Worker] Unknown job name: ${job.name}`)
        }
    } catch (error) {
        console.error(`[AI Worker] Job ${job.id} failed:`, error)
        throw error
    }
}, {
    connection,
    concurrency: 5
})

worker.on('completed', (job) => {
    // console.log(`[AI Worker] Job ${job.id} has completed!`)
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

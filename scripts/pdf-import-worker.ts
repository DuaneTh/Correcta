/* eslint-disable @typescript-eslint/no-unused-vars */
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { extractExamFromPDF } from '@/lib/exam-import/extractor'
import { isOpenAIConfiguredSync } from '@/lib/grading/openai-client'
import type { ExtractedQuestion } from '@/lib/exam-import/schemas'

/**
 * PDF Import Worker
 *
 * Consumes jobs from 'pdf-import' queue.
 * Uses GPT-4o to extract exam structure from PDF documents.
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('[PDF Import Worker] Starting worker...')
console.log(`[PDF Import Worker] Connecting to Redis at ${redisUrl}`)

if (!isOpenAIConfiguredSync()) {
    console.warn('[PDF Import Worker] WARNING: OPENAI_API_KEY is not configured in environment. Will check database on first job.')
}

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
    }
})

connection.on('error', (error) => {
    console.error('[PDF Import Worker] Redis connection error:', error.message)
})

connection.on('connect', () => {
    console.log('[PDF Import Worker] Redis connected successfully')
})

const worker = new Worker('pdf-import', async (job: Job) => {
    try {
        if (job.name === 'import-exam') {
            const { userId, pdfKey, institutionId, courseId } = job.data
            console.log(`[PDF Import Worker] Processing import for PDF ${pdfKey}`)

            // 1. Call GPT-4o to extract exam structure from PDF
            console.log(`[PDF Import Worker] Calling GPT-4o for PDF extraction...`)
            const extracted = await extractExamFromPDF({ pdfKey, userId })

            console.log(`[PDF Import Worker] Extracted ${extracted.questions.length} questions from PDF`)
            console.log(`[PDF Import Worker] Confidence: ${extracted.metadata.confidence}`)
            if (extracted.metadata.warnings.length > 0) {
                console.log(`[PDF Import Worker] Warnings: ${extracted.metadata.warnings.join(', ')}`)
            }

            // 2. Create exam in database
            const exam = await prisma.exam.create({
                data: {
                    title: extracted.title,
                    courseId: courseId,
                    status: 'DRAFT',
                    authorId: userId,
                    sections: {
                        create: {
                            title: '__DEFAULT__',
                            isDefault: true,
                            order: 0
                        }
                    }
                },
                include: {
                    sections: true
                }
            })

            const defaultSection = exam.sections[0]

            console.log(`[PDF Import Worker] Created exam ${exam.id} with default section ${defaultSection.id}`)

            // 3. Create questions and segments
            for (let i = 0; i < extracted.questions.length; i++) {
                const q = extracted.questions[i]

                // Prepare content in ContentSegments format (JSON string array of {type, text} objects)
                const contentSegments = JSON.stringify([
                    { type: 'text', text: q.content }
                ])

                if (q.type === 'TEXT') {
                    // Create TEXT question with single segment
                    const question = await prisma.question.create({
                        data: {
                            sectionId: defaultSection.id,
                            content: contentSegments,
                            type: 'TEXT',
                            order: i,
                            generatedRubric: q.correctionGuidelines
                                ? { criteria: q.correctionGuidelines }
                                : undefined,
                            segments: {
                                create: {
                                    instruction: q.content,
                                    maxPoints: q.maxPoints,
                                    order: 0
                                }
                            }
                        }
                    })

                    console.log(`[PDF Import Worker] Created TEXT question ${question.id} (Q${q.questionNumber})`)
                } else if (q.type === 'MCQ' && q.choices) {
                    // Create MCQ question with segments for each choice
                    const question = await prisma.question.create({
                        data: {
                            sectionId: defaultSection.id,
                            content: contentSegments,
                            type: 'MCQ',
                            order: i,
                            generatedRubric: q.correctionGuidelines
                                ? { criteria: q.correctionGuidelines }
                                : undefined,
                            segments: {
                                create: q.choices.map((choice, choiceIndex) => ({
                                    instruction: choice.text,
                                    isCorrect: choice.isCorrect,
                                    order: choiceIndex,
                                    maxPoints: null // MCQ choices don't have individual maxPoints
                                }))
                            }
                        }
                    })

                    console.log(`[PDF Import Worker] Created MCQ question ${question.id} with ${q.choices.length} options (Q${q.questionNumber})`)
                }
            }

            console.log(`[PDF Import Worker] Successfully imported exam ${exam.id}`)

            // Return job result
            return {
                examId: exam.id,
                questionCount: extracted.questions.length,
                confidence: extracted.metadata.confidence,
                warnings: extracted.metadata.warnings
            }
        } else {
            console.log(`[PDF Import Worker] Unknown job name: ${job.name}`)
        }
    } catch (error) {
        console.error(`[PDF Import Worker] Job ${job.id} failed:`, error)
        // Let BullMQ retry logic handle transient failures
        throw error
    }
}, {
    connection,
    concurrency: 1 // PDF extraction is CPU/API intensive
})

worker.on('completed', (job) => {
    console.log(`[PDF Import Worker] Job ${job.id} completed successfully`)
})

worker.on('failed', (job, err) => {
    console.error(`[PDF Import Worker] Job ${job?.id} has failed with ${err.message}`)
})

// Graceful shutdown
const shutdown = async () => {
    console.log('[PDF Import Worker] Shutting down...')
    await worker.close()
    await connection.quit()
    console.log('[PDF Import Worker] Shutdown complete')
    process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

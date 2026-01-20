/* eslint-disable @typescript-eslint/no-unused-vars */
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { AttemptStatus, Prisma } from '@prisma/client'
import { ExportDocument, AttemptExportData, QuestionExportData } from '@/lib/export/pdf-generator'
import fs from 'fs/promises'
import path from 'path'
import React from 'react'

/**
 * Export Worker
 *
 * Consumes jobs from 'export' queue.
 * Generates PDF reports asynchronously.
 */

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(process.cwd(), 'tmp', 'exports')

console.log('[Export Worker] Starting worker...')
console.log(`[Export Worker] Connecting to Redis at ${redisUrl}`)
console.log(`[Export Worker] Export directory: ${EXPORT_DIR}`)

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
    }
})

connection.on('error', (error) => {
    console.error('[Export Worker] Redis connection error:', error.message)
})

connection.on('connect', () => {
    console.log('[Export Worker] Redis connected successfully')
})

// Ensure export directory exists
async function ensureExportDir() {
    try {
        await fs.mkdir(EXPORT_DIR, { recursive: true })
    } catch (error) {
        console.error('[Export Worker] Failed to create export directory:', error)
    }
}

ensureExportDir()

interface ExportJobData {
    examId: string
    classIds?: string[]
    type: 'pdf'
    requestedBy: string  // User ID for access control
}

const worker = new Worker('export', async (job: Job<ExportJobData>) => {
    const { examId, classIds, type, requestedBy } = job.data
    console.log(`[Export Worker] Processing ${type} export for exam ${examId}`)

    if (type === 'pdf') {
        // 1. Fetch exam data
        await job.updateProgress({ phase: 'loading', current: 0, total: 100 })

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sections: {
                    include: {
                        questions: {
                            include: {
                                segments: { select: { maxPoints: true } }
                            },
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        })

        if (!exam) {
            throw new Error('Exam not found')
        }

        // 2. Build where clause with optional class filter
        const whereClause: Prisma.AttemptWhereInput = {
            examId,
            status: { in: [AttemptStatus.GRADED, AttemptStatus.SUBMITTED] }
        }

        if (classIds && classIds.length > 0) {
            const allClassIds = await getClassIdsWithChildren(classIds)
            whereClause.student = {
                enrollments: {
                    some: { classId: { in: allClassIds } }
                }
            }
        }

        // 3. Fetch attempts
        const attempts = await prisma.attempt.findMany({
            where: whereClause,
            include: {
                student: { select: { name: true, email: true } },
                answers: {
                    include: {
                        grades: { select: { score: true, feedback: true } },
                        question: {
                            include: {
                                section: { select: { order: true } },
                                segments: { select: { maxPoints: true } }
                            }
                        },
                        segments: { select: { content: true } }
                    }
                }
            },
            orderBy: { student: { name: 'asc' } }
        })

        await job.updateProgress({ phase: 'processing', current: 10, total: 100 })

        // 4. Build question order map
        const questions = exam.sections.flatMap((s, sIdx) =>
            s.questions.map(q => ({
                id: q.id,
                order: q.order,
                sectionOrder: sIdx + 1,
                content: q.content,
                maxPoints: q.segments.reduce((sum, seg) => sum + (seg.maxPoints ?? 0), 0)
            }))
        )

        // 5. Transform attempts to export data
        const totalAttempts = attempts.length
        const exportAttempts: AttemptExportData[] = []

        for (let i = 0; i < attempts.length; i++) {
            const attempt = attempts[i]

            // Calculate progress (10-80% for processing)
            const progressPct = 10 + Math.round((i / totalAttempts) * 70)
            await job.updateProgress({ phase: 'processing', current: progressPct, total: 100, processed: i + 1, totalAttempts })

            // Build question data
            const questionData: QuestionExportData[] = questions.map(q => {
                const answer = attempt.answers.find(a => a.questionId === q.id)
                const answerContent = answer?.segments.map(s => s.content).join('\n') || ''
                const grade = answer?.grades[0]

                return {
                    id: q.id,
                    order: q.order,
                    sectionOrder: q.sectionOrder,
                    content: q.content,
                    maxPoints: q.maxPoints,
                    studentAnswer: answerContent,
                    score: grade?.score ?? null,
                    feedback: grade?.feedback ?? null
                }
            })

            // Calculate total score
            const totalScore = questionData.reduce((sum, q) => sum + (q.score ?? 0), 0)
            const maxPoints = questions.reduce((sum, q) => sum + q.maxPoints, 0)

            exportAttempts.push({
                id: attempt.id,
                student: {
                    name: attempt.student.name || 'Etudiant',
                    email: attempt.student.email || ''
                },
                submittedAt: attempt.submittedAt?.toISOString() ?? null,
                totalScore,
                maxPoints,
                questions: questionData
            })
        }

        await job.updateProgress({ phase: 'generating', current: 80, total: 100 })

        // 6. Generate PDF
        console.log(`[Export Worker] Generating PDF for ${exportAttempts.length} attempts...`)

        const documentElement = React.createElement(ExportDocument, {
            exam: { title: exam.title, description: exam.description },
            attempts: exportAttempts,
            generatedAt: new Date().toISOString()
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(documentElement as any)

        await job.updateProgress({ phase: 'saving', current: 95, total: 100 })

        // 7. Save to file
        const filename = `rapport-${exam.title.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.pdf`
        const filepath = path.join(EXPORT_DIR, filename)

        await fs.writeFile(filepath, pdfBuffer)

        console.log(`[Export Worker] PDF saved to ${filepath} (${pdfBuffer.length} bytes)`)

        await job.updateProgress({ phase: 'complete', current: 100, total: 100 })

        return {
            filename,
            filepath,
            size: pdfBuffer.length,
            attemptCount: exportAttempts.length
        }
    }

    throw new Error(`Unknown export type: ${type}`)
}, {
    connection,
    concurrency: 2  // Max 2 concurrent exports
})

worker.on('completed', (job, result) => {
    console.log(`[Export Worker] Job ${job.id} completed:`, result)
})

worker.on('failed', (job, err) => {
    console.error(`[Export Worker] Job ${job?.id} failed:`, err.message)
})

// Helper function
async function getClassIdsWithChildren(classIds: string[]): Promise<string[]> {
    const classes = await prisma.class.findMany({
        where: {
            OR: [
                { id: { in: classIds } },
                { parentId: { in: classIds } }
            ]
        },
        select: { id: true }
    })
    return classes.map(c => c.id)
}

// Graceful shutdown
const shutdown = async () => {
    console.log('[Export Worker] Shutting down...')
    await worker.close()
    await connection.quit()
    console.log('[Export Worker] Shutdown complete')
    process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

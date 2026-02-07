/* eslint-disable @typescript-eslint/no-unused-vars */
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { extractExamFromPDF } from '@/lib/exam-import/extractor'
import { isOpenAIConfiguredSync } from '@/lib/grading/openai-client'
import { downloadFile } from '@/lib/storage/minio'
import { extractAndUploadImages, type ImageRef, type ResolvedImage } from '@/lib/exam-import/image-extractor'
import type { ExamExtraction } from '@/lib/exam-import/schemas'

/**
 * PDF Import Worker
 *
 * Consumes jobs from 'pdf-import' queue.
 * Uses GPT-4o to extract exam structure from PDF documents.
 * Maps exercises → ExamSections, sub-questions → Questions.
 * Extracts and uploads figures/images from PDF pages.
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RawSegment = { type: string; text?: string; latex?: string; pageNumber?: number; boundingBox?: unknown; alt?: string }

/**
 * Extract plain text from ContentSegment[] for use in instruction fields.
 * Math segments become $latex$, images/tables are skipped.
 */
function segmentsToPlainText(segments: unknown[]): string {
    return (segments as RawSegment[])
        .map((s) => {
            if (s.type === 'text') return s.text ?? ''
            if (s.type === 'math') return `$${s.latex ?? ''}$`
            return ''
        })
        .join('')
        .trim()
}

/**
 * Collect all image_ref segments from the full extraction result.
 * Returns them in encounter order, along with a stable index so we can
 * replace them after uploading.
 */
function collectImageRefs(extracted: ExamExtraction): ImageRef[] {
    const refs: ImageRef[] = []

    const scanSegments = (segments: unknown[] | null | undefined) => {
        if (!Array.isArray(segments)) return
        for (const seg of segments as RawSegment[]) {
            if (seg.type === 'image_ref' && seg.pageNumber && seg.boundingBox) {
                refs.push({
                    pageNumber: seg.pageNumber,
                    boundingBox: seg.boundingBox as ImageRef['boundingBox'],
                    alt: seg.alt ?? '',
                })
            }
        }
    }

    for (const exercise of extracted.exercises) {
        scanSegments(exercise.preamble as unknown[] | null)
        for (const sq of exercise.subQuestions) {
            scanSegments(sq.content as unknown[])
            if (sq.choices) {
                for (const choice of sq.choices) {
                    scanSegments(choice.content as unknown[])
                }
            }
        }
    }

    return refs
}

/**
 * Replace image_ref segments in-place with resolved image segments (type: 'image', url, alt).
 * Uses a counter that increments in the same order as collectImageRefs to match URLs.
 */
function resolveImageRefs(segments: unknown[], resolved: ResolvedImage[], counter: { i: number }): unknown[] {
    return (segments as RawSegment[]).map((seg) => {
        if (seg.type === 'image_ref') {
            const img = resolved[counter.i++]
            if (img && img.url) {
                return { type: 'image', url: img.url, alt: img.alt }
            }
            // If upload failed, drop the segment silently (replace with empty text)
            return { type: 'text', text: '' }
        }
        return seg
    })
}

/**
 * Walk the full extraction and replace all image_ref → image with uploaded URLs.
 * Mutates the extraction in place.
 */
function resolveAllImageRefs(extracted: ExamExtraction, resolved: ResolvedImage[]): void {
    const counter = { i: 0 }

    const processSegments = (segments: unknown[] | null | undefined): unknown[] | null => {
        if (!Array.isArray(segments)) return segments as null
        return resolveImageRefs(segments, resolved, counter)
    }

    for (const exercise of extracted.exercises) {
        if (exercise.preamble) {
            (exercise as Record<string, unknown>).preamble = processSegments(exercise.preamble as unknown[])
        }
        for (const sq of exercise.subQuestions) {
            (sq as Record<string, unknown>).content = processSegments(sq.content as unknown[])
            if (sq.choices) {
                for (const choice of sq.choices) {
                    (choice as Record<string, unknown>).content = processSegments(choice.content as unknown[])
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

const worker = new Worker('pdf-import', async (job: Job) => {
    try {
        if (job.name === 'import-exam') {
            const { userId, pdfKey, institutionId, courseId } = job.data
            console.log(`[PDF Import Worker] Processing import for PDF ${pdfKey}`)

            // 1. Call GPT-4o to extract exam structure from PDF
            console.log(`[PDF Import Worker] Calling GPT-4o for PDF extraction...`)
            const extracted = await extractExamFromPDF({ pdfKey, userId })

            const totalSubQuestions = extracted.exercises.reduce((sum, ex) => sum + ex.subQuestions.length, 0)
            console.log(`[PDF Import Worker] Extracted ${extracted.exercises.length} exercises with ${totalSubQuestions} sub-questions`)
            console.log(`[PDF Import Worker] Confidence: ${extracted.metadata.confidence}`)
            if (extracted.metadata.warnings.length > 0) {
                console.log(`[PDF Import Worker] Warnings: ${extracted.metadata.warnings.join(', ')}`)
            }

            // 2. Extract and upload images from PDF (if any image_ref segments exist)
            const imageRefs = collectImageRefs(extracted)
            if (imageRefs.length > 0) {
                console.log(`[PDF Import Worker] Found ${imageRefs.length} image references, extracting from PDF...`)
                const pdfBuffer = await downloadFile(pdfKey)
                const resolved = await extractAndUploadImages(pdfBuffer, imageRefs)
                resolveAllImageRefs(extracted, resolved)
                const uploadedCount = resolved.filter((r) => r.url).length
                console.log(`[PDF Import Worker] Uploaded ${uploadedCount}/${imageRefs.length} images`)
            }

            // 3. Create exam (without sections yet)
            const exam = await prisma.exam.create({
                data: {
                    title: extracted.title,
                    courseId: courseId,
                    status: 'DRAFT',
                    authorId: userId,
                }
            })

            console.log(`[PDF Import Worker] Created exam ${exam.id}`)

            // 4. Create sections and questions for each exercise
            for (let exIdx = 0; exIdx < extracted.exercises.length; exIdx++) {
                const exercise = extracted.exercises[exIdx]

                // Serialize preamble ContentSegment[] to JSON string for introContent
                const introContent = exercise.preamble
                    ? JSON.stringify(exercise.preamble)
                    : null

                // Create ExamSection for this exercise
                const section = await prisma.examSection.create({
                    data: {
                        examId: exam.id,
                        title: exercise.title || `Exercice ${exercise.exerciseNumber}`,
                        customLabel: `Exercice ${exercise.exerciseNumber}`,
                        introContent: introContent,
                        order: exIdx,
                        isDefault: false,
                    }
                })

                console.log(`[PDF Import Worker] Created section ${section.id} for Exercise ${exercise.exerciseNumber}`)

                // Create questions for each sub-question
                for (let sqIdx = 0; sqIdx < exercise.subQuestions.length; sqIdx++) {
                    const sq = exercise.subQuestions[sqIdx]

                    // Content is already ContentSegment[] (with images resolved) — serialize to JSON
                    const contentSegments = JSON.stringify(sq.content)
                    // Plain text version for segment instruction
                    const instructionText = segmentsToPlainText(sq.content as unknown[])

                    if (sq.type === 'TEXT') {
                        const question = await prisma.question.create({
                            data: {
                                sectionId: section.id,
                                content: contentSegments,
                                customLabel: sq.label,
                                type: 'TEXT',
                                order: sqIdx,
                                generatedRubric: sq.correctionGuidelines
                                    ? { criteria: sq.correctionGuidelines }
                                    : undefined,
                                segments: {
                                    create: {
                                        instruction: instructionText,
                                        maxPoints: sq.maxPoints,
                                        order: 0
                                    }
                                }
                            }
                        })

                        console.log(`[PDF Import Worker] Created TEXT question ${question.id} (${sq.label})`)
                    } else if (sq.type === 'MCQ' && sq.choices) {
                        const question = await prisma.question.create({
                            data: {
                                sectionId: section.id,
                                content: contentSegments,
                                customLabel: sq.label,
                                type: 'MCQ',
                                order: sqIdx,
                                generatedRubric: sq.correctionGuidelines
                                    ? { criteria: sq.correctionGuidelines }
                                    : undefined,
                                segments: {
                                    create: sq.choices.map((choice, choiceIndex) => ({
                                        instruction: segmentsToPlainText(choice.content as unknown[]),
                                        isCorrect: choice.isCorrect,
                                        order: choiceIndex,
                                        maxPoints: null
                                    }))
                                }
                            }
                        })

                        console.log(`[PDF Import Worker] Created MCQ question ${question.id} with ${sq.choices.length} options (${sq.label})`)
                    }
                }
            }

            console.log(`[PDF Import Worker] Successfully imported exam ${exam.id}`)

            // Return job result
            return {
                examId: exam.id,
                exerciseCount: extracted.exercises.length,
                questionCount: totalSubQuestions,
                imageCount: imageRefs.length,
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

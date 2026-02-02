import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/api-auth'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

/**
 * GET /api/exam-import/status/[jobId]
 *
 * Poll the status of a PDF import job.
 * Returns job state (processing/completed/failed) and result data on completion.
 *
 * Authentication: Requires valid session
 *
 * Response formats:
 * - Processing: { status: 'processing' }
 * - Completed: { status: 'completed', examId, questionCount, confidence, warnings }
 * - Failed: { status: 'failed', error: string }
 *
 * Errors:
 * - 401: Not authenticated
 * - 404: Job not found
 * - 500: Unexpected error
 */

// Create Redis connection at module level (not per-request)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('[PDF Import Status] Redis connection failed after 3 retries')
      return null
    }
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

// Create Queue instance at module level to reuse connection
const statusQueue = new Queue('pdf-import', { connection })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Check authentication
    const session = await getAuthSession(request)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Extract jobId from route params
    const { jobId } = await params

    // Get job from queue
    const job = await statusQueue.getJob(jobId)

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Get job state
    const state = await job.getState()

    // Handle completed state
    if (state === 'completed') {
      const returnValue = job.returnvalue as {
        examId: string
        questionCount: number
        confidence: string
        warnings: string[]
      }

      return NextResponse.json({
        status: 'completed',
        examId: returnValue.examId,
        questionCount: returnValue.questionCount,
        confidence: returnValue.confidence,
        warnings: returnValue.warnings,
      })
    }

    // Handle failed state
    if (state === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: job.failedReason || 'Import echoue',
      })
    }

    // Handle active/waiting/delayed states
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      return NextResponse.json({
        status: 'processing',
      })
    }

    // Unknown state (shouldn't happen, but handle gracefully)
    return NextResponse.json({
      status: 'processing',
    })
  } catch (error) {
    console.error('[PDF Import Status] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check job status' },
      { status: 500 }
    )
  }
}

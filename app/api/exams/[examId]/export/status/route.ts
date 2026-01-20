import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { exportQueue } from '@/lib/queue'

// GET /api/exams/[examId]/export/status?jobId=xxx - Get export job status
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string }> }
) {
    try {
        const { examId } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const jobId = req.nextUrl.searchParams.get('jobId')
        if (!jobId) {
            return NextResponse.json({ error: 'jobId required' }, { status: 400 })
        }

        if (!exportQueue) {
            return NextResponse.json({ error: 'Export service unavailable' }, { status: 503 })
        }

        const job = await exportQueue.getJob(jobId)
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Verify job belongs to this exam
        if (job.data.examId !== examId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const state = await job.getState()
        const progress = job.progress as { phase?: string; current?: number; total?: number } | undefined

        if (state === 'completed') {
            const result = job.returnvalue as { filename: string; size: number; attemptCount: number }
            return NextResponse.json({
                status: 'completed',
                progress: 100,
                result: {
                    filename: result.filename,
                    size: result.size,
                    attemptCount: result.attemptCount,
                    downloadUrl: `/api/exams/${examId}/export/download/${result.filename}`
                }
            })
        }

        if (state === 'failed') {
            return NextResponse.json({
                status: 'failed',
                error: job.failedReason || 'Unknown error'
            })
        }

        return NextResponse.json({
            status: state,
            progress: progress?.current ?? 0,
            phase: progress?.phase ?? 'queued'
        })

    } catch (error) {
        console.error('[API] Export Status Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

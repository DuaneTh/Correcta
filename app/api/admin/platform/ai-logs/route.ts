import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isPlatformAdmin } from '@/lib/api-auth'

/**
 * GET /api/admin/platform/ai-logs
 * Get AI grading logs with pagination and filters
 */
export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isPlatformAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
        const operation = searchParams.get('operation') // GRADING, RUBRIC_GENERATION, TEST
        const success = searchParams.get('success') // true, false

        const where: any = {}

        if (operation) {
            where.operation = operation
        }

        if (success !== null && success !== undefined) {
            where.success = success === 'true'
        }

        const [logs, total] = await Promise.all([
            prisma.aIGradingLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.aIGradingLog.count({ where })
        ])

        // Get stats
        const stats = await prisma.aIGradingLog.groupBy({
            by: ['operation', 'success'],
            _count: { id: true },
            _avg: { durationMs: true, tokensInput: true, tokensOutput: true }
        })

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            stats
        })
    } catch (error) {
        console.error('[AI Logs API] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

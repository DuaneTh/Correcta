import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs/promises'
import path from 'path'

const EXPORT_DIR = process.env.EXPORT_DIR || path.join(process.cwd(), 'tmp', 'exports')

// GET /api/exams/[examId]/export/download/[filename] - Download exported file
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ examId: string; filename: string }> }
) {
    try {
        const { examId, filename } = await params
        const session = await getAuthSession(req)

        if (!session || !session.user || !isTeacher(session)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify access to exam
        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                course: { select: { institutionId: true } }
            }
        })

        if (!exam) {
            return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
        }

        if (exam.course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename)
        const filepath = path.join(EXPORT_DIR, sanitizedFilename)

        // Verify file exists
        try {
            await fs.access(filepath)
        } catch {
            return NextResponse.json({ error: 'File not found' }, { status: 404 })
        }

        // Read and return file
        const fileBuffer = await fs.readFile(filepath)

        return new Response(fileBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${sanitizedFilename}"`
            }
        })

    } catch (error) {
        console.error('[API] Export Download Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

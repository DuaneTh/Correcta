import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { generateGradesCSV } from '@/lib/export/csv-generator'
import { logAudit, getClientIp } from '@/lib/audit'

// GET /api/exams/[examId]/export/csv - Download grades as CSV
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await params
    const session = await getAuthSession(req)

    // Auth check: Teacher only
    if (!session || !session.user || !isTeacher(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify teacher has access to exam (same institution)
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

    // Optional class filter from query params
    const classId = req.nextUrl.searchParams.get('classId')
    const classIds = classId ? [classId] : undefined

    // Generate CSV
    const csv = await generateGradesCSV({ examId, classIds })

    logAudit({
        action: 'EXPORT_CSV',
        actorId: session.user.id,
        institutionId: session.user.institutionId,
        targetType: 'EXAM',
        targetId: examId,
        metadata: classId ? { classId } : undefined,
        ipAddress: getClientIp(req),
    })

    // Return as downloadable file
    // Sanitize filename: replace non-alphanumeric with dash
    const safeTitle = exam.title.replace(/[^a-zA-Z0-9]/g, '-')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `notes-${safeTitle}-${dateStr}.csv`

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (error) {
    console.error('[API] CSV Export Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

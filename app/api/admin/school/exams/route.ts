import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'

    const exams = await prisma.exam.findMany({
        where: {
            course: { institutionId: session.user.institutionId },
            ...(includeArchived ? {} : { archivedAt: null }),
            parentExamId: null,
        },
        select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            durationMinutes: true,
            archivedAt: true,
            createdAt: true,
            course: { select: { code: true, name: true, archivedAt: true } },
            class: { select: { name: true, archivedAt: true } },
        },
        orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ exams })
}

export async function PATCH(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const examId = typeof body?.examId === 'string' ? body.examId : ''
    const archived = typeof body?.archived === 'boolean' ? body.archived : undefined

    if (!examId || archived === undefined) {
        return NextResponse.json({ error: 'Missing examId or archived' }, { status: 400 })
    }

    const exam = await prisma.exam.findUnique({
        where: { id: examId },
        select: { id: true, course: { select: { institutionId: true } } }
    })

    if (!exam || exam.course.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.exam.update({
        where: { id: examId },
        data: { archivedAt: archived ? new Date() : null },
        select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
            durationMinutes: true,
            archivedAt: true,
            createdAt: true,
            course: { select: { code: true, name: true, archivedAt: true } },
            class: { select: { name: true, archivedAt: true } },
        }
    })

    return NextResponse.json({ exam: updated })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'

    const rawCourses = await prisma.course.findMany({
        where: {
            institutionId: session.user.institutionId,
            ...(includeArchived ? {} : { archivedAt: null }),
        },
        select: {
            id: true,
            code: true,
            name: true,
            archivedAt: true,
            classes: { where: { archivedAt: null }, select: { id: true } },
            exams: { where: { archivedAt: null }, select: { id: true } },
        },
        orderBy: { code: 'asc' }
    })

    const courses = rawCourses.map((course) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        archivedAt: course.archivedAt,
        _count: {
            classes: course.classes.length,
            exams: course.exams.length,
        }
    }))

    return NextResponse.json({ courses })
}

export async function POST(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    if (Array.isArray(body?.courses)) {
        const existingCourses = await prisma.course.findMany({
            where: { institutionId: session.user.institutionId },
            select: { code: true }
        })
        const existingCodes = new Set(existingCourses.map((course) => course.code.toLowerCase()))
        const seen = new Set<string>()
        const errors: string[] = []
        const data = body.courses
            .map((entry: { code?: string; name?: string }) => {
                const rawCode = typeof entry?.code === 'string' ? entry.code.trim() : ''
                const rawName = typeof entry?.name === 'string' ? entry.name.trim() : ''
                if (!rawCode || !rawName) {
                    errors.push(`Missing code or name: ${rawCode || rawName || 'entry'}`)
                    return null
                }
                const key = rawCode.toLowerCase()
                if (existingCodes.has(key)) {
                    errors.push(`Course code already exists: ${rawCode}`)
                    return null
                }
                if (seen.has(key)) {
                    return null
                }
                seen.add(key)
                return {
                    code: rawCode,
                    name: rawName,
                    institutionId: session.user.institutionId,
                }
            })
            .filter(Boolean) as Array<{ code: string; name: string; institutionId: string }>

        if (data.length === 0) {
            return NextResponse.json({ error: 'No valid courses provided', errors }, { status: 400 })
        }

        try {
            const result = await prisma.course.createMany({ data })
            const createdCount = result.count
            const skippedCount = data.length - createdCount
            return NextResponse.json({ createdCount, skippedCount, errors })
        } catch (error) {
            console.error('[AdminCourses] Bulk create failed', error)
            return NextResponse.json({ error: 'Failed to create courses' }, { status: 500 })
        }
    }

    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''

    if (!code || !name) {
        return NextResponse.json({ error: 'Missing code or name' }, { status: 400 })
    }

    try {
        const created = await prisma.course.create({
            data: {
                code,
                name,
                institutionId: session.user.institutionId,
            },
            select: {
                id: true,
                code: true,
                name: true,
                archivedAt: true,
                classes: { where: { archivedAt: null }, select: { id: true } },
                exams: { where: { archivedAt: null }, select: { id: true } },
            }
        })

        const course = {
            id: created.id,
            code: created.code,
            name: created.name,
            archivedAt: created.archivedAt,
            _count: {
                classes: created.classes.length,
                exams: created.exams.length,
            }
        }

        return NextResponse.json({ course }, { status: 201 })
    } catch (error) {
        console.error('[AdminCourses] Create failed', error)
        return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : undefined
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const archived = typeof body?.archived === 'boolean' ? body.archived : undefined

    if (!courseId) {
        return NextResponse.json({ error: 'Missing courseId' }, { status: 400 })
    }

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, institutionId: true }
    })

    if (!course || course.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (code !== undefined) updateData.code = code
    if (name !== undefined) updateData.name = name

    if (archived !== undefined) {
        updateData.archivedAt = archived ? new Date() : null
    }

    const updated = await prisma.course.update({
        where: { id: courseId },
        data: updateData,
        select: {
            id: true,
            code: true,
            name: true,
            archivedAt: true,
            classes: { where: { archivedAt: null }, select: { id: true } },
            exams: { where: { archivedAt: null }, select: { id: true } },
        }
    })

    const coursePayload = {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        archivedAt: updated.archivedAt,
        _count: {
            classes: updated.classes.length,
            exams: updated.exams.length,
        }
    }

    if (archived !== undefined) {
        const archivedAt = archived ? new Date() : null
        await prisma.class.updateMany({
            where: { courseId: updated.id },
            data: { archivedAt }
        })
        await prisma.exam.updateMany({
            where: { courseId: updated.id },
            data: { archivedAt }
        })
    }

    return NextResponse.json({ course: coursePayload })
}

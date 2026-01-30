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
            // Get all sections (excluding __DEFAULT__) with their archived status
            classes: { where: { name: { not: '__DEFAULT__' } }, select: { id: true, archivedAt: true } },
            // Get all exams with their archived status
            exams: { select: { id: true, archivedAt: true } },
        },
        orderBy: { code: 'asc' }
    })

    const courses = rawCourses.map((course) => {
        // For archived courses: count all sections/exams (they were archived with the course)
        // For active courses: count only active sections/exams
        const isArchivedCourse = course.archivedAt !== null
        const classCount = isArchivedCourse
            ? course.classes.length
            : course.classes.filter(c => c.archivedAt === null).length
        const examCount = isArchivedCourse
            ? course.exams.length
            : course.exams.filter(e => e.archivedAt === null).length

        return {
            id: course.id,
            code: course.code,
            name: course.name,
            archivedAt: course.archivedAt,
            _count: {
                classes: classCount,
                exams: examCount,
            }
        }
    })

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
        // Create course and default section in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const created = await tx.course.create({
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
                }
            })

            // Create a default section for the course
            const defaultSection = await tx.class.create({
                data: {
                    name: '__DEFAULT__',
                    courseId: created.id,
                },
                select: { id: true }
            })

            return { course: created, defaultSectionId: defaultSection.id }
        })

        const course = {
            id: result.course.id,
            code: result.course.code,
            name: result.course.name,
            archivedAt: result.course.archivedAt,
            _count: {
                // Default section is excluded from count (hidden in UI)
                classes: 0,
                exams: 0,
            }
        }

        return NextResponse.json({ course, defaultSectionId: result.defaultSectionId }, { status: 201 })
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

    // Get current archivedAt before updating (needed for restore logic)
    const currentCourse = await prisma.course.findUnique({
        where: { id: courseId },
        select: { archivedAt: true }
    })
    const previousArchivedAt = currentCourse?.archivedAt

    if (archived !== undefined) {
        updateData.archivedAt = archived ? new Date() : null
    }

    // First update the course
    const updated = await prisma.course.update({
        where: { id: courseId },
        data: updateData,
        select: {
            id: true,
            code: true,
            name: true,
            archivedAt: true,
        }
    })

    // Handle archiving/restoring sections and exams
    if (archived === true) {
        // When archiving: only archive sections/exams that are not already archived
        const archivedAt = new Date()
        await prisma.class.updateMany({
            where: { courseId: updated.id, archivedAt: null },
            data: { archivedAt }
        })
        await prisma.exam.updateMany({
            where: { courseId: updated.id, archivedAt: null },
            data: { archivedAt }
        })
    } else if (archived === false && previousArchivedAt) {
        // When restoring: restore sections/exams that were archived at the same time as the course
        // (archived on or after the course's archivedAt timestamp)
        await prisma.class.updateMany({
            where: {
                courseId: updated.id,
                archivedAt: { gte: previousArchivedAt }
            },
            data: { archivedAt: null }
        })
        await prisma.exam.updateMany({
            where: {
                courseId: updated.id,
                archivedAt: { gte: previousArchivedAt }
            },
            data: { archivedAt: null }
        })
    }

    // Get the correct counts AFTER sections/exams have been updated
    // For archived courses, show total count; for active courses, show only active items
    const isArchivedCourse = updated.archivedAt !== null
    const courseCounts = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            classes: {
                where: isArchivedCourse
                    ? { name: { not: '__DEFAULT__' } }  // All sections for archived courses
                    : { archivedAt: null, name: { not: '__DEFAULT__' } },  // Only active for active courses
                select: { id: true }
            },
            exams: {
                where: isArchivedCourse ? {} : { archivedAt: null },  // All exams for archived, active only for active
                select: { id: true }
            },
        }
    })

    const coursePayload = {
        id: updated.id,
        code: updated.code,
        name: updated.name,
        archivedAt: updated.archivedAt,
        _count: {
            classes: courseCounts?.classes.length ?? 0,
            exams: courseCounts?.exams.length ?? 0,
        }
    }

    return NextResponse.json({ course: coursePayload })
}

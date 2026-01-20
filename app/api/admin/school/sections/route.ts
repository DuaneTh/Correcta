import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'

    const sections = await prisma.class.findMany({
        where: {
            course: { institutionId: session.user.institutionId },
            ...(includeArchived ? {} : { archivedAt: null }),
        },
        select: {
            id: true,
            name: true,
            archivedAt: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
            course: { select: { id: true, code: true, name: true, archivedAt: true } },
            enrollments: {
                where: includeArchived ? {} : { user: { archivedAt: null } },
                select: {
                    id: true,
                    role: true,
                    user: { select: { id: true, name: true, email: true, archivedAt: true } }
                }
            },
            children: {
                where: includeArchived ? {} : { archivedAt: null },
                select: { id: true, name: true }
            }
        },
        orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
    })

    return NextResponse.json({ sections })
}

export async function POST(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    if (Array.isArray(body?.sections)) {
        const courses = await prisma.course.findMany({
            where: { institutionId: session.user.institutionId, archivedAt: null },
            select: { id: true, code: true }
        })
        const courseByCode = new Map(
            courses.map((course) => [course.code.toLowerCase(), course.id])
        )
        const existingSections = await prisma.class.findMany({
            where: { courseId: { in: courses.map((course) => course.id) } },
            select: { courseId: true, name: true }
        })
        const existingKeys = new Set(
            existingSections.map((section) => `${section.courseId}:${section.name.toLowerCase()}`)
        )
        const seen = new Set<string>()
        const errors: string[] = []
        const data = body.sections
            .map((entry: { courseCode?: string; name?: string }) => {
                const rawCourseCode = typeof entry?.courseCode === 'string' ? entry.courseCode.trim() : ''
                const rawName = typeof entry?.name === 'string' ? entry.name.trim() : ''
                if (!rawCourseCode || !rawName) {
                    errors.push(`Missing course code or section name: ${rawCourseCode || rawName || 'entry'}`)
                    return null
                }
                const courseId = courseByCode.get(rawCourseCode.toLowerCase())
                if (!courseId) {
                    errors.push(`Unknown course code: ${rawCourseCode}`)
                    return null
                }
                const key = `${courseId}:${rawName.toLowerCase()}`
                if (existingKeys.has(key)) {
                    errors.push(`Section already exists: ${rawCourseCode} - ${rawName}`)
                    return null
                }
                if (seen.has(key)) {
                    return null
                }
                seen.add(key)
                return {
                    name: rawName,
                    courseId,
                }
            })
            .filter(Boolean) as Array<{ name: string; courseId: string }>

        if (data.length === 0) {
            return NextResponse.json({ error: 'No valid sections provided', errors }, { status: 400 })
        }

        try {
            const result = await prisma.class.createMany({ data })
            const createdCount = result.count
            const skippedCount = data.length - createdCount
            return NextResponse.json({ createdCount, skippedCount, errors })
        } catch (error) {
            console.error('[AdminSections] Bulk create failed', error)
            return NextResponse.json({ error: 'Failed to create sections' }, { status: 500 })
        }
    }

    const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const parentId = typeof body?.parentId === 'string' && body.parentId ? body.parentId : null

    if (!courseId || !name) {
        return NextResponse.json({ error: 'Missing courseId or name' }, { status: 400 })
    }

    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, institutionId: true, archivedAt: true }
    })

    if (!course || course.institutionId !== session.user.institutionId || course.archivedAt) {
        return NextResponse.json({ error: 'Invalid course' }, { status: 400 })
    }

    // Validate parentId if provided
    if (parentId) {
        const parentSection = await prisma.class.findUnique({
            where: { id: parentId },
            select: { id: true, courseId: true, parentId: true, archivedAt: true }
        })

        if (!parentSection) {
            return NextResponse.json({ error: 'Parent section not found' }, { status: 400 })
        }

        if (parentSection.courseId !== courseId) {
            return NextResponse.json({ error: 'Parent section must be in the same course' }, { status: 400 })
        }

        if (parentSection.parentId) {
            return NextResponse.json({ error: 'Cannot create subgroup of a subgroup (max 1 level deep)' }, { status: 400 })
        }

        if (parentSection.archivedAt) {
            return NextResponse.json({ error: 'Cannot create subgroup under archived section' }, { status: 400 })
        }
    }

    const section = await prisma.class.create({
        data: {
            name,
            courseId,
            parentId,
        },
        select: {
            id: true,
            name: true,
            archivedAt: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
            course: { select: { id: true, code: true, name: true, archivedAt: true } },
            enrollments: { select: { id: true, role: true, user: { select: { id: true, name: true, email: true, archivedAt: true } } } },
            children: { select: { id: true, name: true } }
        }
    })

    return NextResponse.json({ section }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const sectionId = typeof body?.sectionId === 'string' ? body.sectionId : ''
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const archived = typeof body?.archived === 'boolean' ? body.archived : undefined
    // parentId can be a string (set parent), null (remove parent), or undefined (don't change)
    const parentIdProvided = 'parentId' in body
    const parentId = parentIdProvided ? (typeof body.parentId === 'string' && body.parentId ? body.parentId : null) : undefined

    if (!sectionId) {
        return NextResponse.json({ error: 'Missing sectionId' }, { status: 400 })
    }

    const section = await prisma.class.findUnique({
        where: { id: sectionId },
        select: {
            id: true,
            courseId: true,
            parentId: true,
            course: { select: { institutionId: true } },
            children: { select: { id: true } }
        }
    })

    if (!section || section.course.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Validate parentId if provided
    if (parentIdProvided && parentId !== undefined) {
        if (parentId !== null) {
            // Cannot set self as parent
            if (parentId === sectionId) {
                return NextResponse.json({ error: 'Cannot set self as parent' }, { status: 400 })
            }

            const parentSection = await prisma.class.findUnique({
                where: { id: parentId },
                select: { id: true, courseId: true, parentId: true, archivedAt: true }
            })

            if (!parentSection) {
                return NextResponse.json({ error: 'Parent section not found' }, { status: 400 })
            }

            if (parentSection.courseId !== section.courseId) {
                return NextResponse.json({ error: 'Parent section must be in the same course' }, { status: 400 })
            }

            if (parentSection.parentId) {
                return NextResponse.json({ error: 'Cannot become subgroup of a subgroup (max 1 level deep)' }, { status: 400 })
            }

            if (parentSection.archivedAt) {
                return NextResponse.json({ error: 'Cannot set archived section as parent' }, { status: 400 })
            }

            // If this section has children, it cannot become a subgroup
            if (section.children && section.children.length > 0) {
                return NextResponse.json({ error: 'Cannot move section with children to become a subgroup' }, { status: 400 })
            }
        }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (archived !== undefined) updateData.archivedAt = archived ? new Date() : null
    if (parentIdProvided && parentId !== undefined) updateData.parentId = parentId

    const updated = await prisma.class.update({
        where: { id: sectionId },
        data: updateData,
        select: {
            id: true,
            name: true,
            archivedAt: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
            course: { select: { id: true, code: true, name: true, archivedAt: true } },
            enrollments: {
                select: {
                    id: true,
                    role: true,
                    user: { select: { id: true, name: true, email: true, archivedAt: true } }
                }
            },
            children: { select: { id: true, name: true } }
        }
    })

    if (archived !== undefined) {
        await prisma.exam.updateMany({
            where: { classId: sectionId },
            data: { archivedAt: archived ? new Date() : null }
        })
    }

    if (archived === true) {
        await prisma.$transaction(async (tx) => {
            const existingDefault = await tx.class.findFirst({
                where: { courseId: section.courseId, name: DEFAULT_SECTION_NAME },
                select: { id: true, archivedAt: true },
            })
            let defaultSectionId = existingDefault?.id
            if (existingDefault && existingDefault.archivedAt) {
                await tx.class.update({
                    where: { id: existingDefault.id },
                    data: { archivedAt: null },
                })
            }
            if (!defaultSectionId) {
                const createdDefault = await tx.class.create({
                    data: {
                        name: DEFAULT_SECTION_NAME,
                        courseId: section.courseId,
                    },
                    select: { id: true },
                })
                defaultSectionId = createdDefault.id
            }

            const enrollments = await tx.enrollment.findMany({
                where: { classId: sectionId },
                select: { userId: true, role: true },
            })
            if (enrollments.length > 0) {
                await tx.enrollment.createMany({
                    data: enrollments.map((entry) => ({
                        userId: entry.userId,
                        classId: defaultSectionId as string,
                        role: entry.role,
                    })),
                    skipDuplicates: true,
                })
                await tx.enrollment.deleteMany({
                    where: { classId: sectionId },
                })
            }
        })
    }

    return NextResponse.json({ section: updated })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

const isValidRole = (role: string) => role === 'TEACHER' || role === 'STUDENT'
const DEFAULT_SECTION_NAME = '__DEFAULT__'

export async function POST(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const classId = typeof body?.classId === 'string' ? body.classId : ''
    const courseId = typeof body?.courseId === 'string' ? body.courseId : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    const emails = Array.isArray(body?.emails)
        ? body.emails.filter((email: unknown): email is string => typeof email === 'string').map((email: string) => email.trim()).filter(Boolean)
        : []

    if ((!userId && emails.length === 0) || (!classId && !courseId) || !isValidRole(role)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, institutionId: true, archivedAt: true }
    })

    if (userId && (!user || user.archivedAt || user.institutionId !== session.user.institutionId)) {
        return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
    }

    if (userId && user && user.role !== role) {
        return NextResponse.json({ error: 'User role mismatch' }, { status: 400 })
    }

    try {
        const course = await prisma.course.findUnique({
            where: { id: courseId },
            select: {
                id: true,
                archivedAt: true,
                institutionId: true,
                classes: { select: { id: true, name: true, archivedAt: true } },
            },
        })

        if (!course || course.archivedAt || course.institutionId !== session.user.institutionId) {
            return NextResponse.json({ error: 'Invalid course' }, { status: 400 })
        }

        const activeSections = course.classes.filter((entry) => !entry.archivedAt)
        let targetSectionId = classId

        if (!targetSectionId) {
            const defaultSection = activeSections.find((entry) => entry.name === DEFAULT_SECTION_NAME)
            if (defaultSection) {
                targetSectionId = defaultSection.id
            } else {
                const createdDefault = await prisma.class.create({
                    data: {
                        name: DEFAULT_SECTION_NAME,
                        courseId: course.id,
                    },
                    select: { id: true },
                })
                targetSectionId = createdDefault.id
            }
        } else {
            const targetSection = activeSections.find((entry) => entry.id === targetSectionId)
            if (!targetSection) {
                return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
            }
        }

        if (emails.length > 0) {
            const normalizedEmails = emails.map((email: string) => email.toLowerCase())
            const users = await prisma.user.findMany({
                where: {
                    institutionId: session.user.institutionId,
                    archivedAt: null,
                    email: { in: normalizedEmails },
                },
                select: { id: true, email: true, role: true },
            })

            const usersByEmail = new Map(
                users.map((entry) => [entry.email?.toLowerCase() ?? '', entry])
            )
            const errors: string[] = []
            const userIds: string[] = []

            for (const email of normalizedEmails) {
                const found = usersByEmail.get(email)
                if (!found) {
                    errors.push(`Utilisateur introuvable: ${email}`)
                    continue
                }
                if (found.role !== role) {
                    errors.push(`Role invalide: ${email}`)
                    continue
                }
                userIds.push(found.id)
            }

            if (classId) {
                await prisma.enrollment.deleteMany({
                    where: {
                        userId: { in: userIds },
                        class: { courseId: course.id, name: DEFAULT_SECTION_NAME },
                    },
                })
            }

            const created = await prisma.enrollment.createMany({
                data: userIds.map((id) => ({ userId: id, classId: targetSectionId as string, role })),
                skipDuplicates: true,
            })

            return NextResponse.json(
                {
                    createdCount: created.count,
                    skippedCount: userIds.length - created.count,
                    errors,
                },
                { status: 201 }
            )
        }

        if (classId) {
            await prisma.enrollment.deleteMany({
                where: {
                    userId,
                    class: { courseId: course.id, name: DEFAULT_SECTION_NAME },
                },
            })
        }

        const enrollment = await prisma.enrollment.create({
            data: {
                userId,
                classId: targetSectionId as string,
                role,
            },
            select: {
                id: true,
                role: true,
                user: { select: { id: true, name: true, email: true, archivedAt: true } },
                class: { select: { id: true, name: true, course: { select: { code: true, name: true } } } }
            }
        })

        return NextResponse.json({ enrollment }, { status: 201 })
    } catch (error) {
        console.error('[AdminEnrollments] Create failed', error)
        return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const enrollmentId = typeof body?.enrollmentId === 'string' ? body.enrollmentId : ''
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const classId = typeof body?.classId === 'string' ? body.classId : ''

    if (!enrollmentId && (!userId || !classId)) {
        return NextResponse.json({ error: 'Missing enrollment identifier' }, { status: 400 })
    }

    const enrollment = enrollmentId
        ? await prisma.enrollment.findUnique({
            where: { id: enrollmentId },
            select: { id: true, class: { select: { course: { select: { institutionId: true } } } } }
        })
        : await prisma.enrollment.findUnique({
            where: { userId_classId: { userId, classId } },
            select: { id: true, class: { select: { course: { select: { institutionId: true } } } } }
        })

    if (!enrollment || enrollment.class.course.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.enrollment.delete({ where: { id: enrollment.id } })

    return NextResponse.json({ success: true })
}

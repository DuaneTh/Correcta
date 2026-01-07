import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
import { resolvePublishedExamsForClasses } from '@/lib/exam-variants'

const DEFAULT_SECTION_NAME = '__DEFAULT__'

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'
    const { userId } = await params

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, institutionId: true },
    })

    if (!user || user.institutionId !== session.user.institutionId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const enrollments = await prisma.enrollment.findMany({
        where: {
            userId,
            class: includeArchived
                ? { course: { institutionId: session.user.institutionId } }
                : { archivedAt: null, course: { archivedAt: null, institutionId: session.user.institutionId } },
        },
        select: {
            class: {
                select: {
                    id: true,
                    name: true,
                    course: { select: { id: true, code: true, name: true } },
                },
            },
        },
    })

    const coursesMap = new Map<string, { id: string; code: string; name: string; sections: Array<{ id: string; name: string }> }>()
    for (const enrollment of enrollments) {
        const course = enrollment.class.course
        if (!coursesMap.has(course.id)) {
            coursesMap.set(course.id, { id: course.id, code: course.code, name: course.name, sections: [] })
        }
        const entry = coursesMap.get(course.id)
        if (entry && enrollment.class.name !== DEFAULT_SECTION_NAME) {
            entry.sections.push({ id: enrollment.class.id, name: enrollment.class.name })
        }
    }
    const coursesWithDefault = Array.from(new Set(
        enrollments
            .filter((entry) => entry.class.name === DEFAULT_SECTION_NAME)
            .map((entry) => entry.class.course.id)
    ))

    if (coursesWithDefault.length > 0) {
        const extraSections = await prisma.class.findMany({
            where: {
                courseId: { in: coursesWithDefault },
                ...(includeArchived ? {} : { archivedAt: null }),
            },
            select: { id: true, name: true, courseId: true },
        })
        for (const section of extraSections) {
            if (section.name === DEFAULT_SECTION_NAME) {
                continue
            }
            const entry = coursesMap.get(section.courseId)
            if (entry && !entry.sections.some((existing) => existing.id === section.id)) {
                entry.sections.push({ id: section.id, name: section.name })
            }
        }
    }

    const courses = Array.from(coursesMap.values())

    const classIdSet = new Set(enrollments.map((entry) => entry.class.id))
    if (coursesWithDefault.length > 0) {
        const extraClassIds = await prisma.class.findMany({
            where: {
                courseId: { in: coursesWithDefault },
                ...(includeArchived ? {} : { archivedAt: null }),
            },
            select: { id: true },
        })
        extraClassIds.forEach((cls) => classIdSet.add(cls.id))
    }
    const classIds = Array.from(classIdSet)
    let exams: Array<any> = []

    if (user.role === 'STUDENT') {
        if (classIds.length > 0) {
            const baseExamWhere = {
                archivedAt: null,
                status: 'PUBLISHED' as const,
                durationMinutes: { not: null, gt: 0 },
                startAt: { not: null, gt: new Date('2000-01-01') },
                classId: null,
                parentExamId: null,
                OR: [
                    {
                        course: {
                            archivedAt: null,
                            classes: {
                                some: {
                                    archivedAt: null,
                                    enrollments: { some: { userId } },
                                },
                            },
                        },
                    },
                    { classIds: { hasSome: classIds } },
                ],
            }

            const variantExamWhere = {
                archivedAt: null,
                status: 'PUBLISHED' as const,
                durationMinutes: { not: null, gt: 0 },
                startAt: { not: null, gt: new Date('2000-01-01') },
                classId: { in: classIds },
            }

            const examSelect = {
                id: true,
                title: true,
                status: true,
                startAt: true,
                endAt: true,
                durationMinutes: true,
                gradingConfig: true,
                parentExamId: true,
                classId: true,
                classIds: true,
                class: { select: { id: true, name: true } },
                course: { select: { code: true, name: true } },
                attempts: {
                    where: { studentId: userId },
                    select: { id: true, status: true },
                },
            }

            const [variantExams, baseExams] = await Promise.all([
                prisma.exam.findMany({ where: variantExamWhere, select: examSelect }),
                prisma.exam.findMany({ where: baseExamWhere, select: examSelect }),
            ])

            exams = resolvePublishedExamsForClasses({
                baseExams,
                variantExams,
                classIds,
                context: 'admin-user-detail-student',
            }).sort((a, b) => new Date(b.startAt || 0).getTime() - new Date(a.startAt || 0).getTime())
        }
    } else {
        const courseIds = courses.map((course) => course.id)
        if (courseIds.length > 0) {
            exams = await prisma.exam.findMany({
                where: { archivedAt: null, courseId: { in: courseIds } },
                select: {
                    id: true,
                    title: true,
                    status: true,
                    startAt: true,
                    endAt: true,
                    durationMinutes: true,
                    class: { select: { id: true, name: true } },
                    course: { select: { code: true, name: true } },
                },
                orderBy: { startAt: 'desc' },
            })
        }
    }

    return NextResponse.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        courses,
        exams,
    })
}

import { prisma } from '@/lib/prisma'

export type InstitutionInfo = {
    id: string
    name: string
    domains?: { domain: string }[]
    ssoConfig?: Record<string, unknown> | null
}

export type CourseRow = {
    id: string
    code: string
    name: string
    archivedAt?: string | null
    _count: {
        classes: number
        exams: number
    }
}

export type EnrollmentRow = {
    id: string
    role: string
    user: { id: string; name: string | null; email: string | null; archivedAt?: string | null }
}

export type SectionRow = {
    id: string
    name: string
    archivedAt?: string | null
    parentId?: string | null
    parent?: { id: string; name: string } | null
    course: { id: string; code: string; name: string }
    enrollments: EnrollmentRow[]
    children?: SectionRow[]
}

export type ExamRow = {
    id: string
    title: string
    status: 'DRAFT' | 'PUBLISHED'
    startAt: string | Date | null
    endAt: string | Date | null
    durationMinutes: number | null
    createdAt: string | Date
    archivedAt?: string | null
    course: { code: string; name: string }
    class: { id: string; name: string } | null
}

export type PersonRow = {
    id: string
    name: string | null
    email: string | null
    role?: string
    archivedAt?: string | null
    enrollments: Array<{
        class: { id: string; name: string; course: { code: string; name: string } }
    }>
}

export type SchoolAdminData = {
    institution: InstitutionInfo | null
    teachers: PersonRow[]
    students: PersonRow[]
    courses: CourseRow[]
    sections: SectionRow[]
    exams: ExamRow[]
}

export async function loadSchoolAdminData(institutionId: string): Promise<SchoolAdminData> {
    const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
        include: { domains: { select: { domain: true } } }
    })

    const [teachers, students, courses, sections, exams] = await Promise.all([
        prisma.user.findMany({
            where: { institutionId, role: 'TEACHER', archivedAt: null },
            select: {
                id: true,
                name: true,
                email: true,
                archivedAt: true,
                enrollments: {
                    where: { role: 'TEACHER' },
                    select: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                course: { select: { code: true, name: true } },
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        }),
        prisma.user.findMany({
            where: { institutionId, role: 'STUDENT', archivedAt: null },
            select: {
                id: true,
                name: true,
                email: true,
                archivedAt: true,
                enrollments: {
                    where: { role: 'STUDENT' },
                    select: {
                        class: {
                            select: {
                                id: true,
                                name: true,
                                course: { select: { code: true, name: true } },
                            }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        }),
        prisma.course.findMany({
            where: { institutionId, archivedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                archivedAt: true,
                _count: { select: { classes: true, exams: true } },
            },
            orderBy: { name: 'asc' }
        }),
        prisma.class.findMany({
            where: { course: { institutionId }, archivedAt: null },
            select: {
                id: true,
                name: true,
                archivedAt: true,
                parentId: true,
                parent: { select: { id: true, name: true } },
                course: { select: { id: true, code: true, name: true } },
                enrollments: {
                    where: { user: { archivedAt: null } },
                    select: {
                        id: true,
                        role: true,
                        user: { select: { id: true, name: true, email: true, archivedAt: true } },
                    }
                }
            },
            orderBy: { name: 'asc' }
        }),
        prisma.exam.findMany({
            where: { course: { institutionId }, archivedAt: null },
            select: {
                id: true,
                title: true,
                status: true,
                startAt: true,
                endAt: true,
                durationMinutes: true,
                archivedAt: true,
                course: { select: { code: true, name: true } },
                class: { select: { id: true, name: true } },
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' }
        }),
    ])

    return {
        institution: institution ? {
            ...institution,
            ssoConfig: institution.ssoConfig as Record<string, unknown> | null
        } : null,
        teachers: teachers.map(t => ({ ...t, archivedAt: t.archivedAt?.toISOString() ?? null })),
        students: students.map(s => ({ ...s, archivedAt: s.archivedAt?.toISOString() ?? null })),
        courses: courses.map(c => ({ ...c, archivedAt: c.archivedAt?.toISOString() ?? null })),
        sections: sections.map(sec => ({
            ...sec,
            archivedAt: sec.archivedAt?.toISOString() ?? null,
            parentId: sec.parentId ?? null,
            parent: sec.parent ?? null,
            enrollments: sec.enrollments.map(enr => ({
                ...enr,
                user: {
                    ...enr.user,
                    archivedAt: enr.user.archivedAt?.toISOString() ?? null
                }
            }))
        })),
        exams: exams.map(e => ({ ...e, archivedAt: e.archivedAt?.toISOString() ?? null })),
    }
}

export async function resolveInstitutionId(session: { user: { id: string; email?: string | null; institutionId?: string | null } }): Promise<string | null> {
    let institutionId = session.user.institutionId ?? null

    if (!institutionId) {
        const email = session.user.email ?? ''
        const domain = email.split('@')[1]?.toLowerCase().trim()
        if (domain) {
            const matched = await prisma.institutionDomain.findFirst({
                where: { domain },
                select: { institutionId: true },
            })
            if (matched?.institutionId) {
                institutionId = matched.institutionId
                await prisma.user.update({
                    where: { id: session.user.id },
                    data: { institutionId },
                })
            }
        }
    }

    return institutionId
}

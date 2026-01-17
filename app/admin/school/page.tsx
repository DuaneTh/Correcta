import { redirect } from 'next/navigation'
import { getDictionary, getLocale } from '@/lib/i18n/server'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
import SchoolAdminClient from '../SchoolAdminClient'

export default async function SchoolAdminPage() {
    const session = await getAuthSession()

    if (!session) {
        redirect('/login')
    }

    if (!isSchoolAdmin(session)) {
        redirect('/teacher/courses')
    }

    const locale = await getLocale()
    const dictionary = await getDictionary()

    let institutionId = session.user.institutionId
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

    if (!institutionId) {
        redirect('/teacher/courses')
    }

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

    return (
        <SchoolAdminClient
            dictionary={dictionary}
            institution={institution ? {
                ...institution,
                ssoConfig: institution.ssoConfig as Record<string, unknown> | null
            } : null}
            teachers={teachers.map(t => ({ ...t, archivedAt: t.archivedAt?.toISOString() ?? null }))}
            students={students.map(s => ({ ...s, archivedAt: s.archivedAt?.toISOString() ?? null }))}
            courses={courses.map(c => ({ ...c, archivedAt: c.archivedAt?.toISOString() ?? null }))}
            sections={sections.map(sec => ({
                ...sec,
                archivedAt: sec.archivedAt?.toISOString() ?? null,
                enrollments: sec.enrollments.map(enr => ({
                    ...enr,
                    user: {
                        ...enr.user,
                        archivedAt: enr.user.archivedAt?.toISOString() ?? null
                    }
                }))
            }))}
            exams={exams.map(e => ({ ...e, archivedAt: e.archivedAt?.toISOString() ?? null }))}
        />
    )
}

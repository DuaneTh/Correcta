'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { InstitutionInfo, PersonRow, CourseRow, SectionRow, ExamRow } from '@/lib/school-admin-data'

type SchoolDashboardClientProps = {
    dictionary: Dictionary
    institution: InstitutionInfo | null
    teachers: PersonRow[]
    students: PersonRow[]
    courses: CourseRow[]
    sections: SectionRow[]
    exams: ExamRow[]
}

const DEFAULT_SECTION_NAME = '__DEFAULT__'
const isDefaultSection = (section: SectionRow) => section.name === DEFAULT_SECTION_NAME
const isArchived = (value?: string | null) => Boolean(value)

type StatCardProps = {
    label: string
    value: string | number
    href: string
}

const StatCard = ({ label, value, href }: StatCardProps) => (
    <Link
        href={href}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
        <div className="text-xs uppercase text-gray-500">{label}</div>
        <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
    </Link>
)

type QuickActionProps = {
    label: string
    href: string
    primary?: boolean
}

const QuickAction = ({ label, href, primary }: QuickActionProps) => (
    <Link
        href={href}
        className={`rounded-md px-3 py-2 text-xs font-medium transition ${primary
            ? 'bg-brand-900 text-white hover:bg-brand-800'
            : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
    >
        {label}
    </Link>
)

type AttentionItemProps = {
    label: string
    count: number
    href: string
    type: 'warning' | 'info'
}

const AttentionItem = ({ label, count, href, type }: AttentionItemProps) => (
    <Link
        href={href}
        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 transition hover:bg-gray-100"
    >
        <span className="text-sm text-gray-700">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${type === 'warning'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-100 text-blue-700'
        }`}>
            {count}
        </span>
    </Link>
)

export default function SchoolDashboardClient({
    dictionary,
    institution,
    teachers,
    students,
    courses,
    sections,
    exams,
}: SchoolDashboardClientProps) {
    const dict = dictionary.admin.school

    const counts = useMemo(() => ({
        teachers: teachers.filter(t => !isArchived(t.archivedAt)).length,
        students: students.filter(s => !isArchived(s.archivedAt)).length,
        courses: courses.filter(c => !isArchived(c.archivedAt)).length,
        sections: sections.filter(s => !isArchived(s.archivedAt) && !isDefaultSection(s)).length,
        exams: exams.filter(e => !isArchived(e.archivedAt)).length,
    }), [teachers, students, courses, sections, exams])

    const attentionItems = useMemo(() => {
        const items: AttentionItemProps[] = []

        // Courses without sections
        const coursesWithoutSections = courses.filter(c => {
            if (isArchived(c.archivedAt)) return false
            const courseSections = sections.filter(s =>
                s.course.id === c.id && !isArchived(s.archivedAt) && !isDefaultSection(s)
            )
            return courseSections.length === 0
        })
        if (coursesWithoutSections.length > 0) {
            items.push({
                label: dict.dashboard.coursesWithoutSections,
                count: coursesWithoutSections.length,
                href: '/admin/school/classes?filter=no-sections',
                type: 'warning',
            })
        }

        // Sections without students
        const sectionsWithoutStudents = sections.filter(s => {
            if (isArchived(s.archivedAt) || isDefaultSection(s)) return false
            const studentEnrollments = s.enrollments.filter(e =>
                e.role === 'STUDENT' && !isArchived(e.user.archivedAt)
            )
            return studentEnrollments.length === 0
        })
        if (sectionsWithoutStudents.length > 0) {
            items.push({
                label: dict.dashboard.sectionsWithoutStudents,
                count: sectionsWithoutStudents.length,
                href: '/admin/school/enrollments?filter=empty-sections',
                type: 'warning',
            })
        }

        // Teachers without sections
        const teachersWithoutSections = teachers.filter(t => {
            if (isArchived(t.archivedAt)) return false
            return t.enrollments.length === 0
        })
        if (teachersWithoutSections.length > 0) {
            items.push({
                label: dict.dashboard.teachersWithoutSections,
                count: teachersWithoutSections.length,
                href: '/admin/school/users?role=teacher&filter=unassigned',
                type: 'info',
            })
        }

        // Draft exams
        const draftExams = exams.filter(e => !isArchived(e.archivedAt) && e.status === 'DRAFT')
        if (draftExams.length > 0) {
            items.push({
                label: dict.dashboard.draftExams,
                count: draftExams.length,
                href: '/admin/school/classes?tab=exams&filter=draft',
                type: 'info',
            })
        }

        return items
    }, [courses, sections, teachers, exams, dict.dashboard])

    const recentExams = useMemo(() => {
        return exams
            .filter(e => !isArchived(e.archivedAt))
            .slice(0, 5)
            .map(e => ({
                id: e.id,
                title: e.title || dict.unknownName,
                status: e.status === 'DRAFT' ? dict.examStatusDraft : dict.examStatusPublished,
                course: e.course.code,
            }))
    }, [exams, dict])

    const ssoEnabled = useMemo(() => {
        const config = institution?.ssoConfig as { enabled?: boolean } | null
        return config?.enabled !== false
    }, [institution])

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold text-brand-900">{dict.dashboard.title}</h1>
                <p className="mt-1 text-sm text-gray-500">
                    {institution?.name || dict.unknownInstitution}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard label={dict.stats.teachers} value={counts.teachers} href="/admin/school/users?role=teacher" />
                <StatCard label={dict.stats.students} value={counts.students} href="/admin/school/users?role=student" />
                <StatCard label={dict.stats.courses} value={counts.courses} href="/admin/school/classes" />
                <StatCard label={dict.stats.sections} value={counts.sections} href="/admin/school/classes?tab=sections" />
                <StatCard label={dict.stats.exams} value={counts.exams} href="/admin/school/classes?tab=exams" />
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-gray-900">{dict.dashboard.quickActions}</div>
                    <div className="flex flex-wrap gap-2">
                        <QuickAction label={dict.createTeacherButton} href="/admin/school/users?role=teacher&action=add" primary />
                        <QuickAction label={dict.createStudentButton} href="/admin/school/users?role=student&action=add" />
                        <QuickAction label={dict.createCourseButton} href="/admin/school/classes?action=add-course" />
                        <QuickAction label={dict.bulk.importButton} href="/admin/school/settings?tab=import" />
                    </div>
                </div>
            </div>

            {/* Two columns: Attention & Recent */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Needs Attention */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 text-sm font-semibold text-gray-900">{dict.dashboard.needsAttention}</div>
                    {attentionItems.length === 0 ? (
                        <div className="text-sm text-gray-500">{dict.dashboard.allGood}</div>
                    ) : (
                        <div className="space-y-2">
                            {attentionItems.map((item, idx) => (
                                <AttentionItem key={idx} {...item} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Exams */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-4 text-sm font-semibold text-gray-900">{dict.dashboard.recentExams}</div>
                    {recentExams.length === 0 ? (
                        <div className="text-sm text-gray-500">{dict.emptyExams}</div>
                    ) : (
                        <div className="space-y-2">
                            {recentExams.map((exam) => (
                                <div key={exam.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                                        <div className="text-xs text-gray-500">{exam.course}</div>
                                    </div>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${exam.status === dict.examStatusDraft
                                        ? 'bg-gray-100 text-gray-600'
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                        {exam.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Institution Info */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-4 text-sm font-semibold text-gray-900">{dict.dashboard.institutionInfo}</div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <div className="text-xs uppercase text-gray-500">{dict.domainsLabel}</div>
                        <div className="mt-1 text-sm text-gray-900">
                            {institution?.domains?.map(d => d.domain).join(', ') || dict.noDomains}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs uppercase text-gray-500">{dict.ssoLabel}</div>
                        <div className="mt-1 text-sm text-gray-900">
                            {ssoEnabled ? dict.ssoEnabled : dict.ssoDisabled}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

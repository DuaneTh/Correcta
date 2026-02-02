'use client'

import { useMemo } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { InstitutionInfo, PersonRow, CourseRow, SectionRow, ExamRow } from '@/lib/school-admin-data'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Grid, Inline, Stack } from '@/components/ui/Layout'
import { StatPill } from '@/components/ui/StatPill'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { Badge } from '@/components/ui/Badge'

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
        const items: Array<{ label: string; count: number; href: string; variant: 'warning' | 'info' }> = []

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
                variant: 'warning',
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
                variant: 'warning',
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
                variant: 'info',
            })
        }

        // Draft exams
        const draftExams = exams.filter(e => !isArchived(e.archivedAt) && e.status === 'DRAFT')
        if (draftExams.length > 0) {
            items.push({
                label: dict.dashboard.draftExams,
                count: draftExams.length,
                href: '/admin/school/classes?tab=exams&filter=draft',
                variant: 'info',
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
                statusVariant: e.status === 'DRAFT' ? 'neutral' : 'success' as const,
                course: e.course.code,
            }))
    }, [exams, dict])

    const ssoEnabled = useMemo(() => {
        const config = institution?.ssoConfig as { enabled?: boolean } | null
        return config?.enabled !== false
    }, [institution])

    return (
        <Stack gap="xl">
            <Stack gap="xs">
                <Text as="h1" variant="pageTitle">
                    {dict.dashboard.title}
                </Text>
                <Text variant="muted">
                    {institution?.name || dict.unknownInstitution}
                </Text>
            </Stack>

            {/* KPI Cards */}
            <Grid cols="3" gap="md">
                <Card
                    role="link"
                    tabIndex={0}
                    interactive="subtle"
                    onClick={() => window.location.href = '/admin/school/users?role=teacher'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.location.href = '/admin/school/users?role=teacher'
                        }
                    }}
                >
                    <CardBody padding="md">
                        <Text variant="overline">{dict.stats.teachers}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {counts.teachers}
                        </Text>
                    </CardBody>
                </Card>
                <Card
                    role="link"
                    tabIndex={0}
                    interactive="subtle"
                    onClick={() => window.location.href = '/admin/school/users?role=student'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.location.href = '/admin/school/users?role=student'
                        }
                    }}
                >
                    <CardBody padding="md">
                        <Text variant="overline">{dict.stats.students}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {counts.students}
                        </Text>
                    </CardBody>
                </Card>
                <Card
                    role="link"
                    tabIndex={0}
                    interactive="subtle"
                    onClick={() => window.location.href = '/admin/school/classes'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.location.href = '/admin/school/classes'
                        }
                    }}
                >
                    <CardBody padding="md">
                        <Text variant="overline">{dict.stats.courses}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {counts.courses}
                        </Text>
                    </CardBody>
                </Card>
                <Card
                    role="link"
                    tabIndex={0}
                    interactive="subtle"
                    onClick={() => window.location.href = '/admin/school/classes?tab=sections'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.location.href = '/admin/school/classes?tab=sections'
                        }
                    }}
                >
                    <CardBody padding="md">
                        <Text variant="overline">{dict.stats.sections}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {counts.sections}
                        </Text>
                    </CardBody>
                </Card>
                <Card
                    role="link"
                    tabIndex={0}
                    interactive="subtle"
                    onClick={() => window.location.href = '/admin/school/classes?tab=exams'}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.location.href = '/admin/school/classes?tab=exams'
                        }
                    }}
                >
                    <CardBody padding="md">
                        <Text variant="overline">{dict.stats.exams}</Text>
                        <Text as="div" className="mt-2 text-3xl font-semibold text-gray-900">
                            {counts.exams}
                        </Text>
                    </CardBody>
                </Card>
            </Grid>

            {/* Quick Actions */}
            <Card>
                <CardBody padding="md">
                    <Inline align="between" gap="sm">
                        <Text variant="sectionTitle">{dict.dashboard.quickActions}</Text>
                        <Inline align="start" gap="sm" wrap="wrap">
                            <Button
                                onClick={() => window.location.href = '/admin/school/users?role=teacher&action=add'}
                                size="xs"
                            >
                                {dict.createTeacherButton}
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/admin/school/users?role=student&action=add'}
                                variant="secondary"
                                size="xs"
                            >
                                {dict.createStudentButton}
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/admin/school/classes?action=add-course'}
                                variant="secondary"
                                size="xs"
                            >
                                {dict.createCourseButton}
                            </Button>
                            <Button
                                onClick={() => window.location.href = '/admin/school/settings?tab=import'}
                                variant="secondary"
                                size="xs"
                            >
                                {dict.bulk.importButton}
                            </Button>
                        </Inline>
                    </Inline>
                </CardBody>
            </Card>

            {/* Two columns: Attention & Recent */}
            <Grid cols="2" gap="lg">
                {/* Needs Attention */}
                <Card>
                    <CardBody padding="md">
                        <Text variant="sectionTitle" className="mb-4">
                            {dict.dashboard.needsAttention}
                        </Text>
                        {attentionItems.length === 0 ? (
                            <Text variant="muted">{dict.dashboard.allGood}</Text>
                        ) : (
                            <Stack gap="sm">
                                {attentionItems.map((item, idx) => (
                                    <Card
                                        key={idx}
                                        role="link"
                                        tabIndex={0}
                                        interactive="subtle"
                                        onClick={() => window.location.href = item.href}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                window.location.href = item.href
                                            }
                                        }}
                                    >
                                        <CardBody padding="sm">
                                            <Inline align="between" gap="sm">
                                                <Text variant="body">{item.label}</Text>
                                                <Badge variant={item.variant}>
                                                    {item.count}
                                                </Badge>
                                            </Inline>
                                        </CardBody>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </CardBody>
                </Card>

                {/* Recent Exams */}
                <Card>
                    <CardBody padding="md">
                        <Text variant="sectionTitle" className="mb-4">
                            {dict.dashboard.recentExams}
                        </Text>
                        {recentExams.length === 0 ? (
                            <Text variant="muted">{dict.emptyExams}</Text>
                        ) : (
                            <Stack gap="sm">
                                {recentExams.map((exam) => (
                                    <Card key={exam.id}>
                                        <CardBody padding="sm">
                                            <Inline align="between" gap="sm">
                                                <Stack gap="xs">
                                                    <Text variant="body">{exam.title}</Text>
                                                    <Text variant="xsMuted">{exam.course}</Text>
                                                </Stack>
                                                <Badge variant={exam.statusVariant}>
                                                    {exam.status}
                                                </Badge>
                                            </Inline>
                                        </CardBody>
                                    </Card>
                                ))}
                            </Stack>
                        )}
                    </CardBody>
                </Card>
            </Grid>

            {/* Institution Info */}
            <Card>
                <CardBody padding="md">
                    <Text variant="sectionTitle" className="mb-4">
                        {dict.dashboard.institutionInfo}
                    </Text>
                    <Grid cols="2" gap="md">
                        <Stack gap="xs">
                            <Text variant="overline">{dict.domainsLabel}</Text>
                            <Text variant="body">
                                {institution?.domains?.map(d => d.domain).join(', ') || dict.noDomains}
                            </Text>
                        </Stack>
                        <Stack gap="xs">
                            <Text variant="overline">{dict.ssoLabel}</Text>
                            <Text variant="body">
                                {ssoEnabled ? dict.ssoEnabled : dict.ssoDisabled}
                            </Text>
                        </Stack>
                    </Grid>
                </CardBody>
            </Card>
        </Stack>
    )
}

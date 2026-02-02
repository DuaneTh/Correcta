'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dictionary } from '@/lib/i18n/dictionaries'
import { ArrowUpRight, LayoutGrid, List, Plus } from 'lucide-react'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Grid, Inline, Stack } from '@/components/ui/Layout'
import { Select } from '@/components/ui/Form'
import { SearchField } from '@/components/ui/SearchField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StatPill } from '@/components/ui/StatPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'

type CourseWithExams = {
    id: string
    code: string
    name: string
    exams: {
        id: string
        title: string
        startAt: string | null
        endAt: string | null
        status: 'DRAFT' | 'PUBLISHED'
        createdAt: string
        updatedAt: string
        durationMinutes: number | null
        gradingConfig?: Record<string, unknown> | null
        classId?: string | null
        parentExamId?: string | null
        className?: string | null
    }[]
    _count: {
        exams: number
    }
}

interface TeacherCoursesClientProps {
    courses: CourseWithExams[]
    dictionary: Dictionary
}

export default function TeacherCoursesClient({ courses, dictionary }: TeacherCoursesClientProps) {
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [sortKey, setSortKey] = useState<'nextExam' | 'lastActivity' | 'name'>('nextExam')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [courseData] = useState(courses)
    const dict = dictionary.teacher.coursesPage
    const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    useEffect(() => {
        const storedSort = localStorage.getItem('teacherCourses.sortKey')
        const storedView = localStorage.getItem('teacherCourses.viewMode')
        if (storedSort === 'nextExam' || storedSort === 'lastActivity' || storedSort === 'name') {
            setSortKey(storedSort)
        }
        if (storedView === 'grid' || storedView === 'list') {
            setViewMode(storedView)
        }
    }, [])

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedQuery(searchQuery)
        }, 200)
        return () => window.clearTimeout(timeout)
    }, [searchQuery])

    useEffect(() => {
        localStorage.setItem('teacherCourses.sortKey', sortKey)
    }, [sortKey])

    useEffect(() => {
        localStorage.setItem('teacherCourses.viewMode', viewMode)
    }, [viewMode])

    const normalizeString = (value: string) =>
        value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()

    const buildCourseSummary = (course: CourseWithExams) => {
        const now = new Date()
        const examCount = course._count.exams
        const draftCount = course.exams.filter((exam) => exam.status === 'DRAFT').length
        const scheduledExams = course.exams.filter(
            (exam) => exam.status === 'PUBLISHED' && exam.startAt && new Date(exam.startAt) > now
        )
        const scheduledCount = scheduledExams.length
        const publishedCount = course.exams.filter((exam) => {
            if (exam.status !== 'PUBLISHED') return false
            if (!exam.startAt) return true
            return new Date(exam.startAt) <= now
        }).length
        const nextExam = (() => {
            if (scheduledExams.length > 0) {
                return [...scheduledExams].sort(
                    (a, b) => new Date(a.startAt as string).getTime() - new Date(b.startAt as string).getTime()
                )[0]
            }
            const fallback = [...course.exams].sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )[0]
            return fallback ?? null
        })()
        const nextExamDate =
            nextExam?.startAt && nextExam.status === 'PUBLISHED'
                ? dateTimeFormatter.format(new Date(nextExam.startAt))
                : null
        const nextExamAt =
            nextExam?.startAt && nextExam.status === 'PUBLISHED' ? new Date(nextExam.startAt) : null
        const hasScheduledExam = scheduledExams.length > 0
        const nextExamLabel = hasScheduledExam
            ? dict.nextExamLabel
            : draftCount > 0
                ? dict.lastDraftLabel
                : dict.lastExamLabel
        const nextExamStatusLabel = nextExam
            ? nextExam.status === 'DRAFT'
                ? dict.examDraftBadge
                : nextExam.startAt && new Date(nextExam.startAt) > now
                    ? dict.examScheduledBadge
                    : dict.examPublishedBadge
            : null
        const lastActivityAt = course.exams.reduce<Date | null>((latest, exam) => {
            const examDate = new Date(exam.updatedAt || exam.createdAt)
            if (!latest || examDate > latest) return examDate
            return latest
        }, null)

        return {
            examCount,
            draftCount,
            scheduledCount,
            publishedCount,
            nextExam,
            nextExamDate,
            nextExamAt,
            nextExamLabel,
            nextExamStatusLabel,
            hasScheduledExam,
            lastActivityAt,
        }
    }

    const filteredCourses = useMemo(() => {
        const query = normalizeString(debouncedQuery.trim())
        if (!query) return courseData
        return courseData.filter((course) => {
            const courseText = normalizeString(`${course.code} ${course.name}`)
            if (courseText.includes(query)) return true
            return course.exams.some((exam) => normalizeString(exam.title).includes(query))
        })
    }, [courseData, debouncedQuery])

    const sortedCourses = useMemo(() => {
        const items = [...filteredCourses]
        if (sortKey === 'name') {
            return items.sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'))
        }
        if (sortKey === 'lastActivity') {
            return items.sort((a, b) => {
                const aDate = buildCourseSummary(a).lastActivityAt
                const bDate = buildCourseSummary(b).lastActivityAt
                if (!aDate && !bDate) return 0
                if (!aDate) return 1
                if (!bDate) return -1
                return bDate.getTime() - aDate.getTime()
            })
        }
        return items.sort((a, b) => {
            const aSummary = buildCourseSummary(a)
            const bSummary = buildCourseSummary(b)
            if (aSummary.hasScheduledExam && bSummary.hasScheduledExam) {
                const aTime = aSummary.nextExamAt ? aSummary.nextExamAt.getTime() : Infinity
                const bTime = bSummary.nextExamAt ? bSummary.nextExamAt.getTime() : Infinity
                return aTime - bTime
            }
            if (aSummary.hasScheduledExam) return -1
            if (bSummary.hasScheduledExam) return 1
            const aDate = aSummary.lastActivityAt
            const bDate = bSummary.lastActivityAt
            if (!aDate && !bDate) return 0
            if (!aDate) return 1
            if (!bDate) return -1
            return bDate.getTime() - aDate.getTime()
        })
    }, [filteredCourses, sortKey])

    return (
        <Stack gap="xl">
            <Inline align="between" gap="md">
                <Text as="h1" variant="pageTitle">
                    {dict.title}
                </Text>

                <Stack gap="sm">
                    <SearchField
                        placeholder={dict.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Inline align="start" gap="sm">
                        <Select
                            value={sortKey}
                            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                            aria-label={dict.sortLabel}
                            size="sm"
                        >
                            <option value="nextExam">{dict.sortNextExam}</option>
                            <option value="lastActivity">{dict.sortLastActivity}</option>
                            <option value="name">{dict.sortName}</option>
                        </Select>
                        <SegmentedControl
                            value={viewMode}
                            onChange={(nextValue) => setViewMode(nextValue)}
                            options={[
                                {
                                    value: 'grid',
                                    label: dict.viewGrid,
                                    icon: <LayoutGrid size={14} aria-hidden="true" />,
                                },
                                {
                                    value: 'list',
                                    label: dict.viewList,
                                    icon: <List size={14} aria-hidden="true" />,
                                },
                            ]}
                        />
                    </Inline>
                </Stack>
            </Inline>

            <Inline align="between" gap="sm">
                <Text variant="xsMuted">
                    {dict.resultsCount.replace('{{count}}', String(sortedCourses.length))}
                </Text>
                {debouncedQuery && (
                    <Button variant="ghost" size="xs" onClick={() => setSearchQuery('')}>
                        {dict.resetFilters}
                    </Button>
                )}
            </Inline>

            {sortedCourses.length === 0 ? (
                <EmptyState
                    title={
                        debouncedQuery.trim()
                            ? dict.noResultsFor.replace('{{query}}', debouncedQuery.trim())
                            : dict.noResults
                    }
                    description={dict.resetFilters}
                    action={
                        <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                            {dict.resetFilters}
                        </Button>
                    }
                    size="full"
                />
            ) : viewMode === 'grid' ? (
                <Grid cols="3" gap="lg">
                    {sortedCourses.map((course) => {
                        const sectionCount = (course._count as { classes?: number }).classes
                        const summary = buildCourseSummary(course)
                        const statusVariant = summary.nextExam?.status === 'DRAFT'
                            ? 'draft'
                            : summary.nextExam?.startAt && new Date(summary.nextExam.startAt) > new Date()
                                ? 'scheduled'
                                : 'published'

                        return (
                            <Card
                                key={course.id}
                                role="link"
                                aria-label={`${dict.openCourseButton} ${course.name}`}
                                tabIndex={0}
                                interactive="strong"
                                overflow="hidden"
                                position="relative"
                                onClick={() => router.push(`/teacher/courses/${course.id}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        router.push(`/teacher/courses/${course.id}`)
                                    }
                                }}
                            >
                                <CardBody padding="lg">
                                    <Inline align="between" gap="sm">
                                        <CourseCodeBadge code={course.code} />
                                        <Inline align="start" gap="xs">
                                            <Button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    router.push(`/teacher/exams/new?courseId=${course.id}`)
                                                }}
                                                size="xs"
                                            >
                                                <Plus size={16} />
                                                {dict.createExamButton}
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    router.push(`/teacher/courses/${course.id}`)
                                                }}
                                                variant="secondary"
                                                size="xs"
                                            >
                                                {dict.openCourseButton}
                                                <ArrowUpRight size={14} aria-hidden="true" />
                                            </Button>
                                        </Inline>
                                    </Inline>

                                    <Stack gap="xs">
                                        <Text as="h3" variant="body" truncate>
                                            {course.name}
                                        </Text>
                                        <Inline align="start" gap="xs">
                                            <Text variant="xsMuted">
                                                {summary.examCount === 0 && dict.examCountMany.replace('{{count}}', '0')}
                                                {summary.examCount === 1 && dict.examCountOne}
                                                {summary.examCount > 1 &&
                                                    dict.examCountMany.replace('{{count}}', summary.examCount.toString())}
                                            </Text>
                                            {typeof sectionCount === 'number' ? <Text variant="xsMuted">-</Text> : null}
                                            {typeof sectionCount === 'number' ? (
                                                <Text variant="xsMuted">
                                                    {sectionCount}{' '}
                                                    {sectionCount === 1 ? dict.sectionCountOne : dict.sectionCountMany}
                                                </Text>
                                            ) : null}
                                        </Inline>
                                    </Stack>

                                    <Stack gap="sm">
                                        {summary.examCount === 0 ? (
                                            <EmptyState
                                                title={dict.emptyExamsTitle}
                                                description={dict.emptyExamsHint}
                                                size="compact"
                                            />
                                        ) : (
                                            <Stack gap="sm">
                                                <Card>
                                                    <CardBody padding="sm">
                                                        <Text variant="overline">{summary.nextExamLabel}</Text>
                                                        <Inline align="between" gap="sm">
                                                            <Stack gap="xs">
                                                                <Text variant="body" truncate>
                                                                    {summary.nextExam?.title ?? dict.unknownName}
                                                                </Text>
                                                                {summary.nextExamDate ? (
                                                                    <Text variant="xsMuted">
                                                                        {summary.nextExamDate}
                                                                    </Text>
                                                                ) : null}
                                                            </Stack>
                                                            {summary.nextExamStatusLabel && summary.nextExam ? (
                                                                <StatusBadge
                                                                    label={summary.nextExamStatusLabel}
                                                                    variant={statusVariant}
                                                                />
                                                            ) : null}
                                                        </Inline>
                                                    </CardBody>
                                                </Card>
                                                <Grid cols="3" gap="xs">
                                                    <StatPill count={summary.draftCount} label={dict.examDraftBadge} />
                                                    <StatPill count={summary.scheduledCount} label={dict.examScheduledBadge} />
                                                    <StatPill count={summary.publishedCount} label={dict.examPublishedBadge} />
                                                </Grid>
                                                {summary.examCount > 1 ? (
                                                    <TextLink
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                        }}
                                                        href={`/teacher/exams?courseId=${course.id}`}
                                                    >
                                                        {dict.viewAllExamsCount.replace('{{count}}', String(summary.examCount))}
                                                    </TextLink>
                                                ) : null}
                                            </Stack>
                                        )}
                                    </Stack>
                                </CardBody>
                            </Card>
                        )
                    })}
                </Grid>
            ) : (
                <Stack gap="sm">
                    {sortedCourses.map((course) => {
                        const summary = buildCourseSummary(course)
                        return (
                            <Card
                                key={course.id}
                                role="link"
                                aria-label={`${dict.openCourseButton} ${course.name}`}
                                tabIndex={0}
                                interactive="subtle"
                                onClick={() => router.push(`/teacher/courses/${course.id}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        router.push(`/teacher/courses/${course.id}`)
                                    }
                                }}
                            >
                                <CardBody padding="sm">
                                    <Inline align="between" gap="sm">
                                        <Inline align="start" gap="sm">
                                            <CourseCodeBadge code={course.code} />
                                            <Stack gap="xs">
                                                <Text variant="body" truncate>
                                                    {course.name}
                                                </Text>
                                                <Text variant="xsMuted">
                                                    {summary.examCount === 1
                                                        ? dict.examCountOne
                                                        : dict.examCountMany.replace('{{count}}', String(summary.examCount))}
                                                </Text>
                                            </Stack>
                                        </Inline>
                                        <Inline align="start" gap="xs">
                                            <Button
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    router.push(`/teacher/exams/new?courseId=${course.id}`)
                                                }}
                                                size="xs"
                                            >
                                                <Plus size={16} />
                                                {dict.createExamButton}
                                            </Button>
                                            <Button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    router.push(`/teacher/courses/${course.id}`)
                                                }}
                                                variant="secondary"
                                                size="xs"
                                            >
                                                {dict.openCourseButton}
                                                <ArrowUpRight size={14} aria-hidden="true" />
                                            </Button>
                                        </Inline>
                                    </Inline>
                                    <Inline align="start" gap="sm">
                                        <StatPill count={summary.draftCount} label={dict.examDraftBadge} />
                                        <StatPill count={summary.scheduledCount} label={dict.examScheduledBadge} />
                                        <StatPill count={summary.publishedCount} label={dict.examPublishedBadge} />
                                        <Inline align="start" gap="xs">
                                            <Text as="span" variant="label">
                                                {summary.nextExamLabel}:
                                            </Text>
                                            <Text as="span" variant="xsMuted">
                                                {summary.nextExam?.title ?? dict.unknownName}
                                                {summary.nextExamDate ? ` - ${summary.nextExamDate}` : ''}
                                            </Text>
                                        </Inline>
                                    </Inline>
                                    {summary.examCount > 1 ? (
                                        <TextLink
                                            onClick={(event) => {
                                                event.stopPropagation()
                                            }}
                                            href={`/teacher/exams?courseId=${course.id}`}
                                        >
                                            {dict.viewAllExamsCount.replace('{{count}}', String(summary.examCount))}
                                        </TextLink>
                                    ) : null}
                                </CardBody>
                            </Card>
                        )
                    })}
                </Stack>
            )}
        </Stack>
    )
}

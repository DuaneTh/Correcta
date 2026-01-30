'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Dictionary } from '@/lib/i18n/dictionaries'
import { ArrowUpRight, LayoutGrid, List, Plus, Search } from 'lucide-react'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { ExamStatusBadge } from '@/components/teacher/ExamStatusBadge'

type CourseWithExams = {
    id: string
    code: string
    name: string
    archivedAt?: string | null
    exams: {
        id: string
        title: string
        startAt: string | null
        endAt: string | null
        status: 'DRAFT' | 'PUBLISHED'
        createdAt: string
        updatedAt: string
        archivedAt?: string | null
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
    const [showArchived, setShowArchived] = useState(false)
    const [courseData, setCourseData] = useState(courses)
    const dict = dictionary.teacher.coursesPage
    const examsDict = dictionary.teacher.examsPage
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

    // Auto-refresh every 30 seconds to catch exam status changes
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh()
        }, 30000)

        return () => clearInterval(interval)
    }, [router])

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
        let filtered = courseData

        // Filter by archived status
        if (!showArchived) {
            filtered = filtered.filter((course) => !course.archivedAt)
        }

        // Also filter exams within courses if not showing archived
        filtered = filtered.map((course) => ({
            ...course,
            exams: showArchived ? course.exams : course.exams.filter((exam) => !exam.archivedAt),
            _count: {
                ...course._count,
                exams: showArchived ? course.exams.length : course.exams.filter((exam) => !exam.archivedAt).length,
            },
        }))

        const query = normalizeString(debouncedQuery.trim())
        if (!query) return filtered
        return filtered.filter((course) => {
            const courseText = normalizeString(`${course.code} ${course.name}`)
            if (courseText.includes(query)) return true
            return course.exams.some((exam) => normalizeString(exam.title).includes(query))
        })
    }, [courseData, debouncedQuery, showArchived])

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
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-900 focus:border-brand-900 sm:text-sm"
                            placeholder={dict.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                            />
                            {examsDict.showArchived}
                        </label>
                        <select
                            value={sortKey}
                            onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2"
                            aria-label={dict.sortLabel}
                        >
                            <option value="nextExam">{dict.sortNextExam}</option>
                            <option value="lastActivity">{dict.sortLastActivity}</option>
                            <option value="name">{dict.sortName}</option>
                        </select>
                        <div className="inline-flex rounded-md border border-gray-300 bg-white p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                                    viewMode === 'grid'
                                        ? 'bg-brand-900 text-white'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{dict.viewGrid}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ${
                                    viewMode === 'list'
                                        ? 'bg-brand-900 text-white'
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                <List className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{dict.viewList}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                    {dict.resultsCount.replace('{{count}}', String(sortedCourses.length))}
                </span>
                {debouncedQuery && (
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="text-xs font-semibold text-brand-900 hover:text-brand-800"
                    >
                        {dict.resetFilters}
                    </button>
                )}
            </div>

            {sortedCourses.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">
                        {debouncedQuery.trim()
                            ? dict.noResultsFor.replace('{{query}}', debouncedQuery.trim())
                            : dict.noResults}
                    </p>
                    <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-4 inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        {dict.resetFilters}
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {sortedCourses.map((course) => {
                        const sectionCount = (course._count as { classes?: number }).classes
                        const summary = buildCourseSummary(course)
                        const isArchived = Boolean(course.archivedAt)
                        return (
                            <div
                                key={course.id}
                                role="link"
                                aria-label={`${dict.openCourseButton} ${course.name}`}
                                tabIndex={0}
                                className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow transition-shadow hover:border-brand-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2 ${isArchived ? 'opacity-60' : ''}`}
                                onClick={() => router.push(`/teacher/courses/${course.id}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        router.push(`/teacher/courses/${course.id}`)
                                    }
                                }}
                            >
                            <div className="absolute left-0 top-0 h-0.5 w-full bg-brand-900/10 opacity-60" aria-hidden="true" />
                            <div className="flex flex-col px-4 py-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <CourseCodeBadge code={course.code} />
                                        {isArchived && (
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-300">
                                                {examsDict.archivedBadge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                router.push(`/teacher/exams/new?courseId=${course.id}`)
                                            }}
                                            className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {dict.createExamButton}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                router.push(`/teacher/courses/${course.id}`)
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2"
                                        >
                                            {dict.openCourseButton}
                                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <h3 className="text-base font-semibold text-gray-900 truncate" title={course.name}>
                                        {course.name}
                                    </h3>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                        <span>
                                            {summary.examCount === 0 && dict.examCountMany.replace('{{count}}', '0')}
                                            {summary.examCount === 1 && dict.examCountOne}
                                            {summary.examCount > 1 &&
                                                dict.examCountMany.replace('{{count}}', summary.examCount.toString())}
                                        </span>
                                        {typeof sectionCount === 'number' ? (
                                            <span className="text-gray-400">•</span>
                                        ) : null}
                                        {typeof sectionCount === 'number' ? (
                                            <span>
                                                {sectionCount} {sectionCount === 1 ? dict.sectionCountOne : dict.sectionCountMany}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    {summary.examCount === 0 ? (
                                        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                            <div className="font-semibold text-gray-700">{dict.emptyExamsTitle}</div>
                                            <div className="mt-1 text-gray-500">{dict.emptyExamsHint}</div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                                                    {summary.nextExamLabel}
                                                </div>
                                                <div className="mt-2 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-gray-900">
                                                            {summary.nextExam?.title ?? dict.unknownName}
                                                        </div>
                                                        {summary.nextExamDate && (
                                                            <div className="mt-1 text-xs text-gray-500">{summary.nextExamDate}</div>
                                                        )}
                                                    </div>
                                                    {summary.nextExamStatusLabel && summary.nextExam && (
                                                        <ExamStatusBadge
                                                            label={summary.nextExamStatusLabel}
                                                            className={
                                                                summary.nextExam.status === 'DRAFT'
                                                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                                    : 'border-brand-900/20 bg-brand-50 text-brand-900'
                                                            }
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                                    <span className="font-semibold text-gray-700">{summary.draftCount}</span> {dict.examDraftBadge}
                                                </div>
                                                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                                    <span className="font-semibold text-gray-700">{summary.scheduledCount}</span> {dict.examScheduledBadge}
                                                </div>
                                                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                                    <span className="font-semibold text-gray-700">{summary.publishedCount}</span> {dict.examPublishedBadge}
                                                </div>
                                            </div>
                                            {summary.examCount > 1 && (
                                                <Link
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                    }}
                                                    href={`/teacher/exams?courseId=${course.id}`}
                                                    className="text-xs font-semibold text-brand-900 hover:text-brand-800"
                                                >
                                                    {dict.viewAllExamsCount.replace('{{count}}', String(summary.examCount))}
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedCourses.map((course) => {
                        const summary = buildCourseSummary(course)
                        const isArchived = Boolean(course.archivedAt)
                        return (
                            <div
                                key={course.id}
                                role="link"
                                aria-label={`${dict.openCourseButton} ${course.name}`}
                                tabIndex={0}
                                className={`flex flex-col gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow transition-shadow hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-900 focus-visible:ring-offset-2 ${isArchived ? 'opacity-60' : ''}`}
                                onClick={() => router.push(`/teacher/courses/${course.id}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault()
                                        router.push(`/teacher/courses/${course.id}`)
                                    }
                                }}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <CourseCodeBadge code={course.code} />
                                        {isArchived && (
                                            <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-300">
                                                {examsDict.archivedBadge}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-semibold text-gray-900">{course.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {summary.examCount === 1 ? dict.examCountOne : dict.examCountMany.replace('{{count}}', String(summary.examCount))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                router.push(`/teacher/exams/new?courseId=${course.id}`)
                                            }}
                                            className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 transition-colors"
                                        >
                                            <Plus className="h-4 w-4" />
                                            {dict.createExamButton}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                router.push(`/teacher/courses/${course.id}`)
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2"
                                        >
                                            {dict.openCourseButton}
                                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                                    <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                        <span className="font-semibold text-gray-700">{summary.draftCount}</span> {dict.examDraftBadge}
                                    </div>
                                    <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                        <span className="font-semibold text-gray-700">{summary.scheduledCount}</span> {dict.examScheduledBadge}
                                    </div>
                                    <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                        <span className="font-semibold text-gray-700">{summary.publishedCount}</span> {dict.examPublishedBadge}
                                    </div>
                                    <div className="flex-1 min-w-[180px] text-gray-500">
                                        <span className="font-semibold text-gray-600">{summary.nextExamLabel}:</span>{' '}
                                        {summary.nextExam?.title ?? dict.unknownName}
                                        {summary.nextExamDate ? ` · ${summary.nextExamDate}` : ''}
                                    </div>
                                </div>
                                {summary.examCount > 1 && (
                                    <Link
                                        onClick={(event) => {
                                            event.stopPropagation()
                                        }}
                                        href={`/teacher/exams?courseId=${course.id}`}
                                        className="text-xs font-semibold text-brand-900 hover:text-brand-800"
                                    >
                                        {dict.viewAllExamsCount.replace('{{count}}', String(summary.examCount))}
                                    </Link>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

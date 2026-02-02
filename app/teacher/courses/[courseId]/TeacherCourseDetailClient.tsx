'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCsrfToken } from '@/lib/csrfClient'
import { ArrowLeft, Plus, Users, Layers, FileText, Download, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { getExamEndAt } from '@/lib/exam-time'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Inline, Stack } from '@/components/ui/Layout'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TextLink } from '@/components/ui/TextLink'

type Exam = {
    id: string
    title: string
    startAt: string | null
    endAt: string | null
    status: 'DRAFT' | 'PUBLISHED'
    createdAt: string
    durationMinutes: number | null
    classId?: string | null
    parentExamId?: string | null
    className?: string | null
}

type Section = {
    id: string
    name: string
}

type Student = {
    id: string
    name: string | null
    email: string | null
}

interface TeacherCourseDetailClientProps {
    courseId: string
    courseCode: string
    courseName: string
    exams: Exam[]
    sections: Section[]
    students: Student[]
    hasMultipleSections: boolean
    dictionary: Dictionary
}

export default function TeacherCourseDetailClient({
    courseId,
    courseCode,
    courseName,
    exams,
    sections,
    students,
    hasMultipleSections,
    dictionary,
}: TeacherCourseDetailClientProps) {
    const router = useRouter()
    const dict = dictionary.teacher.courseDetailPage
    const coursesDict = dictionary.teacher.coursesPage
    const examBuilderDict = dictionary.teacher.examBuilderPage
    const [activeTab, setActiveTab] = useState<'exams' | 'sections' | 'students'>('exams')
    const [examIdPendingDelete, setExamIdPendingDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [examsList, setExamsList] = useState<Exam[]>(exams)
    const examDeleteConfirmRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setExamsList(exams)
    }, [exams])

    // Handle click outside for exam delete confirmation
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (examIdPendingDelete && examDeleteConfirmRef.current && !examDeleteConfirmRef.current.contains(event.target as Node)) {
                setExamIdPendingDelete(null)
            }
        }
        if (examIdPendingDelete) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [examIdPendingDelete])

    const handleDeleteClick = (id: string, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setExamIdPendingDelete(id)
    }

    const handleCancelDelete = () => {
        setExamIdPendingDelete(null)
    }

    const handleConfirmDelete = async (id: string, event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDeleting(true)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${id}`, {
                method: 'DELETE',
                headers: { 'x-csrf-token': csrfToken }
            })
            if (res.ok) {
                setExamsList(prev => prev.filter(e => e.id !== id))
                setExamIdPendingDelete(null)
            } else {
                const data = await res.json().catch(() => ({}))
                console.error('Failed to delete exam:', data.error || res.status)
                alert(`Erreur lors de la suppression: ${data.error || 'Erreur inconnue'}`)
            }
        } catch (error) {
            console.error('Failed to delete:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    // Sort exams: Drafts first (newest created), then Scheduled (newest startAt)
    const sortedExams = [...examsList].sort((a, b) => {
        // 1. Drafts first
        if (a.status === 'DRAFT' && b.status !== 'DRAFT') return -1
        if (a.status !== 'DRAFT' && b.status === 'DRAFT') return 1

        // 2. If both Drafts, sort by createdAt desc
        if (a.status === 'DRAFT' && b.status === 'DRAFT') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }

        // 3. If both Published, sort by startAt desc (fallback to createdAt)
        const aTime = a.startAt ? new Date(a.startAt).getTime() : new Date(a.createdAt).getTime()
        const bTime = b.startAt ? new Date(b.startAt).getTime() : new Date(b.createdAt).getTime()
        return bTime - aTime
    })

    const handleExportStudents = () => {
        if (students.length === 0) {
            console.warn('No students to export')
            return
        }

        const escapeCsv = (value: string) => `"${(value ?? '').replace(/"/g, '""')}"`

        const rows = students.map((student) => {
            // Split name into first and last if possible, otherwise use name as last name
            const nameParts = (student.name || '').trim().split(' ')
            const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : ''
            const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : ''
            const email = student.email || ''

            return [escapeCsv(firstName), escapeCsv(lastName), escapeCsv(email)].join(',')
        })

        const csvContent = [dict.studentsExportHeader, ...rows].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        const filename = dict.studentsExportFilename.replace('{{courseCode}}', courseCode)
        link.href = url
        link.setAttribute('download', filename)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Back Link */}
            <TextLink href="/teacher/courses">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {dict.backToCourses}
            </TextLink>

            {/* Main Card */}
            <Card>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200">
                    <Inline align="between" gap="md">
                        <Inline align="start" gap="sm">
                            <CourseCodeBadge code={courseCode} />
                            <Text as="h1" variant="pageTitle">{courseName}</Text>
                        </Inline>
                        <Button
                            onClick={() => router.push(`/teacher/exams/new?courseId=${courseId}`)}
                            size="sm"
                        >
                            <Plus className="h-4 w-4" />
                            {dict.createExamButton}
                        </Button>
                    </Inline>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 pb-4 flex items-center justify-between">
                    <div className="flex gap-3 overflow-x-auto">
                        <Button
                            variant={activeTab === 'exams' ? 'primary' : 'secondary'}
                            size="xs"
                            onClick={() => setActiveTab('exams')}
                        >
                            <FileText className="h-4 w-4" />
                            {dict.tabs.exams}
                        </Button>
                        {hasMultipleSections && (
                            <Button
                                variant={activeTab === 'sections' ? 'primary' : 'secondary'}
                                size="xs"
                                onClick={() => setActiveTab('sections')}
                            >
                                <Layers className="h-4 w-4" />
                                {dict.tabs.sections}
                            </Button>
                        )}
                        <Button
                            variant={activeTab === 'students' ? 'primary' : 'secondary'}
                            size="xs"
                            onClick={() => setActiveTab('students')}
                        >
                            <Users className="h-4 w-4" />
                            {dict.tabs.students}
                        </Button>
                    </div>

                    {activeTab === 'students' && students.length > 0 && (
                        <Button
                            variant="secondary"
                            size="xs"
                            onClick={handleExportStudents}
                        >
                            <Download className="h-4 w-4" />
                            {dict.studentsExportButton}
                        </Button>
                    )}
                </div>

                {/* Content */}
                <CardBody padding="lg">
                    {/* Exams Tab */}
                    {activeTab === 'exams' && (
                        <Stack gap="md">
                            {sortedExams.length === 0 ? (
                                <Text variant="muted" className="text-center py-8 italic">{dict.noExams}</Text>
                            ) : (
                                <Stack gap="sm">
                                    {sortedExams.map((exam) => {
                                        const now = new Date()
                                        const startAt = exam.startAt ? new Date(exam.startAt) : null
                                        const endAt = startAt ? getExamEndAt(startAt, exam.durationMinutes, exam.endAt) : null

                                        let statusVariant: 'draft' | 'scheduled' | 'published' = 'published'

                                        if (exam.status === 'DRAFT') {
                                            statusVariant = 'draft'
                                        } else if (!startAt) {
                                            statusVariant = 'published'
                                        } else if (now < startAt) {
                                            statusVariant = 'scheduled'
                                        } else if (endAt && now > endAt) {
                                            statusVariant = 'published'
                                        } else {
                                            statusVariant = 'published'
                                        }

                                        const statusLabel = exam.status === 'DRAFT'
                                            ? coursesDict.examDraftBadge
                                            : !startAt
                                                ? coursesDict.examPublishedBadge
                                                : now < startAt
                                                    ? coursesDict.examScheduledBadge
                                                    : endAt && now > endAt
                                                        ? coursesDict.examEndedBadge
                                                        : coursesDict.examInProgressBadge

                                        return (
                                        <Card
                                            key={exam.id}
                                            interactive="subtle"
                                            onClick={(e) => {
                                                // Don't navigate if clicking on buttons
                                                const target = e.target as HTMLElement
                                                if (target.closest('button')) {
                                                    return
                                                }
                                                router.push(`/dashboard/exams/${exam.id}/builder`)
                                            }}
                                            onMouseDown={(e) => {
                                                // Don't focus if clicking on buttons
                                                const target = e.target as HTMLElement
                                                if (target.closest('button')) {
                                                    e.preventDefault()
                                                    return
                                                }
                                                // Focus the div for keyboard navigation
                                                e.currentTarget.focus()
                                            }}
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    router.push(`/dashboard/exams/${exam.id}/builder`)
                                                }
                                            }}
                                        >
                                            <CardBody padding="md">
                                                <Inline align="between" gap="md">
                                                    <Stack gap="xs">
                                                        <Text variant="body" className="font-medium text-brand-900 group-hover:text-brand-700">
                                                            {exam.title}
                                                        </Text>
                                                        <Text variant="xsMuted">
                                                            {exam.startAt
                                                                ? new Date(exam.startAt).toLocaleString()
                                                                : dict.notScheduled}
                                                        </Text>
                                                        {exam.className && (
                                                            <Text variant="xsMuted">
                                                                {dict.tabs.sections}: {exam.className}
                                                            </Text>
                                                        )}
                                                    </Stack>
                                                    <div
                                                        className="flex items-center gap-3"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <StatusBadge label={statusLabel} variant={statusVariant} />
                                                        <div className="relative inline-block">
                                                            <Button
                                                                onClick={(e) => {
                                                                    if (examIdPendingDelete !== exam.id) {
                                                                        handleDeleteClick(exam.id, e)
                                                                    }
                                                                }}
                                                                variant="destructive"
                                                                size="xs"
                                                                className={examIdPendingDelete === exam.id ? 'invisible' : ''}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                {dictionary.teacher.examsPage.actions.delete}
                                                            </Button>
                                                            {examIdPendingDelete === exam.id && (
                                                                <div ref={examDeleteConfirmRef} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-3 border border-red-200 rounded-md px-3 bg-red-50 whitespace-nowrap h-9 shadow-lg">
                                                                    <Text variant="caption" className="text-red-700 font-medium">
                                                                        {examBuilderDict.confirmDeleteQuestion}
                                                                    </Text>
                                                                    <Button
                                                                        onClick={(e) => handleConfirmDelete(exam.id, e)}
                                                                        disabled={isDeleting}
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        className="text-red-700 hover:bg-red-100 disabled:opacity-50"
                                                                    >
                                                                        {dictionary.teacher.examsPage.actions?.deleteConfirm ?? (isDeleting ? 'Suppression...' : 'Confirmer ?')}
                                                                    </Button>
                                                                    <Button
                                                                        onClick={(e) => {
                                                                            e.preventDefault()
                                                                            e.stopPropagation()
                                                                            handleCancelDelete()
                                                                        }}
                                                                        disabled={isDeleting}
                                                                        variant="ghost"
                                                                        size="xs"
                                                                        className="text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                                                                    >
                                                                        {dictionary.teacher.examsPage.actions?.deleteCancel ?? 'Annuler'}
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Inline>
                                            </CardBody>
                                        </Card>
                                        )
                                    })}
                                </Stack>
                            )}
                        </Stack>
                    )}

                    {/* Sections Tab */}
                    {activeTab === 'sections' && (
                        <Stack gap="md">
                            {sections.length === 0 ? (
                                <Text variant="muted" className="text-center py-8 italic">{dict.noSections}</Text>
                            ) : (
                                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                                    {sections.map((section) => (
                                        <li key={section.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                            <Text variant="body" className="font-medium">{section.name}</Text>
                                            {/* Optional: Add student count per section if available */}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Stack>
                    )}

                    {/* Students Tab */}
                    {activeTab === 'students' && (
                        <Stack gap="md">
                            {students.length === 0 ? (
                                <Text variant="muted" className="text-center py-8 italic">{dict.noStudents}</Text>
                            ) : (
                                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                                    {students.map((student) => (
                                        <li key={student.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                            <Stack gap="xs">
                                                <Text variant="body" className="font-medium">{student.name || 'Unknown Name'}</Text>
                                                <Text variant="xsMuted">{student.email}</Text>
                                            </Stack>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Stack>
                    )}
                </CardBody>
            </Card>
        </div>
    )
}

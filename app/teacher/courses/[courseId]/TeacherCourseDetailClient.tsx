'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Users, Layers, FileText, Download, Trash2 } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { ExamStatusBadge } from '@/components/teacher/ExamStatusBadge'
import { getExamEndAt } from '@/lib/exam-time'

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
            const res = await fetch(`/api/exams/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setExamsList(prev => prev.filter(e => e.id !== id))
                setExamIdPendingDelete(null)
            } else {
                console.error('Failed to delete exam')
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
            <button
                onClick={() => router.push('/teacher/courses')}
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {dict.backToCourses}
            </button>

            {/* Main Card */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <CourseCodeBadge code={courseCode} />
                        <h1 className="text-2xl font-bold text-gray-900">{courseName}</h1>
                    </div>
                    <button
                        onClick={() => router.push(`/teacher/exams/new?courseId=${courseId}`)}
                        className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        {dict.createExamButton}
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4 pb-4 flex items-center justify-between">
                    <div className="flex gap-3 overflow-x-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('exams')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors flex items-center gap-2 ${activeTab === 'exams'
                                ? 'bg-brand-900 text-white border-brand-900'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <FileText className="h-4 w-4" />
                            {dict.tabs.exams}
                        </button>
                        {hasMultipleSections && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('sections')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors flex items-center gap-2 ${activeTab === 'sections'
                                    ? 'bg-brand-900 text-white border-brand-900'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                <Layers className="h-4 w-4" />
                                {dict.tabs.sections}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setActiveTab('students')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors flex items-center gap-2 ${activeTab === 'students'
                                ? 'bg-brand-900 text-white border-brand-900'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            <Users className="h-4 w-4" />
                            {dict.tabs.students}
                        </button>
                    </div>

                    {activeTab === 'students' && students.length > 0 && (
                        <button
                            type="button"
                            onClick={handleExportStudents}
                            className="inline-flex items-center gap-1 rounded-full border border-brand-900/40 bg-white px-3 py-1.5 text-xs font-medium text-brand-900 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 transition-colors"
                        >
                            <Download className="h-4 w-4" />
                            {dict.studentsExportButton}
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Exams Tab */}
                    {activeTab === 'exams' && (
                        <div className="space-y-4">
                            {sortedExams.length === 0 ? (
                                <p className="text-gray-500 text-center py-8 italic">{dict.noExams}</p>
                            ) : (
                                <div className="space-y-3">
                                    {sortedExams.map((exam) => {
                                        const now = new Date()
                                        const startAt = exam.startAt ? new Date(exam.startAt) : null
                                        const endAt = startAt ? getExamEndAt(startAt, exam.durationMinutes, exam.endAt) : null

                                        let statusLabel: string = coursesDict.examPublishedBadge
                                        let statusClassName = "border-brand-900/20 bg-brand-50 text-brand-900"
                                        const draftStatusClass = "border-amber-200 bg-amber-50 text-amber-700"
                                        const endedStatusClass = "border-gray-200 bg-gray-100 text-gray-600"

                                        if (exam.status === 'DRAFT') {
                                            statusLabel = coursesDict.examDraftBadge
                                            statusClassName = draftStatusClass
                                        } else if (!startAt) {
                                            statusLabel = coursesDict.examPublishedBadge
                                            statusClassName = "border-brand-900/20 bg-brand-50 text-brand-900"
                                        } else if (now < startAt) {
                                            statusLabel = coursesDict.examScheduledBadge
                                            statusClassName = "border-brand-900/20 bg-brand-50 text-brand-900"
                                        } else if (endAt && now > endAt) {
                                            statusLabel = coursesDict.examEndedBadge
                                            statusClassName = endedStatusClass
                                        } else {
                                            statusLabel = coursesDict.examInProgressBadge
                                            statusClassName = "border-brand-900/20 bg-brand-50 text-brand-900"
                                        }

                                        return (
                                        <div
                                            key={exam.id}
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
                                            className="group block p-4 rounded-lg border border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault()
                                                    router.push(`/dashboard/exams/${exam.id}/builder`)
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col flex-1">
                                                    <span className="text-lg font-medium text-brand-900 group-hover:text-brand-700">
                                                        {exam.title}
                                                    </span>
                                                    <span className="text-xs text-gray-500 mt-1">
                                                        {exam.startAt
                                                            ? new Date(exam.startAt).toLocaleString()
                                                            : dict.notScheduled}
                                                    </span>
                                                    {exam.className && (
                                                        <span className="text-xs text-gray-500 mt-1">
                                                            {dict.tabs.sections}: {exam.className}
                                                        </span>
                                                    )}
                                                </div>
                                                <div 
                                                    className="flex items-center gap-3"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExamStatusBadge label={statusLabel} className={statusClassName} />
                                                    <div className="relative inline-block">
                                                        <button
                                                            onClick={(e) => {
                                                                if (examIdPendingDelete !== exam.id) {
                                                                    handleDeleteClick(exam.id, e)
                                                                }
                                                            }}
                                                            className={`inline-flex items-center h-9 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 ${examIdPendingDelete === exam.id ? 'invisible' : ''}`}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-1" />
                                                            {dictionary.teacher.examsPage.actions.delete}
                                                        </button>
                                                        {examIdPendingDelete === exam.id && (
                                                            <div ref={examDeleteConfirmRef} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-3 border border-red-200 rounded-md px-3 bg-red-50 whitespace-nowrap h-9 shadow-lg">
                                                                <span className="text-sm text-red-700 font-medium">
                                                                    {examBuilderDict.confirmDeleteQuestion}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => handleConfirmDelete(exam.id, e)}
                                                                    disabled={isDeleting}
                                                                    className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                                                >
                                                                    {dictionary.teacher.examsPage.actions?.deleteConfirm ?? (isDeleting ? 'Suppression...' : 'Confirmer ?')}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault()
                                                                        e.stopPropagation()
                                                                        handleCancelDelete()
                                                                    }}
                                                                    disabled={isDeleting}
                                                                    className="text-sm text-gray-500 disabled:opacity-50"
                                                                >
                                                                    {dictionary.teacher.examsPage.actions?.deleteCancel ?? 'Annuler'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sections Tab */}
                    {activeTab === 'sections' && (
                        <div className="space-y-4">
                            {sections.length === 0 ? (
                                <p className="text-gray-500 text-center py-8 italic">{dict.noSections}</p>
                            ) : (
                                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                                    {sections.map((section) => (
                                        <li key={section.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                            <span className="text-sm font-medium text-gray-900">{section.name}</span>
                                            {/* Optional: Add student count per section if available */}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Students Tab */}
                    {activeTab === 'students' && (
                        <div className="space-y-4">
                            {students.length === 0 ? (
                                <p className="text-gray-500 text-center py-8 italic">{dict.noStudents}</p>
                            ) : (
                                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                                    {students.map((student) => (
                                        <li key={student.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{student.name || 'Unknown Name'}</p>
                                                <p className="text-xs text-gray-500">{student.email}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

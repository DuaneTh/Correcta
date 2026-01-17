'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { ExamStatusBadge } from '@/components/teacher/ExamStatusBadge'
import { getExamEndAt } from '@/lib/exam-time'
import { getCorrectionReleaseInfo } from '@/lib/correction-release'
import { getCsrfToken } from '@/lib/csrfClient'

interface Exam {
    id: string
    title: string
    startAt: string | null
    endAt: string | null
    durationMinutes: number | null
    status: 'DRAFT' | 'PUBLISHED'
    classId?: string | null
    classIds?: string[]
    parentExamId?: string | null
    class?: {
        id: string
        name: string
    } | null
    course: {
        code: string
        name: string
    }
    _count: {
        attempts: number
        sections: number
    }
    studentCount?: number
    sectionCount?: number
    gradingConfig?: Record<string, unknown> | null
}

interface ExamListProps {
    dictionary: Dictionary
}

export default function ExamList({ dictionary }: ExamListProps) {
    const router = useRouter()
    const [exams, setExams] = useState<Exam[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [examIdPendingDelete, setExamIdPendingDelete] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [pendingCorrectionExamId, setPendingCorrectionExamId] = useState<string | null>(null)
    const [sendingCorrectionExamId, setSendingCorrectionExamId] = useState<string | null>(null)
    const examDeleteConfirmRef = useRef<HTMLDivElement>(null)
    const dict = dictionary.teacher.examsPage
    const coursesDict = dictionary.teacher.coursesPage
    const examBuilderDict = dictionary.teacher.examBuilderPage

    const filteredExams = useMemo(() => {
        if (!searchQuery) {
            return exams
        }

        const query = searchQuery.toLowerCase()
        return exams.filter((exam) => {
            if (exam.title.toLowerCase().includes(query)) return true
            if (exam.course.name.toLowerCase().includes(query)) return true
            if (exam.course.code.toLowerCase().includes(query)) return true
            if (exam.class?.name?.toLowerCase().includes(query)) return true

            if (exam.startAt) {
                const start = new Date(exam.startAt)
                const startDate = start.toLocaleDateString()
                const startDateTime = start.toLocaleString()
                if (startDate.includes(query) || startDateTime.includes(query)) return true
            }

            return false
        })
    }, [exams, searchQuery])

    useEffect(() => {
        fetchExams()
    }, [])

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

    const fetchExams = async () => {
        try {
            const res = await fetch('/api/exams')
            if (res.ok) {
                const data = await res.json()
                setExams(data)
            }
        } catch (error) {
            console.error('Failed to fetch exams', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteClick = (id: string) => {
        setExamIdPendingDelete(id)
    }

    const handleCancelDelete = () => {
        setExamIdPendingDelete(null)
    }

    const handleRowClick = (exam: Exam) => {
        router.push(`/dashboard/exams/${exam.id}/builder`)
    }

    const handleConfirmDelete = async (id: string) => {
        console.log('[ExamList] Confirming delete for exam:', id)
        setIsDeleting(true)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${id}`, {
                method: 'DELETE',
                headers: { 'x-csrf-token': csrfToken }
            })
            console.log('[ExamList] Delete response:', res.status, res.ok)
            if (res.ok) {
                setExams(prev => prev.filter(e => e.id !== id))
                setExamIdPendingDelete(null)
                console.log('[ExamList] Exam deleted successfully')
            } else {
                console.error('[ExamList] Delete failed with status:', res.status)
            }
        } catch (error) {
            console.error('[ExamList] Failed to delete:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleSendCorrection = async (examId: string) => {
        const now = new Date().toISOString()
        setSendingCorrectionExamId(examId)
        try {
            const targetExam = exams.find(exam => exam.id === examId)
            const nextConfig = {
                ...(targetExam?.gradingConfig ?? {}),
                correctionReleaseOnEnd: false,
                correctionReleaseAt: null,
                gradesReleased: true,
                gradesReleasedAt: now,
            }
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
                body: JSON.stringify({ gradingConfig: nextConfig }),
            })
            if (res.ok) {
                setExams(prev =>
                    prev.map(exam =>
                        exam.id === examId ? { ...exam, gradingConfig: nextConfig } : exam
                    )
                )
            }
        } catch (error) {
            console.error('[ExamList] Failed to send correction:', error)
        } finally {
            setPendingCorrectionExamId(null)
            setSendingCorrectionExamId(null)
        }
    }

    if (loading) return <div className="p-8 text-center text-gray-500">Loading exams...</div>

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <h1 className="text-3xl font-bold text-brand-900">{dict.title}</h1>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-brand-900 focus:border-brand-900 sm:text-sm"
                            placeholder={coursesDict.searchPlaceholder}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => router.push('/teacher/exams/new')}
                        className="inline-flex items-center gap-2 rounded-md bg-brand-900 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:ring-offset-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {coursesDict.createExamButton}
                    </button>
                </div>
            </div>

            {filteredExams.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">{dict.emptyStateText}</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{dict.table.columnCourse}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{dict.table.columnTitle}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{dict.table.columnStartDate}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{dict.table.columnStatus}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{dict.table.columnActions}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredExams.map((exam) => {
                                const now = new Date()
                                const start = exam.startAt ? new Date(exam.startAt) : null
                                const endAt = start ? getExamEndAt(start, exam.durationMinutes, exam.endAt) : null
                                const startLabel = start
                                    ? start.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                    : dict.notScheduled
                                const releaseInfo = getCorrectionReleaseInfo({
                                    gradingConfig: exam.gradingConfig,
                                    startAt: start,
                                    durationMinutes: exam.durationMinutes,
                                    endAt: exam.endAt ? new Date(exam.endAt) : null,
                                })
                                const releaseLabel = releaseInfo.releaseOnEnd
                                    ? coursesDict.correctionReleaseOnEndLabel
                                    : releaseInfo.releaseAt
                                        ? coursesDict.correctionReleaseScheduledLabel.replace('{{date}}', releaseInfo.releaseAt.toLocaleString())
                                        : null
                                const canSendCorrection = releaseInfo.canSendManually && exam.status === 'PUBLISHED'
                                const isPendingCorrection = pendingCorrectionExamId === exam.id
                                const isSendingCorrection = sendingCorrectionExamId === exam.id

                                let statusLabel: string = coursesDict.examPublishedBadge
                                let statusClassName = 'border-brand-900/20 bg-brand-50 text-brand-900'
                                const draftStatusClass = 'border-amber-200 bg-amber-50 text-amber-700'
                                const endedStatusClass = 'border-gray-200 bg-gray-100 text-gray-600'
                                if (exam.status === 'DRAFT') {
                                    statusLabel = coursesDict.examDraftBadge
                                    statusClassName = draftStatusClass
                                } else if (!start) {
                                    statusLabel = coursesDict.examPublishedBadge
                                    statusClassName = 'border-brand-900/20 bg-brand-50 text-brand-900'
                                } else if (now < start) {
                                    statusLabel = coursesDict.examScheduledBadge
                                    statusClassName = 'border-brand-900/20 bg-brand-50 text-brand-900'
                                } else if (endAt && now > endAt) {
                                    statusLabel = coursesDict.examEndedBadge
                                    statusClassName = endedStatusClass
                                } else {
                                    statusLabel = coursesDict.examInProgressBadge
                                    statusClassName = 'border-brand-900/20 bg-brand-50 text-brand-900'
                                }

                                const studentCount = exam.studentCount || 0
                                const sectionCount = exam.sectionCount || 0

                                return (
                                    <tr
                                        key={exam.id}
                                        onClick={() => handleRowClick(exam)}
                                        className="cursor-pointer hover:bg-gray-50"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3 max-w-xs md:max-w-sm lg:max-w-md">
                                                <CourseCodeBadge code={exam.course.code} />
                                                <span className="text-sm text-gray-700 truncate">
                                                    {exam.course.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {studentCount > 0
                                                    ? `${studentCount} ${studentCount === 1 ? dict.student : dict.students}`
                                                    : dict.noStudents
                                                }
                                                {sectionCount > 0 && (
                                                    <>
                                                        {' • '}
                                                        {sectionCount} {sectionCount === 1 ? dict.section : dict.sections}
                                                    </>
                                                )}
                                            </div>
                                            {exam.class?.name && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {dict.section}: {exam.class.name}
                                                </div>
                                            )}
                                            {!exam.class?.name && Array.isArray(exam.classIds) && exam.classIds.length > 0 && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {exam.classIds.length} {exam.classIds.length === 1 ? dict.section : dict.sections}
                                                </div>
                                            )}
                                            {releaseLabel && (
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {releaseLabel}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-900">{startLabel}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <ExamStatusBadge label={statusLabel} className={statusClassName} />
                                        </td>
                                        <td 
                                            className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {canSendCorrection && (
                                                    <div className="inline-flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                if (isPendingCorrection) {
                                                                    void handleSendCorrection(exam.id)
                                                                } else {
                                                                    setPendingCorrectionExamId(exam.id)
                                                                }
                                                            }}
                                                            className={`inline-flex items-center h-9 rounded-md border px-3 text-sm font-medium ${
                                                                isPendingCorrection
                                                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                                                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                            disabled={isSendingCorrection}
                                                        >
                                                            {isPendingCorrection ? coursesDict.correctionReleaseConfirmSend : coursesDict.correctionReleaseSendButton}
                                                        </button>
                                                        {isPendingCorrection && (
                                                            <button
                                                                type="button"
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    setPendingCorrectionExamId(null)
                                                                }}
                                                                className="text-sm text-gray-500 hover:text-gray-700"
                                                                disabled={isSendingCorrection}
                                                            >
                                                                {coursesDict.correctionReleaseCancelSend}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="relative inline-block">
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        if (examIdPendingDelete !== exam.id) {
                                                            handleDeleteClick(exam.id)
                                                        }
                                                    }}
                                                    className={`inline-flex items-center h-9 rounded-md border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 ${examIdPendingDelete === exam.id ? 'invisible' : ''}`}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1" />
                                                    {dict.actions.delete}
                                                </button>
                                                {examIdPendingDelete === exam.id && (
                                                    <div 
                                                        ref={examDeleteConfirmRef} 
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-3 border border-red-200 rounded-md px-3 bg-red-50 whitespace-nowrap h-9 shadow-lg"
                                                    >
                                                        <span className="text-sm text-red-700 font-medium">
                                                            {examBuilderDict.confirmDeleteQuestion}
                                                        </span>
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleConfirmDelete(exam.id)
                                                            }}
                                                            disabled={isDeleting}
                                                            className="text-sm font-semibold text-red-700 disabled:opacity-50"
                                                        >
                                                            {dict.actions?.deleteConfirm ?? (isDeleting ? 'Suppression...' : 'Confirmer ?')}
                                                        </button>
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                handleCancelDelete()
                                                            }}
                                                            disabled={isDeleting}
                                                            className="text-sm text-gray-500 disabled:opacity-50"
                                                        >
                                                            {dict.actions?.deleteCancel ?? 'Annuler'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div >
            )
            }
        </div >
    )
}

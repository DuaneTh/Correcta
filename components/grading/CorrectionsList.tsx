'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { CourseCodeBadge } from '@/components/teacher/CourseCodeBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Text } from '@/components/ui/Text'
import { Input } from '@/components/ui/Form'

interface ExamWithGradingStatus {
    id: string
    title: string
    status: 'DRAFT' | 'PUBLISHED'
    course: {
        code: string
        name: string
    }
    _count: {
        attempts: number
    }
    gradedCount: number
    submittedCount: number
}

interface CorrectionsListProps {
    dictionary: Dictionary
}

export default function CorrectionsList({ dictionary }: CorrectionsListProps) {
    const router = useRouter()
    const [exams, setExams] = useState<ExamWithGradingStatus[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [showArchived, setShowArchived] = useState(false)
    const dict = dictionary.teacher.correctionsPage

    useEffect(() => {
        fetchExamsWithGradingStatus(true)

        // Auto-refresh every 30 seconds (silent refresh)
        const interval = setInterval(() => {
            fetchExamsWithGradingStatus(false)
        }, 30000)

        return () => clearInterval(interval)
    }, [showArchived])

    const fetchExamsWithGradingStatus = async (showLoadingState = true) => {
        try {
            if (showLoadingState) {
                setLoading(true)
            }
            const params = new URLSearchParams({ withGradingStatus: 'true' })
            if (showArchived) {
                params.set('includeArchived', 'true')
            }
            const res = await fetch(`/api/exams?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                // Filter only published exams with submissions
                const publishedWithSubmissions = data.filter(
                    (exam: ExamWithGradingStatus) => exam.status === 'PUBLISHED' && exam.submittedCount > 0
                )
                setExams(publishedWithSubmissions)
            }
        } catch (error) {
            console.error('Failed to fetch exams', error)
        } finally {
            if (showLoadingState) {
                setLoading(false)
            }
        }
    }

    const filteredExams = exams.filter((exam) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
            exam.title.toLowerCase().includes(query) ||
            exam.course.name.toLowerCase().includes(query) ||
            exam.course.code.toLowerCase().includes(query)
        )
    })

    const getGradingStatus = (exam: ExamWithGradingStatus) => {
        if (exam.gradedCount === 0) {
            return { label: dict.statusNotStarted, color: 'text-gray-500' }
        }
        if (exam.gradedCount < exam.submittedCount) {
            return { label: dict.statusInProgress, color: 'text-gray-500' }
        }
        return { label: dict.statusCompleted, color: 'text-gray-900' }
    }

    if (loading) return <div className="p-8 text-center"><Text variant="muted">Loading...</Text></div>

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <Text as="h1" variant="pageTitle">{dict.title}</Text>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <Input
                            type="text"
                            className="pl-10"
                            placeholder="Rechercher un examen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <label className="flex items-center gap-2 whitespace-nowrap">
                        <input
                            type="checkbox"
                            checked={showArchived}
                            onChange={(e) => setShowArchived(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-900 focus:ring-brand-900"
                        />
                        <Text variant="caption">{dict.showArchived}</Text>
                    </label>
                </div>
            </div>

            {filteredExams.length === 0 ? (
                <EmptyState
                    title={dict.emptyStateText}
                    description={searchQuery ? "Essayez de modifier votre recherche." : "Les examens publiés avec des soumissions apparaîtront ici."}
                    size="full"
                />
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left">
                                    <Text variant="overline">{dict.table.columnCourse}</Text>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <Text variant="overline">{dict.table.columnExam}</Text>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <Text variant="overline">{dict.table.columnSubmissions}</Text>
                                </th>
                                <th className="px-6 py-3 text-left">
                                    <Text variant="overline">{dict.table.columnStatus}</Text>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredExams.map((exam) => {
                                const status = getGradingStatus(exam)

                                return (
                                    <tr
                                        key={exam.id}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => router.push(`/dashboard/exams/${exam.id}/grading`)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 max-w-xs">
                                                <CourseCodeBadge code={exam.course.code} className="text-xs px-2 py-0.5" />
                                                <Text variant="caption" className="font-medium truncate">
                                                    {exam.course.name}
                                                </Text>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Text variant="caption" className="font-medium">{exam.title}</Text>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <Text variant="caption">
                                                    <span className="font-semibold">{exam.gradedCount}</span>
                                                    <span className="text-gray-500"> / {exam.submittedCount}</span>
                                                </Text>
                                            </div>
                                            {exam.gradedCount < exam.submittedCount && (
                                                <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                                                    <div
                                                        className="h-2 bg-brand-600 rounded-full"
                                                        style={{ width: `${exam.submittedCount > 0 ? (exam.gradedCount / exam.submittedCount) * 100 : 0}%` }}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Text variant="caption" className={status.color}>
                                                {status.label}
                                            </Text>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

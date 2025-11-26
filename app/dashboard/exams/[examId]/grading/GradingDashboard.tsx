'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface AttemptSummary {
    attemptId: string
    student: {
        id: string
        name: string
        email: string
    }
    status: string
    submittedAt: string | null
    totalScore: number | null
    gradedQuestionsCount: number
    isFullyGraded: boolean
}

interface GradingDashboardProps {
    examId: string
    examTitle: string
}

type SortField = 'name' | 'submittedAt' | 'score'
type SortOrder = 'asc' | 'desc'

export default function GradingDashboard({ examId, examTitle }: GradingDashboardProps) {
    const router = useRouter()
    const [attempts, setAttempts] = useState<AttemptSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [sortField, setSortField] = useState<SortField>('submittedAt')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [releaseMessage, setReleaseMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
    const [isReleasing, setIsReleasing] = useState(false)

    useEffect(() => {
        fetchAttempts()
    }, [examId])

    const fetchAttempts = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/grading`)
            if (!res.ok) {
                console.error('Failed to fetch grading data')
                return
            }
            const data = await res.json()
            setAttempts(data.attempts || [])
        } catch (error) {
            console.error('Error fetching attempts:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    const sortedAttempts = [...attempts].sort((a, b) => {
        let comparison = 0

        switch (sortField) {
            case 'name':
                comparison = a.student.name.localeCompare(b.student.name)
                break
            case 'submittedAt':
                const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
                const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
                comparison = aDate - bDate
                break
            case 'score':
                const aScore = a.totalScore ?? -1
                const bScore = b.totalScore ?? -1
                comparison = aScore - bScore
                break
        }

        return sortOrder === 'asc' ? comparison : -comparison
    })

    const handleReleaseResults = async () => {
        setIsReleasing(true)
        setReleaseMessage(null)

        try {
            const res = await fetch(`/api/exams/${examId}/release-results`, {
                method: 'POST'
            })

            const data = await res.json()

            if (res.ok) {
                setReleaseMessage({
                    type: 'success',
                    text: 'Copies rendues avec succès'
                })
            } else if (res.status === 400 && data.error === 'EXAM_NOT_FULLY_GRADED') {
                setReleaseMessage({
                    type: 'warning',
                    text: 'Toutes les copies ne sont pas encore corrigées.'
                })
            } else {
                console.error('Release results error:', data)
                setReleaseMessage({
                    type: 'error',
                    text: 'Une erreur est survenue lors de la publication des résultats.'
                })
            }
        } catch (error) {
            console.error('Error releasing results:', error)
            setReleaseMessage({
                type: 'error',
                text: 'Une erreur est survenue lors de la publication des résultats.'
            })
        } finally {
            setIsReleasing(false)
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Non corrigée
                    </span>
                )
            case 'GRADING_IN_PROGRESS':
                return (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        Correction en cours
                    </span>
                )
            case 'GRADED':
                return (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Corrigée
                    </span>
                )
            case 'IN_PROGRESS':
                return (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        En cours
                    </span>
                )
            default:
                return (
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {status}
                    </span>
                )
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-lg text-gray-600">Chargement...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push(`/dashboard/exams/${examId}`)}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour à l'examen
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Correction</h1>
                            <p className="text-gray-600 mt-1">{examTitle}</p>
                        </div>
                        <button
                            onClick={handleReleaseResults}
                            disabled={isReleasing}
                            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isReleasing ? 'Publication...' : 'Rendre les copies'}
                        </button>
                    </div>
                </div>

                {/* Release message */}
                {releaseMessage && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${releaseMessage.type === 'success'
                                ? 'bg-green-100 text-green-800'
                                : releaseMessage.type === 'warning'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                            }`}
                    >
                        {releaseMessage.text}
                    </div>
                )}

                {/* Attempts table */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('name')}
                                >
                                    Student
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('submittedAt')}
                                >
                                    Status
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('score')}
                                >
                                    Score
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedAttempts.map((attempt) => {
                                const isSubmitted = ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'].includes(attempt.status)
                                const hasScore = attempt.totalScore !== null

                                return (
                                    <tr key={attempt.attemptId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{attempt.student.name}</div>
                                            <div className="text-sm text-gray-500">{attempt.student.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {getStatusLabel(attempt.status)}
                                                {attempt.submittedAt && (
                                                    <span className="ml-2 text-xs text-gray-500">
                                                        {new Date(attempt.submittedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {hasScore ? (
                                                <div className="text-sm font-bold text-gray-900">
                                                    {attempt.totalScore} pts
                                                    {attempt.gradedQuestionsCount > 0 && (
                                                        <span className="ml-2 text-xs text-gray-500">
                                                            ({attempt.gradedQuestionsCount} graded)
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Not graded</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {isSubmitted ? (
                                                <button
                                                    onClick={() => router.push(`/dashboard/exams/${examId}/grading/${attempt.attemptId}`)}
                                                    className="text-indigo-600 hover:text-indigo-900 font-bold"
                                                >
                                                    Corriger
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 cursor-not-allowed">
                                                    Not ready
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {sortedAttempts.length === 0 && (
                        <div className="p-12 text-center text-gray-500">
                            No attempts found for this exam.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

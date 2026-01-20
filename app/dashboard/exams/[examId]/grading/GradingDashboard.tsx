'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Filter, MoreHorizontal, FileDown, FileText } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { GradeAllButton } from '@/components/grading/GradeAllButton'

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
    maxPoints: number | null
    gradedQuestionsCount: number
    isFullyGraded: boolean
    humanModifiedCount: number
}

interface GradingDashboardProps {
    examId: string
    examTitle: string
}

type SortField = 'name' | 'submittedAt' | 'score'
type SortOrder = 'asc' | 'desc'
type FilterOption = 'all' | 'ungraded' | 'graded' | 'modified'

export default function GradingDashboard({ examId, examTitle }: GradingDashboardProps) {
    const router = useRouter()
    const [attempts, setAttempts] = useState<AttemptSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [sortField, setSortField] = useState<SortField>('submittedAt')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [releaseMessage, setReleaseMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
    const [isReleasing, setIsReleasing] = useState(false)
    const [showPublishConfirm, setShowPublishConfirm] = useState(false)
    const [filterOption, setFilterOption] = useState<FilterOption>('all')
    const [showFilterDropdown, setShowFilterDropdown] = useState(false)
    const [showActionsDropdown, setShowActionsDropdown] = useState(false)

    const fetchAttempts = useCallback(async () => {
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
    }, [examId])

    useEffect(() => {
        fetchAttempts()
    }, [fetchAttempts])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    // Filter attempts based on selected filter option
    const filteredAttempts = useMemo(() => {
        switch (filterOption) {
            case 'ungraded':
                return attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADING_IN_PROGRESS')
            case 'graded':
                return attempts.filter(a => a.status === 'GRADED')
            case 'modified':
                return attempts.filter(a => a.humanModifiedCount > 0)
            default:
                return attempts
        }
    }, [attempts, filterOption])

    const sortedAttempts = useMemo(() => [...filteredAttempts].sort((a, b) => {
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
    }), [filteredAttempts, sortField, sortOrder])

    // Calculate statistics
    const stats = useMemo(() => {
        const total = attempts.length
        const graded = attempts.filter(a => a.status === 'GRADED').length
        const humanModified = attempts.reduce((sum, a) => sum + (a.humanModifiedCount > 0 ? 1 : 0), 0)

        // Calculate average score
        const gradedWithScores = attempts.filter(a => a.totalScore !== null && a.maxPoints !== null)
        let avgScore = 0
        let avgMaxPoints = 0
        if (gradedWithScores.length > 0) {
            avgScore = gradedWithScores.reduce((sum, a) => sum + (a.totalScore || 0), 0) / gradedWithScores.length
            avgMaxPoints = gradedWithScores[0]?.maxPoints || 0
        }

        const percentage = total > 0 ? Math.round((graded / total) * 100) : 0
        const allGraded = total > 0 && graded === total

        return { total, graded, humanModified, avgScore, avgMaxPoints, percentage, allGraded }
    }, [attempts])

    const gradedCount = stats.graded
    const canPublish = stats.allGraded

    const handleReleaseResults = async () => {
        setIsReleasing(true)
        setReleaseMessage(null)
        setShowPublishConfirm(false)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/release-results`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            const data = await res.json()

            if (res.ok) {
                setReleaseMessage({
                    type: 'success',
                    text: 'Copies rendues avec succes'
                })
                // Refresh list to update any visual indicators
                fetchAttempts()
            } else if (res.status === 400 && data.error === 'EXAM_NOT_FULLY_GRADED') {
                setReleaseMessage({
                    type: 'warning',
                    text: 'Toutes les copies ne sont pas encore corrigees.'
                })
            } else {
                console.error('Release results error:', data)
                setReleaseMessage({
                    type: 'error',
                    text: 'Une erreur est survenue lors de la publication des resultats.'
                })
            }
        } catch (error) {
            console.error('Error releasing results:', error)
            setReleaseMessage({
                type: 'error',
                text: 'Une erreur est survenue lors de la publication des resultats.'
            })
        } finally {
            setIsReleasing(false)
        }
    }

    const getFilterLabel = (filter: FilterOption) => {
        switch (filter) {
            case 'all': return 'Toutes les copies'
            case 'ungraded': return 'Non corrigees'
            case 'graded': return 'Corrigees'
            case 'modified': return 'Modifiees'
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
                        Retour a l&apos;examen
                    </button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Correction</h1>
                            <p className="text-gray-600 mt-1">{examTitle}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <GradeAllButton examId={examId} onComplete={fetchAttempts} onPublishAfterGrading={handleReleaseResults} />

                            {/* Actions dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                    Actions
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                {showActionsDropdown && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                        <button
                                            disabled
                                            className="w-full px-4 py-2 text-left text-gray-400 cursor-not-allowed flex items-center gap-2 hover:bg-gray-50"
                                            title="Disponible bientot"
                                        >
                                            <FileDown className="w-4 h-4" />
                                            Exporter les notes
                                        </button>
                                        <button
                                            disabled
                                            className="w-full px-4 py-2 text-left text-gray-400 cursor-not-allowed flex items-center gap-2 hover:bg-gray-50"
                                            title="Disponible bientot"
                                        >
                                            <FileText className="w-4 h-4" />
                                            Telecharger rapport
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Publish button */}
                            <button
                                onClick={() => canPublish ? setShowPublishConfirm(true) : null}
                                disabled={isReleasing || !canPublish}
                                className={`px-4 py-2 font-semibold rounded-lg transition-colors ${
                                    canPublish
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                                title={!canPublish ? 'Toutes les copies doivent etre corrigees' : undefined}
                            >
                                {isReleasing ? 'Publication...' : 'Rendre les copies'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Statistics summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">Copies corrigees</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.graded} <span className="text-lg text-gray-500">sur {stats.total}</span>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">Modifications manuelles</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.humanModified} <span className="text-lg text-gray-500">copies</span>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">Score moyen</div>
                        <div className="text-2xl font-bold text-gray-900">
                            {stats.avgMaxPoints > 0 ? (
                                <>
                                    {stats.avgScore.toFixed(1)} <span className="text-lg text-gray-500">/ {stats.avgMaxPoints}</span>
                                </>
                            ) : (
                                <span className="text-gray-400">-</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress bar (only show if not all graded) */}
                {!stats.allGraded && stats.total > 0 && (
                    <div className="bg-white rounded-lg shadow p-4 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-700">Progression de la correction</span>
                            <span className="text-sm text-gray-500">{stats.graded}/{stats.total} copies corrigees</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${stats.percentage}%` }}
                            />
                        </div>
                    </div>
                )}

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

                {/* Publish confirmation modal */}
                {showPublishConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowPublishConfirm(false)}
                        />
                        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Publier les notes ?
                            </h3>
                            <p className="text-gray-600 mb-2">
                                Etes-vous sur de vouloir publier les notes ?
                            </p>
                            <p className="text-gray-600 mb-4">
                                Les etudiants pourront voir leurs notes et les commentaires.
                            </p>
                            <div className="bg-blue-50 text-blue-800 px-3 py-2 rounded-lg mb-6 text-sm">
                                {gradedCount} copies seront publiees
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowPublishConfirm(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleReleaseResults}
                                    disabled={isReleasing}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
                                >
                                    {isReleasing ? 'Publication...' : 'Publier'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter dropdown */}
                <div className="mb-4 flex items-center gap-4">
                    <div className="relative">
                        <button
                            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            <Filter className="w-4 h-4" />
                            {getFilterLabel(filterOption)}
                            <ChevronDown className="w-4 h-4" />
                        </button>
                        {showFilterDropdown && (
                            <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                {(['all', 'ungraded', 'graded', 'modified'] as FilterOption[]).map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => {
                                            setFilterOption(option)
                                            setShowFilterDropdown(false)
                                        }}
                                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                                            filterOption === option ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                                        }`}
                                    >
                                        {getFilterLabel(option)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {filterOption !== 'all' && (
                        <span className="text-sm text-gray-500">
                            {filteredAttempts.length} resultat{filteredAttempts.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Attempts table */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('name')}
                                >
                                    Etudiant
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('submittedAt')}
                                >
                                    Statut
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
                            {sortedAttempts.map((attempt, index) => {
                                const isSubmitted = ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'].includes(attempt.status)
                                const hasScore = attempt.totalScore !== null
                                const hasHumanModifications = attempt.humanModifiedCount > 0

                                return (
                                    <tr
                                        key={attempt.attemptId}
                                        className={`hover:bg-indigo-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{attempt.student.name}</div>
                                            <div className="text-sm text-gray-500">{attempt.student.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {getStatusLabel(attempt.status)}
                                                {hasHumanModifications && (
                                                    <span
                                                        className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700"
                                                        title={`${attempt.humanModifiedCount} question${attempt.humanModifiedCount > 1 ? 's' : ''} modifiee${attempt.humanModifiedCount > 1 ? 's' : ''} par le professeur`}
                                                    >
                                                        Modifie
                                                    </span>
                                                )}
                                            </div>
                                            {attempt.submittedAt && (
                                                <span className="text-xs text-gray-500">
                                                    {new Date(attempt.submittedAt).toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {hasScore ? (
                                                <div className="text-sm font-bold text-gray-900">
                                                    {attempt.totalScore}{attempt.maxPoints ? ` / ${attempt.maxPoints}` : ''} pts
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400">Non corrige</span>
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
                                                    Non disponible
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
                            {filterOption === 'all'
                                ? 'Aucune copie trouvee pour cet examen.'
                                : `Aucune copie correspondant au filtre "${getFilterLabel(filterOption)}".`}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

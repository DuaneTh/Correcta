'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, UserCheck, Check, Loader2 } from 'lucide-react'
import MathRenderer from '@/components/exams/MathRenderer'
import SegmentedMathField from '@/components/exams/SegmentedMathField'
import { getCsrfToken } from '@/lib/csrfClient'
import { ContentSegment } from '@/types/exams'
import { stringToSegments, segmentsToLatexString } from '@/lib/content'

interface GradingData {
    attempt: {
        id: string
        student: { name: string, email: string }
        startedAt: string
        submittedAt: string
        status: string
    }
    exam: {
        id: string
        title: string
        sections: {
            id: string
            title: string
            questions: {
                id: string
                content: string
                maxPoints: number
                answer: {
                    id: string
                    segments: { id: string, content: string }[]
                } | null
                grade: {
                    id: string
                    score: number
                    feedback: string | null
                    aiRationale: string | null
                    isOverridden: boolean
                    gradedByUserId: string | null
                } | null
            }[]
        }[]
    }
}

interface AttemptDetailModalProps {
    attemptId: string
    isOpen: boolean
    onClose: () => void
    onGradeUpdated?: () => void
}

// Round to nearest 0.25
const roundToQuarter = (value: number): number => {
    return Math.round(value * 4) / 4
}

export function AttemptDetailModal({ attemptId, isOpen, onClose, onGradeUpdated }: AttemptDetailModalProps) {
    const [data, setData] = useState<GradingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Local state for grades - use string for score to allow empty input
    const [grades, setGrades] = useState<Record<string, string>>({})
    const [feedbackSegments, setFeedbackSegments] = useState<Record<string, ContentSegment[]>>({})
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [saved, setSaved] = useState<Record<string, boolean>>({})

    const fetchData = useCallback(async () => {
        if (!attemptId) return

        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/attempts/${attemptId}/grading`)
            if (!res.ok) {
                throw new Error('Failed to fetch attempt data')
            }
            const json = await res.json()
            setData(json)
            initializeState(json)
        } catch (err) {
            console.error('Error fetching attempt:', err)
            setError('Erreur lors du chargement des données')
        } finally {
            setLoading(false)
        }
    }, [attemptId])

    useEffect(() => {
        if (isOpen && attemptId) {
            fetchData()
        }
    }, [isOpen, attemptId, fetchData])

    const initializeState = (data: GradingData) => {
        const initialGrades: Record<string, string> = {}
        const initialFeedbacks: Record<string, ContentSegment[]> = {}

        data.exam.sections.forEach(section => {
            section.questions.forEach(q => {
                if (q.grade) {
                    initialGrades[q.id] = String(q.grade.score)
                    initialFeedbacks[q.id] = stringToSegments(q.grade.feedback || '')
                } else {
                    initialGrades[q.id] = '0'
                    initialFeedbacks[q.id] = stringToSegments('')
                }
            })
        })

        setGrades(initialGrades)
        setFeedbackSegments(initialFeedbacks)
    }

    const saveGrade = useCallback(async (questionId: string, answerId: string, scoreStr: string, segments: ContentSegment[]) => {
        const score = parseFloat(scoreStr) || 0
        const feedback = segmentsToLatexString(segments)

        setSaving(prev => ({ ...prev, [questionId]: true }))
        setSaved(prev => ({ ...prev, [questionId]: false }))

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch('/api/grades', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({ answerId, score, feedback })
            })

            if (res.ok) {
                const data = await res.json()
                if (data.grade?.score !== undefined) {
                    setGrades(prev => ({ ...prev, [questionId]: String(data.grade.score) }))
                }
                setSaved(prev => ({ ...prev, [questionId]: true }))
                setTimeout(() => setSaved(prev => ({ ...prev, [questionId]: false })), 2000)
                onGradeUpdated?.()
            }
        } catch (error) {
            console.error('Failed to save grade:', error)
        } finally {
            setSaving(prev => ({ ...prev, [questionId]: false }))
        }
    }, [onGradeUpdated])

    const handleScoreChange = (questionId: string, value: string) => {
        // Allow free typing - validation happens on blur
        setGrades(prev => ({ ...prev, [questionId]: value }))
    }

    const handleScoreBlur = (questionId: string, maxPoints: number) => {
        const value = grades[questionId]

        // If empty, reset to 0
        if (value === '') {
            setGrades(prev => ({ ...prev, [questionId]: '0' }))
            return
        }

        const numValue = parseFloat(value)
        if (!isNaN(numValue)) {
            // Clamp to valid range and round to nearest 0.25
            const clamped = Math.min(Math.max(0, numValue), maxPoints)
            const rounded = roundToQuarter(clamped)
            setGrades(prev => ({ ...prev, [questionId]: String(rounded) }))
        } else {
            // Invalid input, reset to 0
            setGrades(prev => ({ ...prev, [questionId]: '0' }))
        }
    }

    // Calculate totals
    const { totalScore, totalMaxPoints } = data?.exam.sections.reduce(
        (acc, section) => {
            section.questions.forEach(q => {
                acc.totalMaxPoints += q.maxPoints
                acc.totalScore += parseFloat(grades[q.id]) || 0
            })
            return acc
        },
        { totalScore: 0, totalMaxPoints: 0 }
    ) ?? { totalScore: 0, totalMaxPoints: 0 }

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header - Fixed */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <div>
                        {data && (
                            <>
                                <h2 className="text-xl font-bold text-gray-900">{data.attempt.student.name}</h2>
                                <p className="text-sm text-gray-500">{data.attempt.student.email}</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Soumis le {new Date(data.attempt.submittedAt).toLocaleString()}
                                </p>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {data && (
                            <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">
                                    {totalScore % 1 === 0 ? totalScore : totalScore.toFixed(2)} <span className="text-lg text-gray-400">/ {totalMaxPoints}</span>
                                </div>
                                <div className="text-xs text-gray-500">Score total</div>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                    )}

                    {error && (
                        <div className="text-center py-12 text-red-600">{error}</div>
                    )}

                    {data && !loading && (
                        <div className="space-y-6">
                            {data.exam.sections.map((section, sectionIndex) => (
                                <div key={section.id}>
                                    {section.title?.trim() && (
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
                                            {section.title}
                                        </h3>
                                    )}

                                    <div className="space-y-6">
                                        {section.questions.map((question, qIndex) => {
                                            const answerId = question.answer?.id
                                            if (!answerId) return null

                                            const currentScore = grades[question.id] ?? '0'
                                            const currentFeedback = feedbackSegments[question.id] ?? []
                                            const isSaving = saving[question.id]
                                            const isSaved = saved[question.id]

                                            const isAiGrade = question.grade && question.grade.gradedByUserId === null && !question.grade.isOverridden
                                            const isHumanModified = question.grade?.isOverridden || (question.grade && question.grade.gradedByUserId !== null)

                                            return (
                                                <div key={question.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                    {/* Question header */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 text-xs font-semibold bg-gray-200 text-gray-700 rounded">
                                                                Q{sectionIndex * 10 + qIndex + 1}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {question.maxPoints} pts
                                                            </span>
                                                            {isAiGrade && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                                    <Sparkles className="w-3 h-3" />
                                                                    IA
                                                                </span>
                                                            )}
                                                            {isHumanModified && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                                                    <UserCheck className="w-3 h-3" />
                                                                    Modifié
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {/* Save indicator */}
                                                            {isSaving && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                                                            {isSaved && <Check className="w-4 h-4 text-gray-500" />}
                                                        </div>
                                                    </div>

                                                    {/* Question content */}
                                                    <div className="text-sm text-gray-900 mb-3">
                                                        <MathRenderer text={question.content} />
                                                    </div>

                                                    {/* Student answer */}
                                                    <div className="bg-white p-3 rounded border border-gray-200 mb-3">
                                                        <div className="text-xs font-medium text-gray-500 uppercase mb-1">Réponse</div>
                                                        <div className="text-sm text-gray-800">
                                                            {question.answer?.segments && question.answer.segments.length > 0 ? (
                                                                question.answer.segments.map((s, i) => (
                                                                    <div key={s.id || i}>
                                                                        <MathRenderer text={s.content} />
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="italic text-gray-400">Aucune réponse</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* AI Rationale if present */}
                                                    {question.grade?.aiRationale && (
                                                        <div className="bg-gray-100 p-3 rounded border border-gray-200 mb-3">
                                                            <div className="text-xs font-medium text-gray-500 uppercase mb-1 flex items-center gap-1">
                                                                <Sparkles className="w-3 h-3" />
                                                                Raisonnement IA
                                                            </div>
                                                            <div className="text-sm text-gray-600">
                                                                <MathRenderer text={question.grade.aiRationale} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Grading section */}
                                                    <div className="bg-white p-4 rounded border border-gray-200 space-y-4">
                                                        {/* Score input */}
                                                        <div className="flex items-center gap-4">
                                                            <label className="text-sm font-medium text-gray-700">
                                                                Score
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={question.maxPoints}
                                                                    step="0.25"
                                                                    value={currentScore}
                                                                    onChange={(e) => handleScoreChange(question.id, e.target.value)}
                                                                    onBlur={() => handleScoreBlur(question.id, question.maxPoints)}
                                                                    className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 text-sm text-center"
                                                                />
                                                                <span className="text-gray-500">/ {question.maxPoints}</span>
                                                            </div>
                                                        </div>

                                                        {/* Feedback with SegmentedMathField */}
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                                Commentaire pour l'étudiant
                                                            </label>
                                                            <SegmentedMathField
                                                                value={currentFeedback}
                                                                onChange={(segments) => setFeedbackSegments(prev => ({ ...prev, [question.id]: segments }))}
                                                                placeholder="Commentaire visible par l'étudiant après publication..."
                                                                showMathButton={true}
                                                                showImageButton={false}
                                                                showTableButton={false}
                                                                showGraphButton={false}
                                                                showHint={false}
                                                                minRows={2}
                                                                compactToolbar={true}
                                                                toolbarSize="sm"
                                                                editorSize="sm"
                                                            />
                                                        </div>

                                                        {/* Save button */}
                                                        <div className="flex items-center justify-end">
                                                            <button
                                                                onClick={() => saveGrade(question.id, answerId, currentScore, currentFeedback)}
                                                                disabled={isSaving}
                                                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:bg-gray-400 flex items-center gap-2"
                                                            >
                                                                {isSaving ? (
                                                                    <>
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                        Enregistrement...
                                                                    </>
                                                                ) : (
                                                                    'Enregistrer'
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

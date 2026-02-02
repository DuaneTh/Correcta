'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Sparkles, UserCheck, Check, Loader2 } from 'lucide-react'
import MathRenderer from '@/components/exams/MathRenderer'
import SegmentedMathField from '@/components/exams/SegmentedMathField'
import { getCsrfToken } from '@/lib/csrfClient'
import { ContentSegment } from '@/types/exams'
import { stringToSegments, segmentsToLatexString } from '@/lib/content'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Inline, Stack, Surface } from '@/components/ui/Layout'

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
                <Inline align="between" className="p-6 border-b border-gray-200 bg-white">
                    <Stack gap="xs">
                        {data && (
                            <>
                                <Text variant="pageTitle" className="text-xl">{data.attempt.student.name}</Text>
                                <Text variant="muted">{data.attempt.student.email}</Text>
                                <Text variant="muted">
                                    Soumis le {new Date(data.attempt.submittedAt).toLocaleString()}
                                </Text>
                            </>
                        )}
                    </Stack>
                    <Inline gap="md" align="center">
                        {data && (
                            <Stack gap="xs" className="text-right">
                                <Text as="div" className="text-2xl font-bold text-gray-900">
                                    {totalScore % 1 === 0 ? totalScore : totalScore.toFixed(2)} <Text as="span" className="text-lg text-gray-400">/ {totalMaxPoints}</Text>
                                </Text>
                                <Text variant="xsMuted">Score total</Text>
                            </Stack>
                        )}
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="p-2 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </Inline>
                </Inline>

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
                        <Stack gap="lg">
                            {data.exam.sections.map((section, sectionIndex) => (
                                <Stack gap="md" key={section.id}>
                                    {section.title?.trim() && (
                                        <Text variant="sectionTitle" className="pb-2 border-b">
                                            {section.title}
                                        </Text>
                                    )}

                                    <Stack gap="lg">
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
                                                <Surface key={question.id} tone="subtle" className="p-4">
                                                    {/* Question header */}
                                                    <Inline align="between" className="mb-3">
                                                        <Inline gap="sm" align="center">
                                                            <Badge variant="neutral">
                                                                Q{sectionIndex * 10 + qIndex + 1}
                                                            </Badge>
                                                            <Text variant="xsMuted">
                                                                {question.maxPoints} pts
                                                            </Text>
                                                            {isAiGrade && (
                                                                <Inline gap="xs" align="center">
                                                                    <Sparkles className="w-3 h-3" />
                                                                    <Text variant="xsMuted">IA</Text>
                                                                </Inline>
                                                            )}
                                                            {isHumanModified && (
                                                                <Inline gap="xs" align="center">
                                                                    <UserCheck className="w-3 h-3" />
                                                                    <Text variant="xsMuted">Modifié</Text>
                                                                </Inline>
                                                            )}
                                                        </Inline>

                                                        <Inline gap="sm" align="center">
                                                            {/* Save indicator */}
                                                            {isSaving && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                                                            {isSaved && <Check className="w-4 h-4 text-gray-500" />}
                                                        </Inline>
                                                    </Inline>

                                                    {/* Question content */}
                                                    <Stack gap="sm" className="mb-3">
                                                        <MathRenderer text={question.content} />
                                                    </Stack>

                                                    {/* Student answer */}
                                                    <Surface className="bg-white p-3 mb-3">
                                                        <Text variant="overline" className="mb-1">Réponse</Text>
                                                        <Stack gap="xs">
                                                            {question.answer?.segments && question.answer.segments.length > 0 ? (
                                                                question.answer.segments.map((s, i) => (
                                                                    <div key={s.id || i}>
                                                                        <MathRenderer text={s.content} />
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <Text variant="muted" className="italic">Aucune réponse</Text>
                                                            )}
                                                        </Stack>
                                                    </Surface>

                                                    {/* AI Rationale if present */}
                                                    {question.grade?.aiRationale && (
                                                        <Surface tone="subtle" className="p-3 mb-3">
                                                            <Inline gap="xs" align="center" className="mb-1">
                                                                <Sparkles className="w-3 h-3" />
                                                                <Text variant="overline">Raisonnement IA</Text>
                                                            </Inline>
                                                            <Text variant="muted">
                                                                <MathRenderer text={question.grade.aiRationale} />
                                                            </Text>
                                                        </Surface>
                                                    )}

                                                    {/* Grading section */}
                                                    <Surface className="bg-white p-4">
                                                        <Stack gap="md">
                                                            {/* Score input */}
                                                            <Inline gap="md" align="center">
                                                                <Text variant="label">
                                                                    Score
                                                                </Text>
                                                                <Inline gap="sm" align="center">
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
                                                                    <Text variant="muted">/ {question.maxPoints}</Text>
                                                                </Inline>
                                                            </Inline>

                                                            {/* Feedback with SegmentedMathField */}
                                                            <Stack gap="sm">
                                                                <Text variant="label">
                                                                    Commentaire pour l'étudiant
                                                                </Text>
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
                                                            </Stack>

                                                            {/* Save button */}
                                                            <Inline align="end">
                                                                <Button
                                                                    variant="primary"
                                                                    onClick={() => saveGrade(question.id, answerId, currentScore, currentFeedback)}
                                                                    disabled={isSaving}
                                                                >
                                                                    {isSaving ? (
                                                                        <>
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                            Enregistrement...
                                                                        </>
                                                                    ) : (
                                                                        'Enregistrer'
                                                                    )}
                                                                </Button>
                                                            </Inline>
                                                        </Stack>
                                                    </Surface>
                                                </Surface>
                                            )
                                        })}
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </div>
            </div>
        </div>
    )
}

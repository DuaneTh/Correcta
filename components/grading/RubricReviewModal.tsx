'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronUp, Edit2, Loader2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { RubricEditor } from './RubricEditor'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { Inline, Stack } from '@/components/ui/Layout'

interface Criterion {
    name: string
    points: number
    description: string
}

interface Rubric {
    criteria: Criterion[]
    totalPoints: number
}

interface QuestionWithRubric {
    id: string
    content: string
    order: number
    sectionTitle: string
    maxPoints: number
    generatedRubric: Rubric | null
}

interface RubricReviewModalProps {
    examId: string
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    /** If true, only generating rubrics without starting grading */
    rubricOnly?: boolean
}

export function RubricReviewModal({
    examId,
    isOpen,
    onClose,
    onConfirm,
    rubricOnly = false
}: RubricReviewModalProps) {
    const [questions, setQuestions] = useState<QuestionWithRubric[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
    const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
    const [editedRubric, setEditedRubric] = useState<Rubric | null>(null)
    const [saving, setSaving] = useState(false)
    const [confirmLoading, setConfirmLoading] = useState(false)

    const fetchQuestions = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/exams/${examId}/questions-with-rubrics`)
            if (!res.ok) {
                throw new Error('Failed to fetch questions')
            }
            const data = await res.json()
            setQuestions(data.questions || [])

            // Expand all questions by default
            const allIds = (data.questions || []).map((q: QuestionWithRubric) => q.id)
            setExpandedQuestions(new Set(allIds))
        } catch (err) {
            console.error('Error fetching questions:', err)
            setError('Erreur lors du chargement des questions')
        } finally {
            setLoading(false)
        }
    }, [examId])

    useEffect(() => {
        if (isOpen) {
            fetchQuestions()
        }
    }, [isOpen, fetchQuestions])

    const toggleQuestion = (questionId: string) => {
        setExpandedQuestions(prev => {
            const next = new Set(prev)
            if (next.has(questionId)) {
                next.delete(questionId)
            } else {
                next.add(questionId)
            }
            return next
        })
    }

    const startEditing = (question: QuestionWithRubric) => {
        setEditingQuestion(question.id)
        setEditedRubric(question.generatedRubric || {
            criteria: [{ name: 'Reponse correcte', points: question.maxPoints, description: '' }],
            totalPoints: question.maxPoints
        })
    }

    const cancelEditing = () => {
        setEditingQuestion(null)
        setEditedRubric(null)
    }

    const saveRubric = async (questionId: string) => {
        if (!editedRubric) return

        setSaving(true)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/questions/${questionId}/rubric`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({ rubric: editedRubric })
            })

            if (!res.ok) {
                throw new Error('Failed to save rubric')
            }

            // Update local state
            setQuestions(prev =>
                prev.map(q =>
                    q.id === questionId
                        ? { ...q, generatedRubric: editedRubric }
                        : q
                )
            )

            setEditingQuestion(null)
            setEditedRubric(null)
            setError(null)
        } catch (err) {
            console.error('Error saving rubric:', err)
            setError('Erreur lors de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    const handleConfirm = async () => {
        setConfirmLoading(true)
        try {
            await onConfirm()
        } finally {
            setConfirmLoading(false)
        }
    }

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen && !editingQuestion) {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, editingQuestion, onClose])

    if (!isOpen) return null

    // Truncate content for display
    const truncateContent = (content: string, maxLength: number = 100) => {
        // Try to parse as JSON (ContentSegment array)
        try {
            const parsed = JSON.parse(content)
            if (Array.isArray(parsed)) {
                const text = parsed
                    .map((seg: { type: string; text?: string; latex?: string }) =>
                        seg.type === 'text' ? seg.text : seg.type === 'math' ? `$${seg.latex}$` : ''
                    )
                    .join('')
                return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
            }
        } catch {
            // Not JSON, use as-is
        }
        return content.length > maxLength ? content.slice(0, maxLength) + '...' : content
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal - Full screen on mobile, large on desktop */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col">
                {/* Header */}
                <Inline align="between" className="p-4 border-b">
                    <Text variant="pageTitle" className="text-xl">
                        {rubricOnly ? 'Générer les barèmes' : 'Vérifier les barèmes avant correction'}
                    </Text>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </Inline>

                {/* Content - scrollable */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                    ) : error ? (
                        <Text variant="muted" className="text-red-600 text-center py-8">{error}</Text>
                    ) : questions.length === 0 ? (
                        <Text variant="muted" className="text-center py-8">
                            Aucune question TEXT a corriger
                        </Text>
                    ) : (
                        <Stack gap="md">
                            <Text variant="muted" className="mb-4">
                                Verifiez et modifiez les baremes si necessaire. Le meme bareme sera applique a toutes les copies pour garantir l&apos;equite.
                            </Text>

                            {questions.map((question, index) => (
                                <Card
                                    key={question.id}
                                    overflow="hidden"
                                >
                                    {/* Question header */}
                                    <button
                                        onClick={() => toggleQuestion(question.id)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <Stack gap="xs" className="flex-1 text-left">
                                            <Inline gap="sm" align="center">
                                                <Text variant="label" className="text-gray-900">
                                                    Question {index + 1}
                                                </Text>
                                                <Text variant="muted">
                                                    ({question.sectionTitle})
                                                </Text>
                                                <Text variant="muted">
                                                    - {question.maxPoints} pts
                                                </Text>
                                            </Inline>
                                            <Text variant="muted">
                                                {truncateContent(question.content)}
                                            </Text>
                                        </Stack>
                                        {expandedQuestions.has(question.id) ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Rubric content */}
                                    {expandedQuestions.has(question.id) && (
                                        <CardBody className="border-t">
                                            {editingQuestion === question.id ? (
                                                /* Edit mode - using RubricEditor */
                                                <RubricEditor
                                                    rubric={editedRubric}
                                                    maxPoints={question.maxPoints}
                                                    onChange={setEditedRubric}
                                                    onCancel={cancelEditing}
                                                    onSave={() => saveRubric(question.id)}
                                                    saving={saving}
                                                />
                                            ) : question.generatedRubric ? (
                                                /* Display rubric */
                                                <Stack gap="sm">
                                                    <Inline align="between">
                                                        <Text variant="label">Criteres</Text>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => startEditing(question)}
                                                            className="text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            Modifier
                                                        </Button>
                                                    </Inline>
                                                    <Stack gap="sm">
                                                        {question.generatedRubric.criteria.map((criterion, i) => (
                                                            <Inline
                                                                key={i}
                                                                gap="sm"
                                                                align="start"
                                                                className="p-2 bg-gray-50 rounded"
                                                            >
                                                                <Badge variant="info" className="flex-shrink-0">
                                                                    {criterion.points} pts
                                                                </Badge>
                                                                <Stack gap="xs" className="flex-1">
                                                                    <Text variant="label" className="text-gray-900">
                                                                        {criterion.name}
                                                                    </Text>
                                                                    <Text variant="muted">
                                                                        {criterion.description}
                                                                    </Text>
                                                                </Stack>
                                                            </Inline>
                                                        ))}
                                                    </Stack>
                                                    <Text variant="muted" className="mt-2">
                                                        Total: {question.generatedRubric.totalPoints} points
                                                    </Text>
                                                </Stack>
                                            ) : (
                                                /* No rubric yet */
                                                <Stack gap="sm" className="text-center py-4">
                                                    <Text variant="muted">
                                                        Sera genere automatiquement
                                                    </Text>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startEditing(question)}
                                                        className="text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        Creer manuellement
                                                    </Button>
                                                </Stack>
                                            )}
                                        </CardBody>
                                    )}
                                </Card>
                            ))}
                        </Stack>
                    )}
                </div>

                {/* Footer */}
                <Inline align="end" gap="sm" className="p-4 border-t bg-gray-50">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        Annuler
                    </Button>
                    <Button
                        variant={rubricOnly ? "primary" : "primary"}
                        onClick={handleConfirm}
                        disabled={loading || questions.length === 0 || confirmLoading}
                        className={rubricOnly ? '' : 'bg-green-600 hover:bg-green-700'}
                    >
                        {confirmLoading
                            ? (rubricOnly ? 'Validation...' : 'Lancement...')
                            : (rubricOnly ? 'Valider le barème' : 'Lancer la correction')
                        }
                    </Button>
                </Inline>
            </div>
        </div>
    )
}

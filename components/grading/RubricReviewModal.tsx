'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, ChevronUp, Edit2, Loader2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { RubricEditor } from './RubricEditor'

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
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {rubricOnly ? 'Générer les barèmes' : 'Vérifier les barèmes avant correction'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content - scrollable */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                    ) : error ? (
                        <div className="text-red-600 text-center py-8">{error}</div>
                    ) : questions.length === 0 ? (
                        <div className="text-gray-500 text-center py-8">
                            Aucune question TEXT a corriger
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Verifiez et modifiez les baremes si necessaire. Le meme bareme sera applique a toutes les copies pour garantir l&apos;equite.
                            </p>

                            {questions.map((question, index) => (
                                <div
                                    key={question.id}
                                    className="border rounded-lg overflow-hidden"
                                >
                                    {/* Question header */}
                                    <button
                                        onClick={() => toggleQuestion(question.id)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">
                                                    Question {index + 1}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    ({question.sectionTitle})
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    - {question.maxPoints} pts
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-1">
                                                {truncateContent(question.content)}
                                            </p>
                                        </div>
                                        {expandedQuestions.has(question.id) ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Rubric content */}
                                    {expandedQuestions.has(question.id) && (
                                        <div className="p-4 border-t">
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
                                                <div>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-medium text-gray-900">Criteres</h4>
                                                        <button
                                                            onClick={() => startEditing(question)}
                                                            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                            Modifier
                                                        </button>
                                                    </div>
                                                    <ul className="space-y-2">
                                                        {question.generatedRubric.criteria.map((criterion, i) => (
                                                            <li
                                                                key={i}
                                                                className="flex items-start gap-3 p-2 bg-gray-50 rounded"
                                                            >
                                                                <span className="flex-shrink-0 w-12 text-sm font-medium text-indigo-600">
                                                                    {criterion.points} pts
                                                                </span>
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-gray-900 text-sm">
                                                                        {criterion.name}
                                                                    </div>
                                                                    <div className="text-sm text-gray-600">
                                                                        {criterion.description}
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="mt-2 text-sm text-gray-500">
                                                        Total: {question.generatedRubric.totalPoints} points
                                                    </div>
                                                </div>
                                            ) : (
                                                /* No rubric yet */
                                                <div className="text-center py-4">
                                                    <p className="text-gray-500 text-sm">
                                                        Sera genere automatiquement
                                                    </p>
                                                    <button
                                                        onClick={() => startEditing(question)}
                                                        className="mt-2 text-sm text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        Creer manuellement
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || questions.length === 0 || confirmLoading}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                            rubricOnly
                                ? 'bg-indigo-600 hover:bg-indigo-700'
                                : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {confirmLoading
                            ? (rubricOnly ? 'Validation...' : 'Lancement...')
                            : (rubricOnly ? 'Valider le barème' : 'Lancer la correction')
                        }
                    </button>
                </div>
            </div>
        </div>
    )
}

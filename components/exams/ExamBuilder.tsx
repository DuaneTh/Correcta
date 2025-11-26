'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Save, X, GripVertical } from 'lucide-react'

interface Rubric {
    id: string
    criteria: string
    levels: any
    examples?: any
}

interface Segment {
    id: string
    instruction: string
    maxPoints: number
    rubric?: Rubric | null
}

interface Question {
    id: string
    content: string
    type: 'TEXT' | 'MCQ' | 'CODE'
    order: number
    segments: Segment[]
}

interface Section {
    id: string
    title: string
    order: number
    questions: Question[]
}

interface Exam {
    id: string
    title: string
    startAt: string
    durationMinutes: number
    course: {
        code: string
        name: string
    }
    sections: Section[]
}

interface ExamBuilderProps {
    examId: string
    initialData: Exam
    isLocked?: boolean
}

export default function ExamBuilder({ examId, initialData, isLocked = false }: ExamBuilderProps) {
    const router = useRouter()
    const [exam, setExam] = useState<Exam>(initialData)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
    const [editingSection, setEditingSection] = useState<string | null>(null)
    const [editingQuestion, setEditingQuestion] = useState<string | null>(null)
    const [editingSegment, setEditingSegment] = useState<string | null>(null)

    const reloadExam = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/full`)
            if (res.ok) {
                const data = await res.json()
                setExam(data)
                setError(null)
            } else {
                setError('Failed to load exam')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    const toggleSection = (sectionId: string) => {
        const newExpanded = new Set(expandedSections)
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId)
        } else {
            newExpanded.add(sectionId)
        }
        setExpandedSections(newExpanded)
    }

    const toggleQuestion = (questionId: string) => {
        const newExpanded = new Set(expandedQuestions)
        if (newExpanded.has(questionId)) {
            newExpanded.delete(questionId)
        } else {
            newExpanded.add(questionId)
        }
        setExpandedQuestions(newExpanded)
    }

    // Section Operations
    const addSection = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'New Section',
                    order: exam.sections.length
                })
            })
            if (res.ok) {
                await reloadExam()
            } else {
                setError('Failed to create section')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    const updateSection = async (sectionId: string, title: string) => {
        try {
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            })
            if (res.ok) {
                await reloadExam()
                setEditingSection(null)
            } else {
                setError('Failed to update section')
            }
        } catch (err) {
            setError('Network error')
        }
    }

    const deleteSection = async (sectionId: string) => {
        if (!confirm('Delete this section and all its questions? This cannot be undone.')) return

        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                await reloadExam()
            } else {
                setError('Failed to delete section')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    // Question Operations
    const addQuestion = async (sectionId: string) => {
        try {
            setLoading(true)
            const section = exam.sections.find(s => s.id === sectionId)
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: 'New question',
                    type: 'TEXT',
                    order: section?.questions.length || 0
                })
            })
            if (res.ok) {
                await reloadExam()
                setExpandedSections(new Set([...expandedSections, sectionId]))
            } else {
                setError('Failed to create question')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    const updateQuestion = async (sectionId: string, questionId: string, data: Partial<Question>) => {
        try {
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (res.ok) {
                await reloadExam()
                setEditingQuestion(null)
            } else {
                setError('Failed to update question')
            }
        } catch (err) {
            setError('Network error')
        }
    }

    const deleteQuestion = async (sectionId: string, questionId: string) => {
        if (!confirm('Delete this question and all its segments? This cannot be undone.')) return

        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}/questions/${questionId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                await reloadExam()
            } else {
                setError('Failed to delete question')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    // Segment Operations
    const addSegment = async (questionId: string) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instruction: 'New segment instruction',
                    maxPoints: 1
                })
            })
            if (res.ok) {
                await reloadExam()
                setExpandedQuestions(new Set([...expandedQuestions, questionId]))
            } else {
                setError('Failed to create segment')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    const updateSegment = async (questionId: string, segmentId: string, data: { instruction?: string, maxPoints?: number, rubric?: any }) => {
        try {
            const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments/${segmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (res.ok) {
                await reloadExam()
                setEditingSegment(null)
            } else {
                setError('Failed to update segment')
            }
        } catch (err) {
            setError('Network error')
        }
    }

    const deleteSegment = async (questionId: string, segmentId: string) => {
        if (!confirm('Delete this segment? This cannot be undone.')) return

        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments/${segmentId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                await reloadExam()
            } else {
                setError('Failed to delete segment')
            }
        } catch (err) {
            setError('Network error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.push('/dashboard/exams')}
                    className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center"
                >
                    ← Back to Exams
                </button>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{exam.title}</h1>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{exam.course.code}</span>
                        <span>{new Date(exam.startAt).toLocaleDateString()}</span>
                        <span>{exam.durationMinutes} minutes</span>
                    </div>
                </div>
            </div>

            {/* Lock Banner */}
            {isLocked && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-orange-800 font-medium">
                        🔒 Cet examen est verrouillé : il n'est plus modifiable moins de 10 minutes avant le début.
                    </p>
                </div>
            )}

            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4 flex justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50">
                    <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
                        <span className="text-gray-700">Saving...</span>
                    </div>
                </div>
            )}

            {/* Sections */}
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-800">Exam Content</h2>
                    <button
                        onClick={addSection}
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || isLocked}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Section
                    </button>
                </div>

                {exam.sections.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500">No sections yet. Add your first section to start building the exam.</p>
                    </div>
                ) : (
                    exam.sections.map((section, sectionIdx) => (
                        <div key={section.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                            {/* Section Header */}
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1">
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className="text-gray-600 hover:text-gray-800"
                                    >
                                        {expandedSections.has(section.id) ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronUp className="w-5 h-5" />
                                        )}
                                    </button>
                                    {editingSection === section.id ? (
                                        <input
                                            type="text"
                                            defaultValue={section.title}
                                            onBlur={(e) => updateSection(section.id, e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    updateSection(section.id, e.currentTarget.value)
                                                }
                                            }}
                                            autoFocus
                                            className="flex-1 px-2 py-1 border border-indigo-300 rounded focus:ring-indigo-500"
                                        />
                                    ) : (
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {sectionIdx + 1}. {section.title}
                                        </h3>
                                    )}
                                    <span className="text-sm text-gray-500">
                                        ({section.questions.length} question{section.questions.length !== 1 ? 's' : ''})
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setEditingSection(section.id)}
                                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Edit title"
                                        disabled={isLocked}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteSection(section.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Delete section"
                                        disabled={isLocked}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Section Content (Questions) */}
                            {expandedSections.has(section.id) && (
                                <div className="p-4 space-y-4">
                                    <button
                                        onClick={() => addQuestion(section.id)}
                                        className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={loading || isLocked}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add Question
                                    </button>

                                    {section.questions.map((question, questionIdx) => (
                                        <div key={question.id} className="border border-gray-200 rounded-lg">
                                            {/* Question Header */}
                                            <div className="p-3 bg-gray-50 flex items-center justify-between">
                                                <div className="flex items-center space-x-3 flex-1">
                                                    <button
                                                        onClick={() => toggleQuestion(question.id)}
                                                        className="text-gray-600 hover:text-gray-800"
                                                    >
                                                        {expandedQuestions.has(question.id) ? (
                                                            <ChevronDown className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronUp className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <span className="text-sm font-medium text-gray-700">
                                                        Q{questionIdx + 1}
                                                    </span>
                                                    <select
                                                        value={question.type}
                                                        onChange={(e) => updateQuestion(section.id, question.id, { type: e.target.value as any })}
                                                        className="text-xs px-2 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={isLocked}
                                                    >
                                                        <option value="TEXT">Text</option>
                                                        <option value="MCQ">MCQ</option>
                                                        <option value="CODE">Code</option>
                                                    </select>
                                                    {editingQuestion === question.id ? (
                                                        <input
                                                            type="text"
                                                            defaultValue={question.content}
                                                            onBlur={(e) => updateQuestion(section.id, question.id, { content: e.target.value })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    updateQuestion(section.id, question.id, { content: e.currentTarget.value })
                                                                }
                                                            }}
                                                            autoFocus
                                                            className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded"
                                                        />
                                                    ) : (
                                                        <span className="text-sm text-gray-900">{question.content}</span>
                                                    )}
                                                    <span className="text-xs text-gray-500">
                                                        ({question.segments.length} segment{question.segments.length !== 1 ? 's' : ''})
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => setEditingQuestion(question.id)}
                                                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Edit question"
                                                        disabled={isLocked}
                                                    >
                                                        <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteQuestion(section.id, question.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Delete question"
                                                        disabled={isLocked}
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Question Content (Segments) */}
                                            {expandedQuestions.has(question.id) && (
                                                <div className="p-3 space-y-2 bg-white">
                                                    <button
                                                        onClick={() => addSegment(question.id)}
                                                        className="flex items-center px-2 py-1 bg-gray-50 text-gray-600 rounded text-xs hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        disabled={loading || isLocked}
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" />
                                                        Add Segment
                                                    </button>

                                                    {question.segments.map((segment, segmentIdx) => (
                                                        <div key={segment.id} className="border border-gray-200 rounded p-3 bg-gray-50">
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex-1 space-y-2">
                                                                    <div className="flex items-center space-x-2">
                                                                        <span className="text-xs font-medium text-gray-600">
                                                                            Segment {segmentIdx + 1}
                                                                        </span>
                                                                        {editingSegment === segment.id ? (
                                                                            <input
                                                                                type="number"
                                                                                step="0.5"
                                                                                defaultValue={segment.maxPoints}
                                                                                onBlur={(e) => updateSegment(question.id, segment.id, { maxPoints: parseFloat(e.target.value) })}
                                                                                className="w-16 px-2 py-1 text-xs border border-indigo-300 rounded"
                                                                                placeholder="Points"
                                                                            />
                                                                        ) : (
                                                                            <span className="text-xs text-indigo-600 font-semibold">
                                                                                {segment.maxPoints} pts
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {editingSegment === segment.id ? (
                                                                        <textarea
                                                                            defaultValue={segment.instruction}
                                                                            onBlur={(e) => updateSegment(question.id, segment.id, { instruction: e.target.value })}
                                                                            className="w-full px-2 py-1 text-xs border border-indigo-300 rounded"
                                                                            rows={2}
                                                                        />
                                                                    ) : (
                                                                        <p className="text-xs text-gray-700">{segment.instruction}</p>
                                                                    )}
                                                                    {segment.rubric && (
                                                                        <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                                                                            <span className="font-medium">Rubric: </span>
                                                                            {segment.rubric.criteria || 'No criteria set'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center space-x-1 ml-2">
                                                                    <button
                                                                        onClick={() => setEditingSegment(segment.id)}
                                                                        className="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Edit segment"
                                                                        disabled={isLocked}
                                                                    >
                                                                        <Edit2 className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteSegment(question.id, segment.id)}
                                                                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                                        title="Delete segment"
                                                                        disabled={isLocked}
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

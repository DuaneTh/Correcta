'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ExternalLink, Clock } from 'lucide-react'
import Link from 'next/link'
import { getCsrfToken } from '@/lib/csrfClient'

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
                } | null
            }[]
        }[]
    }
}

interface AntiCheatData {
    antiCheatScore: number
    eventCounts: Record<string, number>
    totalEvents: number
    copyPasteAnalysis: {
        totalPairs: number
        suspiciousPairs: number
        strongPairs: number
    }
}

interface GradingViewProps {
    examId: string
    attemptId: string
}

export default function GradingView({ examId, attemptId }: GradingViewProps) {
    const router = useRouter()
    const [data, setData] = useState<GradingData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<Record<string, boolean>>({}) // questionId -> boolean
    const [saved, setSaved] = useState<Record<string, boolean>>({}) // questionId -> boolean
    const [totalScore, setTotalScore] = useState(0)
    const [totalMaxPoints, setTotalMaxPoints] = useState(0)

    // Local state for inputs to allow smooth typing
    const [grades, setGrades] = useState<Record<string, number>>({}) // questionId -> score
    const [feedbacks, setFeedbacks] = useState<Record<string, string>>({}) // questionId -> feedback

    // AI Grading State
    const [aiStatus, setAiStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [isAiLoading, setIsAiLoading] = useState(false)

    // Anti-Cheat State
    const [antiCheatData, setAntiCheatData] = useState<AntiCheatData | null>(null)
    const [antiCheatLoading, setAntiCheatLoading] = useState(true)

    const handleAiGrading = async () => {
        setIsAiLoading(true)
        setAiStatus(null)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/attempts/${attemptId}/grading/enqueue-ai`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })
            const data = await res.json()

            if (res.ok) {
                setAiStatus({
                    type: 'success',
                    message: 'Correction automatique lancée (stub IA). Actualisez après quelques secondes.'
                })
            } else {
                setAiStatus({
                    type: 'error',
                    message: data.message || 'Erreur lors du lancement de la correction IA.'
                })
            }
        } catch {
            setAiStatus({
                type: 'error',
                message: 'Erreur de connexion.'
            })
        } finally {
            setIsAiLoading(false)
        }
    }

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/attempts/${attemptId}/grading`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
                initializeState(json)
            }
        } catch (error) {
            console.error('Failed to fetch grading data', error)
        } finally {
            setLoading(false)
        }
    }, [attemptId])

    const fetchAntiCheatData = useCallback(async () => {
        try {
            const res = await fetch(`/api/attempts/${attemptId}/anti-cheat`)
            if (res.ok) {
                const json = await res.json()
                setAntiCheatData(json)
            }
        } catch (error) {
            console.error('Failed to fetch anti-cheat data', error)
        } finally {
            setAntiCheatLoading(false)
        }
    }, [attemptId])

    useEffect(() => {
        getCsrfToken().catch(() => {
            // CSRF token will be fetched lazily on mutation
        })
    }, [])

    useEffect(() => {
        fetchData()
        fetchAntiCheatData()
    }, [attemptId, fetchData, fetchAntiCheatData])

    const initializeState = (data: GradingData) => {
        const initialGrades: Record<string, number> = {}
        const initialFeedbacks: Record<string, string> = {}
        let score = 0
        let max = 0

        data.exam.sections.forEach(section => {
            section.questions.forEach(q => {
                max += q.maxPoints
                if (q.grade) {
                    initialGrades[q.id] = q.grade.score
                    initialFeedbacks[q.id] = q.grade.feedback || ''
                    score += q.grade.score
                }
            })
        })

        setGrades(initialGrades)
        setFeedbacks(initialFeedbacks)
        setTotalScore(score)
        setTotalMaxPoints(max)
    }

    // Helper functions for anti-cheat display
    const getSuspicionColor = (score: number) => {
        if (score === 0) return 'bg-green-100 text-green-800 border-green-200'
        if (score <= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        if (score <= 8) return 'bg-orange-100 text-orange-800 border-orange-200'
        return 'bg-red-100 text-red-800 border-red-200'
    }

    const getSuspicionLabel = (score: number) => {
        if (score === 0) return 'Aucun'
        if (score <= 3) return 'Faible'
        if (score <= 8) return 'Moyen'
        return 'Élevé'
    }

    const generateExplanation = (eventCounts: Record<string, number>) => {
        const parts = []
        if (eventCounts.FOCUS_LOST > 0) parts.push(`${eventCounts.FOCUS_LOST} perte${eventCounts.FOCUS_LOST > 1 ? 's' : ''} de focus`)
        if (eventCounts.TAB_SWITCH > 0) parts.push(`${eventCounts.TAB_SWITCH} changement${eventCounts.TAB_SWITCH > 1 ? 's' : ''} d'onglet`)
        if (eventCounts.COPY > 0) parts.push(`${eventCounts.COPY} copie${eventCounts.COPY > 1 ? 's' : ''}`)
        if (eventCounts.PASTE > 0) parts.push(`${eventCounts.PASTE} collage${eventCounts.PASTE > 1 ? 's' : ''}`)

        if (parts.length === 0) return 'Aucun comportement suspect détecté.'
        return parts.join(', ') + '.'
    }

    // Save function - uses server response to update local state
    const saveGrade = useCallback(async (questionId: string, answerId: string, score: number, feedback: string) => {
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
                body: JSON.stringify({
                    answerId,
                    score,
                    feedback
                })
            })

            if (res.ok) {
                const data = await res.json()
                // Use server's clamped score in response
                if (data.grade && data.grade.score !== undefined) {
                    setGrades(prev => {
                        const newGrades = { ...prev, [questionId]: data.grade.score }
                        // Recompute total with server's value
                        const newTotal = Object.values(newGrades).reduce((a, b) => a + b, 0)
                        setTotalScore(newTotal)
                        return newGrades
                    })
                }
                setSaved(prev => ({ ...prev, [questionId]: true }))
                setTimeout(() => {
                    setSaved(prev => ({ ...prev, [questionId]: false }))
                }, 2000)
            } else {
                // Handle error (e.g., show error message)
                console.error('Failed to save grade:', await res.text())
            }
        } catch (error) {
            console.error('Failed to save grade', error)
        } finally {
            setSaving(prev => ({ ...prev, [questionId]: false }))
        }
    }, [])

    const handleScoreChange = (questionId: string, answerId: string, value: string) => {
        const numValue = parseFloat(value)
        if (isNaN(numValue)) {
            // Allow empty/invalid, will be handled on blur
            return
        }

        // Update local state immediately for responsive UI
        setGrades(prev => ({ ...prev, [questionId]: numValue }))
    }

    const handleScoreBlur = (questionId: string, answerId: string) => {
        const score = grades[questionId]
        if (score !== undefined) {
            saveGrade(questionId, answerId, score, feedbacks[questionId] || '')
        }
    }

    const handleFeedbackChange = (questionId: string, answerId: string, value: string) => {
        setFeedbacks(prev => ({ ...prev, [questionId]: value }))
    }

    const handleFeedbackBlur = (questionId: string, answerId: string) => {
        const score = grades[questionId]
        if (score !== undefined) {
            saveGrade(questionId, answerId, score, feedbacks[questionId] || '')
        }
    }

    if (loading || !data) return <div className="p-8 text-center">Loading...</div>

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8 sticky top-0 bg-gray-50 z-10 py-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <button
                            onClick={() => router.push(`/dashboard/exams/${examId}/grading`)}
                            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Grading List
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">{data.attempt.student.name}</h1>
                        <p className="text-sm text-gray-500">{data.exam.title} • Submitted: {new Date(data.attempt.submittedAt).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-indigo-600">
                            {totalScore} <span className="text-lg text-gray-400">/ {totalMaxPoints}</span>
                        </div>
                        <div className="text-sm text-gray-500">Total Score</div>
                        <div className="flex flex-col items-end mt-2 space-y-2">
                            <Link
                                href={`/dashboard/exams/${examId}/proctoring/${attemptId}`}
                                target="_blank"
                                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                            >
                                View Proctoring Log <ExternalLink className="w-3 h-3 ml-1" />
                            </Link>

                            <button
                                onClick={handleAiGrading}
                                disabled={isAiLoading}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {isAiLoading ? 'Lancement...' : 'Correction automatique (IA)'}
                            </button>

                            {aiStatus && (
                                <div className={`text-xs ${aiStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {aiStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Anti-Cheat Panel */}
            {!antiCheatLoading && antiCheatData && (
                <div className="mb-8 bg-white shadow rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Anti-triche</h3>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Score Badge and Explanation */}
                        <div>
                            <div className="mb-3">
                                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${getSuspicionColor(antiCheatData.antiCheatScore)}`}>
                                    Score de suspicion (heuristique) : {antiCheatData.antiCheatScore} – {getSuspicionLabel(antiCheatData.antiCheatScore)}
                                </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-4">
                                {generateExplanation(antiCheatData.eventCounts)}
                            </p>

                            {/* Copy/Paste Pattern Warnings */}
                            {antiCheatData.copyPasteAnalysis.strongPairs > 0 && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <p className="text-sm text-red-800 font-medium">
                                        ⚠️ Pattern de triche copy/paste détecté ({antiCheatData.copyPasteAnalysis.strongPairs} occurrence{antiCheatData.copyPasteAnalysis.strongPairs > 1 ? 's' : ''} avec changement d&apos;onglet ou perte de focus entre copie et collage et longueurs différentes).
                                    </p>
                                </div>
                            )}
                            {antiCheatData.copyPasteAnalysis.suspiciousPairs > 0 && !antiCheatData.copyPasteAnalysis.strongPairs && (
                                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                                    <p className="text-sm text-orange-800 font-medium">
                                        ⚠️ Comportement copy/paste suspect détecté ({antiCheatData.copyPasteAnalysis.suspiciousPairs} paire{antiCheatData.copyPasteAnalysis.suspiciousPairs > 1 ? 's' : ''} avec longueurs de copie/collage différentes).
                                    </p>
                                </div>
                            )}

                            {/* Event Details */}
                            <div className="text-xs text-gray-600 space-y-1">
                                <div>FOCUS_LOST: {antiCheatData.eventCounts.FOCUS_LOST || 0}</div>
                                <div>TAB_SWITCH: {antiCheatData.eventCounts.TAB_SWITCH || 0}</div>
                                <div>COPY: {antiCheatData.eventCounts.COPY || 0}</div>
                                <div>PASTE: {antiCheatData.eventCounts.PASTE || 0}</div>
                                <div className="font-medium pt-1 border-t border-gray-200 mt-2">Total événements: {antiCheatData.totalEvents}</div>
                            </div>
                        </div>

                        {/* AI Grading Button */}
                        <div className="flex flex-col justify-center">
                            <button
                                onClick={handleAiGrading}
                                disabled={isAiLoading}
                                className="w-full px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {isAiLoading ? 'Lancement...' : 'Lancer la correction IA sur cette copie'}
                            </button>

                            {aiStatus && (
                                <div className={`mt-3 text-sm ${aiStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {aiStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Questions */}
            <div className="space-y-8 pb-20">
                {data.exam.sections.map(section => (
                    <div key={section.id} className="space-y-6">
                        {section.title?.trim() && (
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">{section.title}</h2>
                        )}
                        {section.questions.map((question, index) => {
                            const answerId = question.answer?.id
                            if (!answerId) return null // Should not happen for submitted attempts usually

                            const currentScore = grades[question.id] ?? 0
                            const currentFeedback = feedbacks[question.id] ?? ''
                            const isSaving = saving[question.id]
                            const isSaved = saved[question.id]

                            return (
                                <div key={question.id} className="bg-white shadow rounded-lg p-6 border border-gray-200">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded mb-2">
                                                Question {index + 1} • {question.maxPoints} pts
                                            </span>
                                            <div className="text-lg text-gray-900 font-medium mb-4">
                                                {question.content}
                                            </div>
                                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                                                <h4 className="text-xs font-bold text-blue-800 uppercase mb-1">Student Answer</h4>
                                                <div className="text-gray-800 whitespace-pre-wrap">
                                                    {question.answer?.segments.map(s => s.content).join('\n') || <span className="italic text-gray-400">No answer provided</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-6 w-64 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="mb-4">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Score (0 - {question.maxPoints})</label>
                                                <div className="flex items-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={question.maxPoints}
                                                        value={currentScore}
                                                        onChange={(e) => handleScoreChange(question.id, answerId, e.target.value)}
                                                        onBlur={() => handleScoreBlur(question.id, answerId)}
                                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    />
                                                    <span className="ml-2 text-gray-500 text-sm">/ {question.maxPoints}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Feedback / Comment</label>
                                                <textarea
                                                    rows={3}
                                                    value={currentFeedback}
                                                    onChange={(e) => handleFeedbackChange(question.id, answerId, e.target.value)}
                                                    onBlur={() => handleFeedbackBlur(question.id, answerId)}
                                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                                    placeholder="Good job..."
                                                />
                                            </div>
                                            <div className="mt-2 h-5 flex items-center justify-end text-xs">
                                                {isSaving && <span className="text-gray-500 flex items-center"><Clock className="w-3 h-3 mr-1" /> Saving...</span>}
                                                {isSaved && <span className="text-green-600 flex items-center"><Check className="w-3 h-3 mr-1" /> Saved</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </div>
    )
}

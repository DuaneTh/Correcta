'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import MathRenderer from '@/components/exams/MathRenderer'

interface ResultData {
    examTitle: string
    studentName: string
    submittedAt: string
    totalScore: number
    totalMaxPoints: number
    sections: {
        id: string
        title: string
        questions: {
            id: string
            content: string
            maxPoints: number
            answer: {
                segments: string[]
            } | null
            grade: {
                score: number
                feedback: string | null
            } | null
        }[]
    }[]
}

interface ResultsViewProps {
    attemptId: string
    dictionary: Dictionary
}

export default function ResultsView({ attemptId, dictionary }: ResultsViewProps) {
    const router = useRouter()
    const [data, setData] = useState<ResultData | null>(null)
    const [loading, setLoading] = useState(true)
    const [resultsNotAvailable, setResultsNotAvailable] = useState(false)
    const [resultsNotReleased, setResultsNotReleased] = useState(false)

    const dict = dictionary.student.attemptResults

    const fetchResults = useCallback(async () => {
        try {
            const res = await fetch(`/api/attempts/${attemptId}/results`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
                setResultsNotAvailable(false)
                setResultsNotReleased(false)
            } else if (res.status === 403) {
                const json = await res.json()
                if (json.error === 'RESULTS_NOT_AVAILABLE') {
                    setResultsNotAvailable(true)
                } else if (json.error === 'RESULTS_NOT_RELEASED') {
                    setResultsNotReleased(true)
                }
            }
        } catch (error) {
            console.error('Failed to fetch results', error)
        } finally {
            setLoading(false)
        }
    }, [attemptId])

    useEffect(() => {
        fetchResults()
    }, [fetchResults])

    if (loading) return <div className="p-8 text-center">{dict.messages.loading}</div>

    if (resultsNotAvailable) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {dict.backLink}
                    </button>
                </div>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-lg font-medium text-yellow-800">
                                {dict.messages.notAvailableTitle}
                            </h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>
                                    {dict.messages.notAvailableMessage}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (resultsNotReleased) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {dict.backLink}
                    </button>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-lg font-medium text-blue-800">
                                {dict.messages.notReleasedTitle}
                            </h3>
                            <div className="mt-2 text-sm text-blue-700">
                                <p>
                                    {dict.messages.notReleasedMessage}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!data) return <div className="p-8 text-center">{dict.messages.errorLoading}</div>

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <button
                    onClick={() => router.back()}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {dict.backLink}
                </button>
                <div className="bg-white shadow rounded-lg p-6 border border-gray-200">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-brand-900">{data.examTitle}</h1>
                            <p className="text-gray-500">{dict.header.candidateLabel} : {data.studentName}</p>
                            <p className="text-sm text-gray-400">{dict.header.submittedAtLabel} : {new Date(data.submittedAt).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-4xl font-bold text-indigo-600">
                                {data.totalScore} <span className="text-xl text-gray-400">/ {data.totalMaxPoints}</span>
                            </div>
                            <div className="text-sm font-medium text-brand-900 uppercase tracking-wide">{dict.header.finalGradeLabel}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {data.sections.map(section => (
                    <div key={section.id} className="space-y-6">
                        {section.title?.trim() && (
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">{section.title}</h2>
                        )}
                        {section.questions.map((question, index) => (
                            <div key={question.id} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <span className="inline-block px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-600 rounded mb-2">
                                                {dict.questionCard.questionLabel} {index + 1} • {question.maxPoints} {dict.questionCard.pointsSuffix}
                                            </span>
                                            <MathRenderer text={question.content} className="text-lg text-gray-900 font-medium mb-4" />

                                            <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mb-4">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{dict.questionCard.yourAnswerLabel}</h4>
                                                {question.answer?.segments.length ? (
                                                    <MathRenderer text={question.answer.segments.join('\n')} className="text-gray-800 whitespace-pre-wrap" />
                                                ) : (
                                                    <span className="italic text-gray-400">{dict.questionCard.noAnswerLabel}</span>
                                                )}
                                            </div>

                                            {question.grade && (
                                                <div className="bg-indigo-50 p-4 rounded-md border border-indigo-100">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h4 className="text-xs font-bold text-indigo-800 uppercase">{dict.questionCard.correctionLabel}</h4>
                                                        <span className="text-sm font-bold text-indigo-700">
                                                            {question.grade.score} / {question.maxPoints}
                                                        </span>
                                                    </div>
                                                    {question.grade.feedback ? (
                                                        <MathRenderer text={question.grade.feedback} className="text-indigo-900 text-sm" />
                                                    ) : (
                                                        <div className="text-indigo-400 text-sm italic">
                                                            {dict.questionCard.noFeedbackLabel}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

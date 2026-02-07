'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bot } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import MathRenderer from '@/components/exams/MathRenderer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Stack } from '@/components/ui/Layout'
import { Surface } from '@/components/ui/Layout'
import { Text } from '@/components/ui/Text'
import { cn } from '@/components/ui/cn'

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
                isAiGrade?: boolean
            } | null
        }[]
    }[]
}

// Helper to determine score color based on percentage
function getScoreColor(score: number, maxPoints: number): string {
    if (maxPoints === 0) return 'text-gray-500'
    const percentage = (score / maxPoints) * 100
    if (percentage >= 70) return 'text-green-600'
    if (percentage >= 40) return 'text-yellow-600'
    return 'text-red-600'
}

// Helper to determine feedback border color
function getFeedbackBorderColor(score: number, maxPoints: number): string {
    if (maxPoints === 0) return 'border-l-gray-300'
    const percentage = (score / maxPoints) * 100
    if (percentage >= 70) return 'border-l-green-500'
    if (percentage >= 40) return 'border-l-yellow-500'
    return 'border-l-red-500'
}

// Get default feedback message when none is provided
function getDefaultFeedback(score: number, maxPoints: number): string {
    if (maxPoints === 0) return ''
    const percentage = (score / maxPoints) * 100
    if (percentage >= 70) return 'Bonne reponse !'
    if (percentage >= 40) return 'Reponse partiellement correcte.'
    if (score === 0) return 'Reponse incorrecte.'
    return 'Reponse partiellement correcte.'
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

    if (loading) return <div className="p-8 text-center"><Text variant="body">{dict.messages.loading}</Text></div>

    if (resultsNotAvailable) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Stack gap="lg">
                    <Button
                        onClick={() => router.back()}
                        variant="ghost"
                        className="w-fit"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {dict.backLink}
                    </Button>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-r-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <Text as="h3" variant="sectionTitle" className="text-yellow-800">
                                    {dict.messages.notAvailableTitle}
                                </Text>
                                <Text variant="muted" className="mt-2 text-yellow-700">
                                    {dict.messages.notAvailableMessage}
                                </Text>
                            </div>
                        </div>
                    </div>
                </Stack>
            </div>
        )
    }

    if (resultsNotReleased) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Stack gap="lg">
                    <Button
                        onClick={() => router.back()}
                        variant="ghost"
                        className="w-fit"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        {dict.backLink}
                    </Button>
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <Text as="h3" variant="sectionTitle" className="text-blue-800">
                                    {dict.messages.notReleasedTitle}
                                </Text>
                                <Text variant="muted" className="mt-2 text-blue-700">
                                    {dict.messages.notReleasedMessage}
                                </Text>
                            </div>
                        </div>
                    </div>
                </Stack>
            </div>
        )
    }

    if (!data) return <div className="p-8 text-center"><Text variant="body">{dict.messages.errorLoading}</Text></div>

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Stack gap="lg">
                <Button
                    onClick={() => router.back()}
                    variant="ghost"
                    className="w-fit"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {dict.backLink}
                </Button>
                <Card>
                    <CardBody padding="lg">
                        <div className="flex justify-between items-center">
                            <Stack gap="xs">
                                <Text as="h1" variant="pageTitle">{data.examTitle}</Text>
                                <Text variant="caption">{dict.header.candidateLabel} : {data.studentName}</Text>
                                <Text variant="xsMuted">{dict.header.submittedAtLabel} : {new Date(data.submittedAt).toLocaleString()}</Text>
                            </Stack>
                            <div className="text-right">
                                <div className="text-4xl font-bold text-indigo-600">
                                    {data.totalScore} <span className="text-xl text-gray-400">/ {data.totalMaxPoints}</span>
                                </div>
                                <Text variant="muted" className="font-medium text-brand-900 uppercase tracking-wide">{dict.header.finalGradeLabel}</Text>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Stack gap="lg">
                    {data.sections.map(section => (
                        <Stack key={section.id} gap="md">
                            {section.title?.trim() && (
                                <Text as="h2" variant="sectionTitle" className="border-b pb-2">{section.title}</Text>
                            )}
                            {section.questions.map((question, index) => (
                                <Card key={question.id}>
                                    <CardBody padding="lg">
                                        <Stack gap="sm">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                                                <Stack gap="xs" className="flex-1">
                                                    <Badge variant="neutral" className="w-fit">
                                                        {dict.questionCard.questionLabel} {index + 1} - {question.maxPoints} {dict.questionCard.pointsSuffix}
                                                    </Badge>
                                                    <MathRenderer text={question.content} className="text-lg text-gray-900 font-medium" />
                                                </Stack>
                                                {question.grade && (
                                                    <Text as="div" variant="pageTitle" className={cn(getScoreColor(question.grade.score, question.maxPoints), "sm:text-right text-2xl")}>
                                                        {question.grade.score} / {question.maxPoints}
                                                    </Text>
                                                )}
                                            </div>

                                            <Surface tone="subtle" className="p-4">
                                                <Text variant="overline" className="mb-2">{dict.questionCard.yourAnswerLabel}</Text>
                                                {question.answer?.segments.length ? (
                                                    <MathRenderer text={question.answer.segments.join('\n')} className="text-gray-800 whitespace-pre-wrap" />
                                                ) : (
                                                    <Text variant="caption" className="italic">{dict.questionCard.noAnswerLabel}</Text>
                                                )}
                                            </Surface>

                                            {question.grade && (
                                                <div className={cn("p-4 rounded-md border-l-4 bg-gray-50", getFeedbackBorderColor(question.grade.score, question.maxPoints))}>
                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                                                        <Text variant="overline">Commentaire du correcteur</Text>
                                                        {question.grade.isAiGrade && (
                                                            <Badge variant="info" className="w-fit">
                                                                <Bot className="w-3 h-3" />
                                                                Correction automatique
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {question.grade.feedback ? (
                                                        <MathRenderer text={question.grade.feedback} className="text-gray-800 text-sm" />
                                                    ) : (
                                                        <Text variant="muted">
                                                            {getDefaultFeedback(question.grade.score, question.maxPoints)}
                                                        </Text>
                                                    )}
                                                </div>
                                            )}
                                        </Stack>
                                    </CardBody>
                                </Card>
                            ))}
                        </Stack>
                    ))}
                </Stack>
            </Stack>
        </div>
    )
}

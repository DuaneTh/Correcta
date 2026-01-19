'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import QuestionRenderer from './QuestionRenderer'
import ExamTimer from './ExamTimer'
import type { ContentSegment, StudentToolsConfig } from '@/types/exams'

// Types
type QuestionSegment = {
  id: string
  instruction: string
  maxPoints: number | null
  order: number
}

type Question = {
  id: string
  content: ContentSegment[]
  answerTemplate?: ContentSegment[]
  answerTemplateLocked?: boolean
  studentTools?: StudentToolsConfig | null
  shuffleOptions?: boolean
  type: 'TEXT' | 'MCQ' | 'CODE'
  order: number
  customLabel?: string | null
  requireAllCorrect?: boolean
  maxPoints?: number | null
  segments: QuestionSegment[]
}

type Section = {
  id: string
  title: string
  order: number
  isDefault?: boolean
  customLabel?: string | null
  introContent?: ContentSegment[] | string | null
  questions: Question[]
}

type ExamData = {
  id: string
  title: string
  durationMinutes: number | null
  course: {
    code: string
    name: string
  }
  author: {
    name: string | null
  } | null
  sections: Section[]
}

type AttemptData = {
  id: string
  status: string
  startedAt: string
  deadlineAt: string
  answers: Array<{
    questionId: string
    segments: Array<{
      segmentId: string
      content: string
    }>
  }>
}

interface ExamPlayerProps {
  exam: ExamData
  attempt: AttemptData
  studentName?: string | null
  locale?: string
}

// Hash function for consistent MCQ shuffling
const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const sortByOrder = <T extends { order?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

/**
 * ExamPlayer - Main exam taking interface
 *
 * Features:
 * - Question navigation sidebar
 * - Auto-save answers with debounce
 * - Timer with auto-submit on expiry
 * - Manual submit button
 * - Supports both TEXT and MCQ questions
 */
// Helper to compute initial answers from attempt
function computeInitialAnswers(attemptAnswers: AttemptData['answers']): Record<string, string> {
  const initialAnswers: Record<string, string> = {}
  for (const answer of attemptAnswers) {
    for (const seg of answer.segments) {
      initialAnswers[seg.segmentId] = seg.content
    }
  }
  return initialAnswers
}

// Helper to compute all questions in order
function computeAllQuestions(sections: Section[]): Array<{ question: Question; sectionTitle: string; globalIndex: number }> {
  const questions: Array<{ question: Question; sectionTitle: string; globalIndex: number }> = []
  let index = 0
  for (const section of sortByOrder(sections)) {
    for (const question of sortByOrder(section.questions)) {
      index += 1
      questions.push({
        question,
        sectionTitle: section.isDefault ? '' : (section.customLabel || section.title || ''),
        globalIndex: index,
      })
    }
  }
  return questions
}

export default function ExamPlayer({
  exam,
  attempt,
  studentName,
  locale = 'fr',
}: ExamPlayerProps) {
  const router = useRouter()

  // Compute initial values once (not in effects)
  const initialAnswers = useMemo(() => computeInitialAnswers(attempt.answers), [attempt.answers])
  const allQuestions = useMemo(() => computeAllQuestions(exam.sections), [exam.sections])
  const initialQuestionId = allQuestions.length > 0 ? allQuestions[0].question.id : null

  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers)
  const [savingStatus, setSavingStatus] = useState<Record<string, 'saved' | 'saving' | 'error' | null>>({})
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(initialQuestionId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeExpired, setTimeExpired] = useState(false)

  const saveTimeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})

  const dict = {
    submitting: locale === 'fr' ? 'Soumission...' : 'Submitting...',
    submit: locale === 'fr' ? 'Soumettre' : 'Submit',
    confirmSubmit: locale === 'fr' ? 'Confirmer la soumission ?' : 'Confirm submission?',
    timeExpired: locale === 'fr' ? 'Temps ecoule - Soumission automatique...' : 'Time expired - Auto-submitting...',
    question: locale === 'fr' ? 'Question' : 'Question',
    answered: locale === 'fr' ? 'Repondu' : 'Answered',
    notAnswered: locale === 'fr' ? 'Non repondu' : 'Not answered',
    point: locale === 'fr' ? 'point' : 'point',
    points: locale === 'fr' ? 'points' : 'points',
  }

  // Current question data
  const currentQuestion = useMemo(
    () => allQuestions.find(q => q.question.id === currentQuestionId),
    [allQuestions, currentQuestionId]
  )

  // Auto-save handler with debounce
  const handleAnswerChange = useCallback((questionId: string, segmentId: string, content: string) => {
    setAnswers(prev => ({ ...prev, [segmentId]: content }))
    setSavingStatus(prev => ({ ...prev, [segmentId]: 'saving' }))

    // Clear existing timeout
    if (saveTimeoutRefs.current[segmentId]) {
      clearTimeout(saveTimeoutRefs.current[segmentId])
    }

    // Debounce save
    saveTimeoutRefs.current[segmentId] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/attempts/${attempt.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId,
            segmentId,
            content,
          }),
        })

        if (res.ok) {
          setSavingStatus(prev => ({ ...prev, [segmentId]: 'saved' }))
        } else {
          setSavingStatus(prev => ({ ...prev, [segmentId]: 'error' }))
        }
      } catch {
        setSavingStatus(prev => ({ ...prev, [segmentId]: 'error' }))
      }
    }, 2000) // 2 second debounce
  }, [attempt.id])

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return

    if (!timeExpired && !window.confirm(dict.confirmSubmit)) {
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/attempts/${attempt.id}/submit`, {
        method: 'POST',
      })

      if (res.ok) {
        router.push('/student/exams')
      } else {
        const data = await res.json()
        alert(data.error || 'Submission failed')
        setIsSubmitting(false)
      }
    } catch {
      alert('Network error')
      setIsSubmitting(false)
    }
  }, [attempt.id, isSubmitting, router, timeExpired, dict.confirmSubmit])

  // Auto-submit on time expired
  const handleTimeExpired = useCallback(() => {
    setTimeExpired(true)
    handleSubmit()
  }, [handleSubmit])

  // Check if a question has answers
  const hasAnswer = (question: Question): boolean => {
    for (const segment of question.segments) {
      const content = answers[segment.id]
      if (content && content.trim().length > 0) {
        if (question.type === 'MCQ') {
          if (content === 'true' || content === '1') return true
        } else {
          return true
        }
      }
    }
    return false
  }

  // Question value for current question
  const currentValue = useMemo(() => {
    if (!currentQuestion) return {}
    const value: Record<string, string> = {}
    for (const segment of currentQuestion.question.segments) {
      value[segment.id] = answers[segment.id] || ''
    }
    return value
  }, [currentQuestion, answers])

  // Current question's saving status
  const currentSavingStatus = useMemo(() => {
    if (!currentQuestion) return {}
    const status: Record<string, 'saved' | 'saving' | 'error' | null> = {}
    for (const segment of currentQuestion.question.segments) {
      status[segment.id] = savingStatus[segment.id] || null
    }
    return status
  }, [currentQuestion, savingStatus])

  if (timeExpired && isSubmitting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-900 mx-auto mb-4" />
          <p className="text-lg text-gray-700">{dict.timeExpired}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Question Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Exam header */}
        <div className="p-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {exam.course.code}
          </div>
          <h1 className="font-semibold text-gray-900 mt-1 line-clamp-2">
            {exam.title}
          </h1>
          {studentName && (
            <div className="text-sm text-gray-600 mt-1">
              {studentName}
            </div>
          )}
        </div>

        {/* Timer */}
        <div className="p-4 border-b border-gray-200">
          <ExamTimer
            deadlineAt={attempt.deadlineAt}
            onTimeExpired={handleTimeExpired}
            locale={locale}
          />
        </div>

        {/* Question list */}
        <nav className="flex-1 overflow-y-auto p-2">
          {allQuestions.map(({ question, sectionTitle, globalIndex }) => {
            const isActive = question.id === currentQuestionId
            const isAnswered = hasAnswer(question)

            return (
              <button
                key={question.id}
                onClick={() => setCurrentQuestionId(question.id)}
                className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${
                  isActive
                    ? 'bg-brand-100 border border-brand-300'
                    : 'hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${isActive ? 'text-brand-900' : 'text-gray-900'}`}>
                    {question.customLabel || `Q${globalIndex}`}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAnswered ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={isAnswered ? dict.answered : dict.notAnswered}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {question.type}
                  {sectionTitle && ` - ${sectionTitle}`}
                </div>
              </button>
            )
          })}
        </nav>

        {/* Submit button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-brand-900 text-white font-semibold rounded-md hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? dict.submitting : dict.submit}
          </button>
        </div>
      </aside>

      {/* Main content - Question display */}
      <main className="flex-1 p-8 overflow-y-auto">
        {currentQuestion ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <QuestionRenderer
                question={currentQuestion.question}
                questionNumber={currentQuestion.globalIndex}
                value={currentValue}
                onChange={(segmentId, content) =>
                  handleAnswerChange(currentQuestion.question.id, segmentId, content)
                }
                disabled={isSubmitting || timeExpired}
                locale={locale}
                savingStatus={currentSavingStatus}
                shuffleSeed={hashString(`${attempt.id}:${currentQuestion.question.id}`)}
              />
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => {
                  const currentIdx = allQuestions.findIndex(q => q.question.id === currentQuestionId)
                  if (currentIdx > 0) {
                    setCurrentQuestionId(allQuestions[currentIdx - 1].question.id)
                  }
                }}
                disabled={allQuestions.findIndex(q => q.question.id === currentQuestionId) === 0}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locale === 'fr' ? 'Precedent' : 'Previous'}
              </button>
              <button
                onClick={() => {
                  const currentIdx = allQuestions.findIndex(q => q.question.id === currentQuestionId)
                  if (currentIdx < allQuestions.length - 1) {
                    setCurrentQuestionId(allQuestions[currentIdx + 1].question.id)
                  }
                }}
                disabled={allQuestions.findIndex(q => q.question.id === currentQuestionId) === allQuestions.length - 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {locale === 'fr' ? 'Suivant' : 'Next'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">
              {locale === 'fr' ? 'Selectionnez une question' : 'Select a question'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

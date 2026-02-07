'use client'

import { useCallback } from 'react'
import { FileText, ListChecks, Trash2 } from 'lucide-react'
import { useExamStore, useAllQuestions } from './store'
import { deleteQuestion } from '@/lib/actions/exam-editor'
import { useToast } from '@/components/ui/Toast'
import AddQuestionButton from './AddQuestionButton'

export default function ExamSidebar() {
  const { toast } = useToast()
  const exam = useExamStore((state) => state.exam)
  const activeQuestionId = useExamStore((state) => state.activeQuestionId)
  const setActiveQuestion = useExamStore((state) => state.setActiveQuestion)
  const removeQuestion = useExamStore((state) => state.removeQuestion)

  const questions = useAllQuestions()

  const handleSelectQuestion = useCallback((questionId: string) => {
    setActiveQuestion(questionId)
  }, [setActiveQuestion])

  const handleDeleteQuestion = useCallback(async (questionId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm('Are you sure you want to delete this question?')) {
      return
    }

    try {
      await deleteQuestion(questionId)
      removeQuestion(questionId)
    } catch (error) {
      console.error('Failed to delete question:', error)
      toast('Failed to delete question', 'error')
    }
  }, [removeQuestion])

  if (!exam) {
    return (
      <aside className="w-72 bg-white border-r border-gray-200 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </aside>
    )
  }

  // Calculate running total for each question
  const getQuestionPoints = (question: typeof questions[0]) => {
    if (question.type === 'MCQ') {
      if (question.requireAllCorrect && question.maxPoints != null) {
        return question.maxPoints
      }
      return question.segments.reduce((sum, s) => sum + (s.maxPoints ?? 0), 0)
    }
    return question.segments.reduce((sum, s) => sum + (s.maxPoints ?? 0), 0)
  }

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Questions</h2>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto p-2">
        {questions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No questions yet.
            <br />
            Click "Add Question" to start.
          </div>
        ) : (
          <ul className="space-y-1">
            {questions.map((question, index) => {
              const points = getQuestionPoints(question)
              const isActive = activeQuestionId === question.id
              const TypeIcon = question.type === 'MCQ' ? ListChecks : FileText

              return (
                <li key={question.id}>
                  <button
                    onClick={() => handleSelectQuestion(question.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors group ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {/* Question number and type icon */}
                    <span
                      className={`flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                        isActive ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>

                    {/* Type icon */}
                    <TypeIcon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? 'text-brand-600' : 'text-gray-400'
                      }`}
                    />

                    {/* Question info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {question.customLabel || `Question ${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {question.type} - {points} {points === 1 ? 'pt' : 'pts'}
                      </div>
                    </div>

                    {/* Delete button (visible on hover) */}
                    <button
                      onClick={(e) => handleDeleteQuestion(question.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Add question button */}
      <div className="p-3 border-t border-gray-200">
        <AddQuestionButton />
      </div>
    </aside>
  )
}

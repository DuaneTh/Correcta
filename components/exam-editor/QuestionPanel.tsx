'use client'

import { useExamStore, useQuestion } from './store'
import { FileText, ListChecks, Code } from 'lucide-react'
import QuestionEditorFactory from './question-types/QuestionEditorFactory'

export default function QuestionPanel() {
  const exam = useExamStore((state) => state.exam)
  const activeQuestionId = useExamStore((state) => state.activeQuestionId)
  const question = useQuestion(activeQuestionId)

  if (!exam) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-pulse h-8 w-48 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!activeQuestionId || !question) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium">No question selected</p>
        <p className="text-sm mt-1">
          Select a question from the sidebar or add a new one
        </p>
      </div>
    )
  }

  // Get the appropriate icon for the question type
  const getTypeIcon = () => {
    switch (question.type) {
      case 'MCQ':
        return ListChecks
      case 'CODE':
        return Code
      default:
        return FileText
    }
  }

  const TypeIcon = getTypeIcon()

  // Get the label for the question type
  const getTypeLabel = () => {
    switch (question.type) {
      case 'MCQ':
        return 'Multiple Choice'
      case 'CODE':
        return 'Code'
      default:
        return 'Open Question'
    }
  }

  // Calculate points for this question
  const points =
    question.type === 'MCQ' && question.requireAllCorrect && question.maxPoints != null
      ? question.maxPoints
      : question.segments.reduce((sum, s) => sum + (s.maxPoints ?? 0), 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Question header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TypeIcon className="w-5 h-5 text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {question.customLabel || `Question`}
                </h2>
                <p className="text-sm text-gray-500">
                  {getTypeLabel()} - {points} {points === 1 ? 'point' : 'points'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question editor - rendered by factory based on type */}
        <div className="p-6">
          <QuestionEditorFactory questionId={activeQuestionId} />
        </div>
      </div>
    </div>
  )
}

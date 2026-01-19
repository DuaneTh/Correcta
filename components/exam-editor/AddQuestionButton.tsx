'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Plus, FileText, ListChecks, ChevronDown } from 'lucide-react'
import { useExamStore } from './store'
import { addQuestion } from '@/lib/actions/exam-editor'

type QuestionType = 'TEXT' | 'MCQ'

interface QuestionTypeOption {
  type: QuestionType
  label: string
  description: string
  icon: typeof FileText
}

const questionTypes: QuestionTypeOption[] = [
  {
    type: 'TEXT',
    label: 'Open Question',
    description: 'Free-form text answer with rubric grading',
    icon: FileText,
  },
  {
    type: 'MCQ',
    label: 'Multiple Choice',
    description: 'Select one or more correct options',
    icon: ListChecks,
  },
]

export default function AddQuestionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const exam = useExamStore((state) => state.exam)
  const addQuestionToStore = useExamStore((state) => state.addQuestion)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleAddQuestion = useCallback(async (type: QuestionType) => {
    if (!exam || isAdding) return

    setIsAdding(true)
    setIsOpen(false)

    try {
      const result = await addQuestion(exam.id, type)

      if (result.question) {
        // Transform the question to match editor format
        addQuestionToStore(
          {
            id: result.question.id,
            content: result.question.content,
            answerTemplate: result.question.answerTemplate,
            answerTemplateLocked: result.question.answerTemplateLocked,
            studentTools: result.question.studentTools as import('@/types/exams').StudentToolsConfig | null,
            shuffleOptions: result.question.shuffleOptions,
            type: result.question.type as 'TEXT' | 'MCQ' | 'CODE',
            order: result.question.order,
            customLabel: result.question.customLabel,
            requireAllCorrect: result.question.requireAllCorrect,
            maxPoints: result.question.maxPoints,
            segments: result.question.segments.map(seg => ({
              id: seg.id,
              order: seg.order,
              instruction: seg.instruction,
              maxPoints: seg.maxPoints,
              isCorrect: seg.isCorrect,
              rubric: seg.rubric,
            })),
          },
          result.sectionId
        )
      }
    } catch (error) {
      console.error('Failed to add question:', error)
      // TODO: Show error toast
    } finally {
      setIsAdding(false)
    }
  }, [exam, isAdding, addQuestionToStore])

  if (!exam) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isAdding}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        <span>{isAdding ? 'Adding...' : 'Add Question'}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
          {questionTypes.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.type}
                onClick={() => handleAddQuestion(option.type)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Icon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-gray-900">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

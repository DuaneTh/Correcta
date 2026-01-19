'use client'

import { useQuestion } from '../store'
import OpenQuestionEditor from './OpenQuestionEditor'
import MultipleChoiceEditor from './MultipleChoiceEditor'

interface QuestionEditorFactoryProps {
  questionId: string
}

/**
 * Factory component that renders the appropriate editor
 * based on the question type (TEXT, MCQ, CODE)
 */
export default function QuestionEditorFactory({ questionId }: QuestionEditorFactoryProps) {
  const question = useQuestion(questionId)

  if (!question) {
    return (
      <div className="p-4 text-center text-gray-500">
        Question not found
      </div>
    )
  }

  switch (question.type) {
    case 'TEXT':
      return <OpenQuestionEditor questionId={questionId} />
    case 'MCQ':
      return <MultipleChoiceEditor questionId={questionId} />
    case 'CODE':
      return (
        <div className="p-6 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm font-medium">Code Editor</p>
          <p className="text-xs mt-1">Not implemented - coming in future version</p>
        </div>
      )
    default:
      return (
        <div className="p-4 text-center text-red-500">
          Unknown question type: {question.type}
        </div>
      )
  }
}

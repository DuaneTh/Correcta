'use client'

interface MultipleChoiceEditorProps {
  questionId: string
}

/**
 * Editor for multiple choice questions
 * Placeholder - will be implemented in Task 3
 */
export default function MultipleChoiceEditor({ questionId }: MultipleChoiceEditorProps) {
  return (
    <div className="p-4 text-gray-500">
      Multiple Choice Editor for {questionId} - Coming in Task 3
    </div>
  )
}

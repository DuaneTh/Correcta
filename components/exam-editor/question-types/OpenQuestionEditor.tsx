'use client'

interface OpenQuestionEditorProps {
  questionId: string
}

/**
 * Editor for open/text questions with correction guidelines
 * Placeholder - will be implemented in Task 2
 */
export default function OpenQuestionEditor({ questionId }: OpenQuestionEditorProps) {
  return (
    <div className="p-4 text-gray-500">
      Open Question Editor for {questionId} - Coming in Task 2
    </div>
  )
}

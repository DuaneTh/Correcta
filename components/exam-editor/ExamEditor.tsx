'use client'

import { useEffect } from 'react'
import { useExamStore, type EditorExam } from './store'
import ExamHeader from './ExamHeader'
import ExamSidebar from './ExamSidebar'
import QuestionPanel from './QuestionPanel'

interface ExamEditorProps {
  initialData: EditorExam
}

export default function ExamEditor({ initialData }: ExamEditorProps) {
  const initialize = useExamStore((state) => state.initialize)
  const reset = useExamStore((state) => state.reset)

  // Initialize store with exam data
  useEffect(() => {
    initialize(initialData)

    // Cleanup on unmount
    return () => {
      reset()
    }
  }, [initialData, initialize, reset])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top header with title and controls */}
      <ExamHeader />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar with question list */}
        <ExamSidebar />

        {/* Main editing area */}
        <main className="flex-1 overflow-y-auto p-6">
          <QuestionPanel />
        </main>
      </div>
    </div>
  )
}

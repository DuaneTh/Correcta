'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Settings } from 'lucide-react'
import { useExamStore, useTotalPoints, useQuestionCount } from './store'
import { updateExamMetadata } from '@/lib/actions/exam-editor'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'
import ExamSettingsPanel from './ExamSettingsPanel'

export default function ExamHeader() {
  const router = useRouter()
  const { toast } = useToast()
  const exam = useExamStore((state) => state.exam)
  const isDirty = useExamStore((state) => state.isDirty)
  const isSaving = useExamStore((state) => state.isSaving)
  const updateMetadata = useExamStore((state) => state.updateMetadata)
  const setIsSaving = useExamStore((state) => state.setIsSaving)
  const markClean = useExamStore((state) => state.markClean)

  const totalPoints = useTotalPoints()
  const questionCount = useQuestionCount()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleTitleClick = useCallback(() => {
    if (exam) {
      setTitleInput(exam.title)
      setIsEditingTitle(true)
    }
  }, [exam])

  const handleTitleBlur = useCallback(() => {
    if (exam && titleInput.trim() && titleInput !== exam.title) {
      updateMetadata({ title: titleInput.trim() })
    }
    setIsEditingTitle(false)
  }, [exam, titleInput, updateMetadata])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
    }
  }, [handleTitleBlur])

  const handleSave = useCallback(async () => {
    if (!exam || isSaving || !isDirty) return

    setIsSaving(true)
    try {
      await updateExamMetadata(exam.id, {
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
      })
      markClean()
    } catch (error) {
      console.error('Failed to save:', error)
      toast('Failed to save exam', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [exam, isSaving, isDirty, setIsSaving, markClean])

  if (!exam) {
    return (
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="animate-pulse h-6 w-48 bg-gray-200 rounded" />
      </header>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left section: Back button and title */}
        <div className="flex items-center gap-4">
          <Link
            href="/teacher/exams"
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to exams"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex flex-col">
            {isEditingTitle ? (
              <input
                type="text"
                aria-label="Exam title"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                className="text-xl font-semibold text-gray-900 bg-transparent border-b-2 border-brand-500 outline-none px-1 -ml-1"
                autoFocus
              />
            ) : (
              <button
                onClick={handleTitleClick}
                className="text-xl font-semibold text-gray-900 hover:text-brand-600 text-left transition-colors"
              >
                {exam.title}
              </button>
            )}
            <span className="text-sm text-gray-500">
              {exam.course.code} - {exam.course.name}
            </span>
          </div>
        </div>

        {/* Right section: Stats and actions */}
        <div className="flex items-center gap-4">
          {/* Stats badges */}
          <div className="flex items-center gap-3 text-sm">
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </span>
            <span className="px-3 py-1 bg-brand-100 text-brand-700 rounded-full font-medium">
              Total: {totalPoints} {totalPoints === 1 ? 'point' : 'points'}
            </span>
          </div>

          {/* Status indicator */}
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              exam.status === 'DRAFT'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {exam.status}
          </span>

          {/* Settings button */}
          <div className="relative">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Exam settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            {isSettingsOpen && (
              <ExamSettingsPanel onClose={() => setIsSettingsOpen(false)} />
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isDirty
                ? 'bg-brand-600 text-white hover:bg-brand-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

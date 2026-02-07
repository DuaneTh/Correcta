'use client'

import { useCallback } from 'react'
import { useExamStore, useQuestion } from '../store'
import { Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface MultipleChoiceEditorProps {
  questionId: string
}

/**
 * Editor for Multiple Choice Questions
 *
 * Features:
 * - Question body editing
 * - Dynamic options list (add/remove)
 * - Mark correct answers (checkbox)
 * - Points per option
 * - Validation warnings
 */
export default function MultipleChoiceEditor({ questionId }: MultipleChoiceEditorProps) {
  const question = useQuestion(questionId)
  const updateQuestion = useExamStore((state) => state.updateQuestion)
  const updateSegment = useExamStore((state) => state.updateSegment)
  const addMcqOption = useExamStore((state) => state.addMcqOption)
  const removeMcqOption = useExamStore((state) => state.removeMcqOption)
  const toggleMcqOptionCorrect = useExamStore((state) => state.toggleMcqOptionCorrect)

  // Handle content text change (first text segment)
  const handleContentChange = useCallback(
    (text: string) => {
      if (!question) return

      // Find existing text segment or create new content array
      const existingTextSegment = question.content.find((s) => s.type === 'text')

      if (existingTextSegment && existingTextSegment.type === 'text') {
        // Update existing text segment
        const newContent = question.content.map((s) =>
          s.id === existingTextSegment.id && s.type === 'text' ? { ...s, text } : s
        )
        updateQuestion(questionId, { content: newContent })
      } else {
        // Create new text segment
        const newContent = [
          { id: `text-${Date.now()}`, type: 'text' as const, text },
          ...question.content,
        ]
        updateQuestion(questionId, { content: newContent })
      }
    },
    [question, questionId, updateQuestion]
  )

  // Handle option text change
  const handleOptionTextChange = useCallback(
    (segmentId: string, text: string) => {
      updateSegment(questionId, segmentId, { instruction: text })
    },
    [questionId, updateSegment]
  )

  // Handle option points change
  const handleOptionPointsChange = useCallback(
    (segmentId: string, points: number | null) => {
      updateSegment(questionId, segmentId, { maxPoints: points })
    },
    [questionId, updateSegment]
  )

  // Handle toggle correct
  const handleToggleCorrect = useCallback(
    (segmentId: string) => {
      toggleMcqOptionCorrect(questionId, segmentId)
    },
    [questionId, toggleMcqOptionCorrect]
  )

  // Handle add option
  const handleAddOption = useCallback(() => {
    addMcqOption(questionId)
  }, [questionId, addMcqOption])

  // Handle remove option
  const handleRemoveOption = useCallback(
    (segmentId: string) => {
      removeMcqOption(questionId, segmentId)
    },
    [questionId, removeMcqOption]
  )

  // Toggle requireAllCorrect mode
  const handleToggleRequireAllCorrect = useCallback(() => {
    if (!question) return
    updateQuestion(questionId, { requireAllCorrect: !question.requireAllCorrect })
  }, [question, questionId, updateQuestion])

  // Handle maxPoints change for requireAllCorrect mode
  const handleMaxPointsChange = useCallback(
    (points: number | null) => {
      updateQuestion(questionId, { maxPoints: points })
    },
    [questionId, updateQuestion]
  )

  if (!question) {
    return (
      <div className="p-4 text-center text-gray-500">
        Question not found
      </div>
    )
  }

  // Get current content text (from first text segment)
  const contentText =
    question.content.find((s) => s.type === 'text')?.type === 'text'
      ? (question.content.find((s) => s.type === 'text') as { type: 'text'; text: string })?.text ?? ''
      : ''

  // Validation
  const isContentEmpty = !contentText.trim()
  const hasNoOptions = question.segments.length === 0
  const hasNoCorrectAnswer = !question.segments.some((s) => s.isCorrect)
  const hasEmptyOptionText = question.segments.some((s) => !s.instruction.trim())

  // Calculate total points
  const totalPoints = question.requireAllCorrect
    ? question.maxPoints ?? 0
    : question.segments.reduce((sum, s) => sum + (s.maxPoints ?? 0), 0)

  // Correct options count
  const correctCount = question.segments.filter((s) => s.isCorrect).length

  return (
    <div className="space-y-6">
      {/* Question Body */}
      <div>
        <label htmlFor="mcq-question-body" className="block text-sm font-medium text-gray-700 mb-2">
          Question Body
        </label>
        <textarea
          id="mcq-question-body"
          value={contentText}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Enter your question here..."
          className={`w-full min-h-[100px] px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${
            isContentEmpty ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
          }`}
          rows={3}
        />
      </div>

      {/* Scoring Mode */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={question.requireAllCorrect}
                onChange={handleToggleRequireAllCorrect}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                All-or-nothing scoring
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              {question.requireAllCorrect
                ? 'Student must select ALL correct answers to get points'
                : 'Points awarded per correct option selected'}
            </p>
          </div>
          {question.requireAllCorrect && (
            <div className="w-24">
              <label htmlFor="mcq-max-points" className="block text-xs font-medium text-gray-500 mb-1">
                Total Points
              </label>
              <input
                id="mcq-max-points"
                type="number"
                min={0}
                step={0.5}
                value={question.maxPoints ?? ''}
                onChange={(e) =>
                  handleMaxPointsChange(e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Options
            {correctCount > 0 && (
              <span className="ml-2 text-xs font-normal text-green-600">
                ({correctCount} correct)
              </span>
            )}
          </label>
          <span className="text-sm text-gray-500">
            Total: {totalPoints} {totalPoints === 1 ? 'point' : 'points'}
          </span>
        </div>

        {hasNoOptions ? (
          <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-sm text-gray-500 mb-3">No options yet</p>
            <button
              onClick={handleAddOption}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add First Option
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {question.segments.map((segment, index) => (
              <div
                key={segment.id}
                className={`p-4 rounded-lg border transition-colors ${
                  segment.isCorrect
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Correct checkbox */}
                  <button
                    onClick={() => handleToggleCorrect(segment.id)}
                    className={`mt-2 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      segment.isCorrect
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                    title={segment.isCorrect ? 'Mark as incorrect' : 'Mark as correct'}
                  >
                    {segment.isCorrect && <CheckCircle2 className="w-4 h-4" />}
                  </button>

                  {/* Option letter */}
                  <div className="mt-2 flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {String.fromCharCode(65 + index)}
                  </div>

                  {/* Option text */}
                  <div className="flex-1">
                    <input
                      type="text"
                      aria-label={`Option ${String.fromCharCode(65 + index)} text`}
                      value={segment.instruction}
                      onChange={(e) => handleOptionTextChange(segment.id, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + index)}...`}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        !segment.instruction.trim()
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>

                  {/* Points (only if not requireAllCorrect) */}
                  {!question.requireAllCorrect && (
                    <div className="w-20 flex-shrink-0">
                      <input
                        type="number"
                        aria-label={`Option ${String.fromCharCode(65 + index)} points`}
                        min={0}
                        step={0.5}
                        value={segment.maxPoints ?? ''}
                        onChange={(e) =>
                          handleOptionPointsChange(
                            segment.id,
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        placeholder="pts"
                        className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        title="Points for this option"
                      />
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveOption(segment.id)}
                    className="mt-1 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add option button */}
            <button
              onClick={handleAddOption}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>
          </div>
        )}
      </div>

      {/* Validation Warnings */}
      {(hasNoCorrectAnswer || hasEmptyOptionText) && question.segments.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Validation Issues</p>
              <ul className="mt-1 text-amber-700 list-disc list-inside space-y-1">
                {hasNoCorrectAnswer && (
                  <li>No correct answer selected - mark at least one option as correct</li>
                )}
                {hasEmptyOptionText && <li>Some options have empty text</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

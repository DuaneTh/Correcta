'use client'

import { useCallback } from 'react'
import { useExamStore, useQuestion } from '../store'
import { AlertCircle, Lightbulb } from 'lucide-react'

interface OpenQuestionEditorProps {
  questionId: string
}

/**
 * Editor for open/text questions with correction guidelines for AI grading
 *
 * Features:
 * - Question body editing (text content)
 * - Points management per segment
 * - Correction guidelines for AI grading (Phase 4)
 */
export default function OpenQuestionEditor({ questionId }: OpenQuestionEditorProps) {
  const question = useQuestion(questionId)
  const updateQuestion = useExamStore((state) => state.updateQuestion)
  const updateSegment = useExamStore((state) => state.updateSegment)

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

  // Handle correction guidelines change
  const handleGuidelinesChange = useCallback(
    (guidelines: string) => {
      updateQuestion(questionId, { correctionGuidelines: guidelines || null })
    },
    [questionId, updateQuestion]
  )

  // Handle segment instruction change
  const handleSegmentInstructionChange = useCallback(
    (segmentId: string, instruction: string) => {
      updateSegment(questionId, segmentId, { instruction })
    },
    [questionId, updateSegment]
  )

  // Handle segment points change
  const handleSegmentPointsChange = useCallback(
    (segmentId: string, points: number | null) => {
      updateSegment(questionId, segmentId, { maxPoints: points })
    },
    [questionId, updateSegment]
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

  // Check if content is empty (for validation warning)
  const isContentEmpty = !contentText.trim()

  // Calculate total points from segments
  const totalPoints = question.segments.reduce((sum, s) => sum + (s.maxPoints ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Question Body */}
      <div>
        <label htmlFor="question-body" className="block text-sm font-medium text-gray-700 mb-2">
          Question Body
        </label>
        <textarea
          id="question-body"
          value={contentText}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Enter your question here..."
          className={`w-full min-h-[120px] px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${
            isContentEmpty ? 'border-amber-300 bg-amber-50' : 'border-gray-300'
          }`}
          rows={4}
        />
        {isContentEmpty && (
          <p className="mt-1.5 text-sm text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            Question body is empty
          </p>
        )}
      </div>

      {/* Answer Segments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Answer Segments
          </label>
          <span className="text-sm text-gray-500">
            Total: {totalPoints} {totalPoints === 1 ? 'point' : 'points'}
          </span>
        </div>

        {question.segments.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-3 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            No answer segments defined. Segments will be added when you configure the answer structure.
          </p>
        ) : (
          <div className="space-y-3">
            {question.segments.map((segment, index) => (
              <div
                key={segment.id}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor={`segment-${segment.id}-instruction`}
                      className="block text-xs font-medium text-gray-500 mb-1"
                    >
                      Segment {index + 1} - Instruction
                    </label>
                    <input
                      id={`segment-${segment.id}-instruction`}
                      type="text"
                      value={segment.instruction}
                      onChange={(e) => handleSegmentInstructionChange(segment.id, e.target.value)}
                      placeholder="Instruction for this segment..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-24">
                    <label
                      htmlFor={`segment-${segment.id}-points`}
                      className="block text-xs font-medium text-gray-500 mb-1"
                    >
                      Points
                    </label>
                    <input
                      id={`segment-${segment.id}-points`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={segment.maxPoints ?? ''}
                      onChange={(e) =>
                        handleSegmentPointsChange(
                          segment.id,
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Correction Guidelines for AI Grading */}
      <div>
        <label htmlFor="correction-guidelines" className="block text-sm font-medium text-gray-700 mb-2">
          Correction Guidelines
          <span className="ml-2 text-xs font-normal text-gray-500">(for AI grading)</span>
        </label>
        <textarea
          id="correction-guidelines"
          value={question.correctionGuidelines ?? ''}
          onChange={(e) => handleGuidelinesChange(e.target.value)}
          placeholder="Describe what a correct answer should include, key points to look for, partial credit criteria..."
          className="w-full min-h-[100px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          rows={4}
        />
        {!question.correctionGuidelines && (
          <p className="mt-2 text-sm text-blue-600 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" />
            Adding guidelines improves AI grading accuracy
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          These guidelines will be used by the AI grader in Phase 4 to evaluate student answers.
        </p>
      </div>
    </div>
  )
}

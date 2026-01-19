'use client'

import { useExamStore, useQuestion } from './store'
import { FileText, ListChecks } from 'lucide-react'

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

  const TypeIcon = question.type === 'MCQ' ? ListChecks : FileText

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
                  {question.type === 'MCQ' ? 'Multiple Choice' : 'Open Question'} - {points}{' '}
                  {points === 1 ? 'point' : 'points'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Question content preview */}
        <div className="p-6">
          <div className="prose prose-sm max-w-none">
            {question.content && question.content.length > 0 ? (
              <div className="text-gray-700">
                {question.content.map((segment) => {
                  if (segment.type === 'text') {
                    return (
                      <span key={segment.id}>
                        {segment.text || (
                          <span className="text-gray-400 italic">No content yet</span>
                        )}
                      </span>
                    )
                  }
                  if (segment.type === 'math') {
                    return (
                      <span key={segment.id} className="font-mono bg-gray-100 px-1 rounded">
                        {segment.latex}
                      </span>
                    )
                  }
                  return null
                })}
              </div>
            ) : (
              <p className="text-gray-400 italic">No content yet. Click to edit.</p>
            )}
          </div>

          {/* Segments (for TEXT questions) */}
          {question.type === 'TEXT' && question.segments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Answer Segments</h3>
              <div className="space-y-3">
                {question.segments.map((segment, index) => (
                  <div
                    key={segment.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Segment {index + 1}
                      </span>
                      <span className="text-sm text-gray-500">
                        {segment.maxPoints ?? 0} {(segment.maxPoints ?? 0) === 1 ? 'pt' : 'pts'}
                      </span>
                    </div>
                    {segment.instruction && (
                      <p className="text-sm text-gray-600 mt-1">{segment.instruction}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MCQ Options placeholder */}
          {question.type === 'MCQ' && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Options</h3>
              {question.segments.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  No options added yet. Add options in the question editor.
                </p>
              ) : (
                <div className="space-y-2">
                  {question.segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      className={`p-3 rounded-lg border ${
                        segment.isCorrect
                          ? 'bg-green-50 border-green-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {String.fromCharCode(65 + index)}. {segment.instruction || 'Option'}
                        </span>
                        {segment.isCorrect && (
                          <span className="text-xs text-green-600 font-medium">Correct</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Placeholder for full editor */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-sm text-gray-500 text-center">
              Full question editor will be implemented in Plan 02-02.
              <br />
              This is a preview of the question structure.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

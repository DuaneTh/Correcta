'use client'

import { useCallback } from 'react'
import { useExamStore, useQuestion } from '../store'
import { AlertCircle, Lightbulb } from 'lucide-react'
import RichTextEditor from '../RichTextEditor'

interface OpenQuestionEditorProps {
  questionId: string
  /** Locale for labels */
  locale?: 'fr' | 'en'
}

/**
 * Editor for open/text questions with correction guidelines for AI grading
 *
 * Features:
 * - Rich text editing with MathToolbar and ImageUpload
 * - Live preview with math and image rendering
 * - Points management per segment
 * - Correction guidelines for AI grading (Phase 4)
 */
export default function OpenQuestionEditor({ questionId, locale = 'fr' }: OpenQuestionEditorProps) {
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

  const labels = {
    fr: {
      questionBody: 'Corps de la question',
      placeholder: 'Entrez votre question ici...',
      emptyWarning: 'Le corps de la question est vide',
      answerSegments: 'Segments de reponse',
      totalPoints: 'Total',
      point: 'point',
      points: 'points',
      noSegments: 'Aucun segment defini. Les segments seront ajoutes lors de la configuration de la structure de reponse.',
      segmentInstruction: 'Segment',
      instructionPlaceholder: 'Instruction pour ce segment...',
      pointsLabel: 'Points',
      correctionGuidelines: 'Consignes de correction',
      forAiGrading: '(pour la correction IA)',
      guidelinesPlaceholder: 'Decrivez ce qu\'une reponse correcte devrait contenir, les points cles a evaluer, les criteres de notation partielle...',
      guidelinesTip: 'L\'ajout de consignes ameliore la precision de la correction IA',
      guidelinesNote: 'Ces consignes seront utilisees par le correcteur IA pour evaluer les reponses des etudiants.',
    },
    en: {
      questionBody: 'Question Body',
      placeholder: 'Enter your question here...',
      emptyWarning: 'Question body is empty',
      answerSegments: 'Answer Segments',
      totalPoints: 'Total',
      point: 'point',
      points: 'points',
      noSegments: 'No answer segments defined. Segments will be added when you configure the answer structure.',
      segmentInstruction: 'Segment',
      instructionPlaceholder: 'Instruction for this segment...',
      pointsLabel: 'Points',
      correctionGuidelines: 'Correction Guidelines',
      forAiGrading: '(for AI grading)',
      guidelinesPlaceholder: 'Describe what a correct answer should include, key points to look for, partial credit criteria...',
      guidelinesTip: 'Adding guidelines improves AI grading accuracy',
      guidelinesNote: 'These guidelines will be used by the AI grader to evaluate student answers.',
    },
  }

  const t = labels[locale]

  return (
    <div className="space-y-6">
      {/* Question Body with Rich Text Editor */}
      <div>
        <RichTextEditor
          id="question-body"
          value={contentText}
          onChange={handleContentChange}
          label={t.questionBody}
          placeholder={t.placeholder}
          showMathToolbar={true}
          showImageUpload={true}
          locale={locale}
          rows={4}
          defaultShowPreview={false}
        />
        {isContentEmpty && (
          <p className="mt-1.5 text-sm text-amber-600 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" />
            {t.emptyWarning}
          </p>
        )}
      </div>

      {/* Answer Segments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            {t.answerSegments}
          </label>
          <span className="text-sm text-gray-500">
            {t.totalPoints}: {totalPoints} {totalPoints === 1 ? t.point : t.points}
          </span>
        </div>

        {question.segments.length === 0 ? (
          <p className="text-sm text-gray-500 italic py-3 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            {t.noSegments}
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
                      {t.segmentInstruction} {index + 1} - Instruction
                    </label>
                    <input
                      id={`segment-${segment.id}-instruction`}
                      type="text"
                      value={segment.instruction}
                      onChange={(e) => handleSegmentInstructionChange(segment.id, e.target.value)}
                      placeholder={t.instructionPlaceholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="w-24">
                    <label
                      htmlFor={`segment-${segment.id}-points`}
                      className="block text-xs font-medium text-gray-500 mb-1"
                    >
                      {t.pointsLabel}
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
          {t.correctionGuidelines}
          <span className="ml-2 text-xs font-normal text-gray-500">{t.forAiGrading}</span>
        </label>
        <textarea
          id="correction-guidelines"
          value={question.correctionGuidelines ?? ''}
          onChange={(e) => handleGuidelinesChange(e.target.value)}
          placeholder={t.guidelinesPlaceholder}
          className="w-full min-h-[100px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          rows={4}
        />
        {!question.correctionGuidelines && (
          <p className="mt-2 text-sm text-blue-600 flex items-center gap-1.5">
            <Lightbulb className="w-4 h-4" />
            {t.guidelinesTip}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          {t.guidelinesNote}
        </p>
      </div>
    </div>
  )
}

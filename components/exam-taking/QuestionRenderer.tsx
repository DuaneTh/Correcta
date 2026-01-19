'use client'

import { useMemo } from 'react'
import MathRenderer from '@/components/exams/MathRenderer'
import StringMathField from '@/components/exams/StringMathField'
import type { ContentSegment, StudentToolsConfig, StudentMathSymbolSet } from '@/types/exams'

// Types matching the exam structure
export type QuestionSegment = {
  id: string
  instruction: string
  maxPoints: number | null
  order: number
}

export type Question = {
  id: string
  content: ContentSegment[]
  answerTemplate?: ContentSegment[]
  answerTemplateLocked?: boolean
  studentTools?: StudentToolsConfig | null
  shuffleOptions?: boolean
  type: 'TEXT' | 'MCQ' | 'CODE'
  order: number
  customLabel?: string | null
  requireAllCorrect?: boolean
  maxPoints?: number | null
  segments: QuestionSegment[]
}

export type QuestionRendererProps = {
  question: Question
  questionNumber: number
  value: Record<string, string> // segmentId -> content
  onChange: (segmentId: string, content: string) => void
  disabled?: boolean
  locale?: string
  savingStatus?: Record<string, 'saved' | 'saving' | 'error' | null>
  shuffleSeed?: number // For consistent MCQ option shuffling
}

// Default student tools config
const defaultStudentTools: StudentToolsConfig = {
  math: { enabled: true, symbolSet: 'full' },
  table: { enabled: true, maxRows: null, maxCols: null, allowMath: true },
  graph: {
    enabled: true,
    allowPoints: true,
    allowLines: true,
    allowCurves: true,
    allowFunctions: true,
    allowAreas: true,
    allowText: true,
  },
}

const normalizeStudentTools = (tools?: StudentToolsConfig | null): StudentToolsConfig => ({
  math: {
    enabled: tools?.math?.enabled ?? defaultStudentTools.math?.enabled,
    symbolSet: tools?.math?.symbolSet ?? defaultStudentTools.math?.symbolSet,
  },
  table: {
    enabled: tools?.table?.enabled ?? defaultStudentTools.table?.enabled,
    maxRows: tools?.table?.maxRows ?? defaultStudentTools.table?.maxRows,
    maxCols: tools?.table?.maxCols ?? defaultStudentTools.table?.maxCols,
    allowMath: tools?.table?.allowMath ?? defaultStudentTools.table?.allowMath,
  },
  graph: {
    enabled: tools?.graph?.enabled ?? defaultStudentTools.graph?.enabled,
    allowPoints: tools?.graph?.allowPoints ?? defaultStudentTools.graph?.allowPoints,
    allowLines: tools?.graph?.allowLines ?? defaultStudentTools.graph?.allowLines,
    allowCurves: tools?.graph?.allowCurves ?? defaultStudentTools.graph?.allowCurves,
    allowFunctions: tools?.graph?.allowFunctions ?? defaultStudentTools.graph?.allowFunctions,
    allowAreas: tools?.graph?.allowAreas ?? defaultStudentTools.graph?.allowAreas,
    allowText: tools?.graph?.allowText ?? defaultStudentTools.graph?.allowText,
  },
})

const basicMathQuickSymbols = [
  { label: 'a/b', latex: '\\frac{#@}{#0}' },
  { label: '\u221A', latex: '\\sqrt{#0}' },
  { label: 'x^', latex: '^{#0}' },
  { label: 'x_', latex: '_{#0}' },
  { label: '\u03C0', latex: '\\pi' },
  { label: '\u221E', latex: '\\infty' },
  { label: '\u2264', latex: '\\leq' },
  { label: '\u2265', latex: '\\geq' },
  { label: '\u2260', latex: '\\neq' },
  { label: '\u00D7', latex: '\\times' },
  { label: '\u00B1', latex: '\\pm' },
]

const resolveMathQuickSymbols = (symbolSet?: StudentMathSymbolSet) =>
  symbolSet === 'basic' ? basicMathQuickSymbols : undefined

const sortByOrder = <T extends { order?: number }>(items: T[]) =>
  [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

// Seeded shuffle for consistent MCQ option ordering per student
const seededShuffle = <T,>(items: T[], seed: number) => {
  const result = [...items]
  let nextSeed = seed || 1
  const random = () => {
    nextSeed = (nextSeed * 9301 + 49297) % 233280
    return nextSeed / 233280
  }
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * QuestionRenderer - Renders a question for student exam taking
 *
 * Handles both TEXT (open-ended) and MCQ (multiple choice) questions.
 * For TEXT: Renders StringMathField with math toolbar support
 * For MCQ: Renders checkbox options with optional shuffling
 */
export default function QuestionRenderer({
  question,
  questionNumber,
  value,
  onChange,
  disabled = false,
  locale = 'fr',
  savingStatus = {},
  shuffleSeed,
}: QuestionRendererProps) {
  const dict = {
    saving: locale === 'fr' ? 'Sauvegarde...' : 'Saving...',
    saved: locale === 'fr' ? 'Enregistre' : 'Saved',
    errorSaving: locale === 'fr' ? 'Erreur de sauvegarde' : 'Save error',
    answerPlaceholder: locale === 'fr' ? 'Votre reponse...' : 'Your answer...',
    option: locale === 'fr' ? 'Option' : 'Option',
    point: locale === 'fr' ? 'point' : 'point',
    points: locale === 'fr' ? 'points' : 'points',
  }

  // Calculate total points
  const totalPoints = useMemo(() => {
    if (question.type === 'MCQ') {
      return question.maxPoints ??
        question.segments.reduce((sum, seg) => sum + (seg.maxPoints ?? 0), 0)
    }
    return question.segments.reduce((sum, seg) => sum + (seg.maxPoints ?? 0), 0)
  }, [question])

  // Question label
  const questionLabel = question.customLabel || `${questionNumber}.`

  // Check if question has visible content
  const hasContent = useMemo(() => {
    if (!question.content || question.content.length === 0) return false
    return question.content.some(seg =>
      seg.type === 'text' ? (seg.text?.trim() ?? '').length > 0 : true
    )
  }, [question.content])

  const questionText = hasContent
    ? question.content
    : [{ id: 'placeholder', type: 'text' as const, text: locale === 'fr' ? 'Question sans texte' : 'Question without text' }]

  // Render MCQ question
  if (question.type === 'MCQ') {
    const orderedOptions = sortByOrder(question.segments)
    const displayOptions = question.shuffleOptions && shuffleSeed
      ? seededShuffle(orderedOptions, shuffleSeed)
      : orderedOptions

    // Calculate MCQ saving status
    const optionStatuses = displayOptions.map(opt => savingStatus[opt.id]).filter(Boolean)
    const mcqStatus = optionStatuses.includes('error')
      ? 'error'
      : optionStatuses.includes('saving')
        ? 'saving'
        : optionStatuses.includes('saved')
          ? 'saved'
          : null

    return (
      <div className="space-y-3">
        {/* Question header */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-base font-semibold text-gray-900">
            {questionLabel}
          </span>
          {totalPoints > 0 && (
            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
              {totalPoints} {totalPoints === 1 ? dict.point : dict.points}
            </span>
          )}
        </div>

        {/* Question content */}
        <MathRenderer
          text={questionText}
          className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed"
          tableScale="fit"
        />

        {/* MCQ options */}
        <div className="mt-3 space-y-2">
          {displayOptions.map((option, optionIndex) => {
            const optionLetter = String.fromCharCode(65 + optionIndex) // A, B, C, D...
            const selectedValue = value[option.id]
            const isChecked = selectedValue === 'true' || selectedValue === '1'

            return (
              <label
                key={option.id}
                className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={(e) => onChange(option.id, e.target.checked ? 'true' : '')}
                  className="mt-1 w-4 h-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                />
                <span className="text-base text-gray-900 flex-1">
                  <span className="font-semibold mr-2">{optionLetter}.</span>
                  <MathRenderer
                    text={option.instruction || `${dict.option} ${optionIndex + 1}`}
                    className="inline text-base text-gray-900 whitespace-pre-wrap leading-relaxed"
                    tableScale="fit"
                  />
                </span>
              </label>
            )
          })}
        </div>

        {/* Saving status */}
        {mcqStatus && (
          <div className="mt-2 h-5 flex justify-end">
            {mcqStatus === 'saving' && (
              <span className="text-xs text-gray-500 italic">{dict.saving}</span>
            )}
            {mcqStatus === 'saved' && (
              <span className="text-xs text-green-600">{dict.saved}</span>
            )}
            {mcqStatus === 'error' && (
              <span className="text-xs text-red-600">{dict.errorSaving}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render TEXT question
  const tools = normalizeStudentTools(question.studentTools)
  const mathEnabled = tools.math?.enabled !== false
  const tableEnabled = tools.table?.enabled !== false
  const graphEnabled = tools.graph?.enabled !== false
  const mathQuickSymbols = resolveMathQuickSymbols(tools.math?.symbolSet)
  const tableConfig = {
    maxRows: tools.table?.maxRows ?? null,
    maxCols: tools.table?.maxCols ?? null,
    allowMath: mathEnabled && tools.table?.allowMath !== false,
  }
  const graphConfig = {
    allowPoints: tools.graph?.allowPoints,
    allowLines: tools.graph?.allowLines,
    allowCurves: tools.graph?.allowCurves,
    allowFunctions: tools.graph?.allowFunctions,
    allowAreas: tools.graph?.allowAreas,
    allowText: tools.graph?.allowText,
  }

  const sortedSegments = sortByOrder(question.segments)

  return (
    <div className="space-y-3">
      {/* Question header */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-gray-900">
          {questionLabel}
        </span>
        {totalPoints > 0 && (
          <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
            {totalPoints} {totalPoints === 1 ? dict.point : dict.points}
          </span>
        )}
      </div>

      {/* Question content */}
      <MathRenderer
        text={questionText}
        className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed"
        tableScale="fit"
      />

      {/* Answer segments */}
      {sortedSegments.map((segment) => (
        <div key={segment.id} className="mt-4">
          {/* Segment instruction */}
          {segment.instruction && (
            <div className="mb-2">
              <MathRenderer
                text={segment.instruction}
                className="block text-sm font-medium text-gray-700"
              />
            </div>
          )}

          {/* Answer input */}
          <div className="rounded-md border border-gray-300 bg-gray-50">
            <div className="px-3 py-2">
              <StringMathField
                value={value[segment.id] || ''}
                onChange={(val) => onChange(segment.id, val)}
                disabled={disabled}
                className="text-base text-gray-900"
                placeholder={dict.answerPlaceholder}
                minRows={6}
                showMathButton={mathEnabled}
                showTableButton={tableEnabled}
                showGraphButton={graphEnabled}
                toolbarSize="md"
                mathQuickSymbols={mathQuickSymbols}
                tableConfig={tableConfig}
                graphConfig={graphConfig}
                locale={locale}
              />
            </div>
          </div>

          {/* Saving status */}
          <div className="mt-1 h-5 flex justify-end">
            {savingStatus[segment.id] === 'saving' && (
              <span className="text-xs text-gray-500 italic">{dict.saving}</span>
            )}
            {savingStatus[segment.id] === 'saved' && (
              <span className="text-xs text-green-600">{dict.saved}</span>
            )}
            {savingStatus[segment.id] === 'error' && (
              <span className="text-xs text-red-600">{dict.errorSaving}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

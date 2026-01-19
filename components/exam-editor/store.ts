import { create } from 'zustand'
import type { ContentSegments, QuestionType, StudentToolsConfig, RubricLevel } from '@/types/exams'

/**
 * Exam metadata that can be edited in the editor
 */
export interface ExamMetadata {
  title: string
  description: string | null
  durationMinutes: number | null
}

/**
 * Full exam data structure for the editor
 */
export interface EditorExam {
  id: string
  title: string
  description: string | null
  courseId: string
  course: {
    code: string
    name: string
  }
  status: 'DRAFT' | 'PUBLISHED'
  durationMinutes: number | null
  startAt: string | null
  endAt: string | null
  author: {
    id: string
    name: string | null
    email: string
  } | null
  sections: EditorSection[]
  updatedAt: string
}

/**
 * Section in the editor
 */
export interface EditorSection {
  id: string
  title: string
  order: number
  isDefault: boolean
  customLabel: string | null
  introContent: ContentSegments | string | null
  questions: EditorQuestion[]
}

/**
 * Question in the editor
 */
export interface EditorQuestion {
  id: string
  content: ContentSegments
  answerTemplate: ContentSegments | null
  answerTemplateLocked: boolean
  studentTools: StudentToolsConfig | null
  shuffleOptions: boolean
  type: QuestionType
  order: number
  customLabel: string | null
  requireAllCorrect: boolean
  maxPoints: number | null
  segments: EditorSegment[]
  /** AI grading guidelines for TEXT questions (Phase 4) */
  correctionGuidelines: string | null
}

/**
 * Rubric for grading in the editor
 */
export interface EditorRubric {
  id: string
  criteria: string | null
  levels: RubricLevel[] | unknown
  examples: string[] | unknown
}

/**
 * Segment in the editor
 */
export interface EditorSegment {
  id: string
  order: number
  instruction: string
  maxPoints: number | null
  isCorrect: boolean | null
  rubric: EditorRubric | null
}

/**
 * Exam editor store state
 */
interface ExamEditorState {
  // Core state
  exam: EditorExam | null
  isDirty: boolean
  isSaving: boolean

  // Navigation state
  activeSectionId: string | null
  activeQuestionId: string | null

  // Actions
  initialize: (exam: EditorExam) => void
  reset: () => void

  // Metadata actions
  updateMetadata: (data: Partial<ExamMetadata>) => void
  setIsSaving: (saving: boolean) => void
  markClean: () => void

  // Navigation actions
  setActiveSection: (sectionId: string | null) => void
  setActiveQuestion: (questionId: string | null) => void

  // Question actions
  addQuestion: (question: EditorQuestion, sectionId: string) => void
  removeQuestion: (questionId: string) => void
  updateQuestion: (questionId: string, data: Partial<EditorQuestion>) => void

  // Segment actions
  updateSegment: (questionId: string, segmentId: string, data: Partial<EditorSegment>) => void

  // MCQ-specific actions
  addMcqOption: (questionId: string) => void
  removeMcqOption: (questionId: string, segmentId: string) => void
  toggleMcqOptionCorrect: (questionId: string, segmentId: string) => void
}

/**
 * Calculate the total points for all questions in the exam
 */
export function calculateTotalPoints(exam: EditorExam | null): number {
  if (!exam) return 0

  let total = 0

  for (const section of exam.sections) {
    for (const question of section.questions) {
      if (question.type === 'MCQ') {
        // MCQ with requireAllCorrect uses maxPoints on the question
        if (question.requireAllCorrect && question.maxPoints != null) {
          total += question.maxPoints
        } else {
          // MCQ without requireAllCorrect uses sum of segment points (options)
          for (const segment of question.segments) {
            total += segment.maxPoints ?? 0
          }
        }
      } else {
        // TEXT/CODE questions use sum of segment points
        for (const segment of question.segments) {
          total += segment.maxPoints ?? 0
        }
      }
    }
  }

  return total
}

/**
 * Zustand store for managing exam editor state
 */
export const useExamStore = create<ExamEditorState>((set, get) => ({
  // Initial state
  exam: null,
  isDirty: false,
  isSaving: false,
  activeSectionId: null,
  activeQuestionId: null,

  /**
   * Initialize the store with exam data from the server
   */
  initialize: (exam) => {
    set({
      exam,
      isDirty: false,
      isSaving: false,
      activeSectionId: null,
      activeQuestionId: null,
    })
  },

  /**
   * Reset the store to initial state
   */
  reset: () => {
    set({
      exam: null,
      isDirty: false,
      isSaving: false,
      activeSectionId: null,
      activeQuestionId: null,
    })
  },

  /**
   * Update exam metadata (title, description, duration)
   */
  updateMetadata: (data) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.durationMinutes !== undefined && { durationMinutes: data.durationMinutes }),
      },
      isDirty: true,
    })
  },

  /**
   * Set the saving state
   */
  setIsSaving: (saving) => {
    set({ isSaving: saving })
  },

  /**
   * Mark the store as clean (after successful save)
   */
  markClean: () => {
    set({ isDirty: false })
  },

  /**
   * Set the active section
   */
  setActiveSection: (sectionId) => {
    set({ activeSectionId: sectionId })
  },

  /**
   * Set the active question
   */
  setActiveQuestion: (questionId) => {
    set({ activeQuestionId: questionId })
  },

  /**
   * Add a question to a section
   */
  addQuestion: (question, sectionId) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) =>
          section.id === sectionId
            ? { ...section, questions: [...section.questions, question] }
            : section
        ),
      },
      isDirty: true,
      activeQuestionId: question.id,
    })
  },

  /**
   * Remove a question from the exam
   */
  removeQuestion: (questionId) => {
    const { exam, activeQuestionId } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.filter((q) => q.id !== questionId),
        })),
      },
      isDirty: true,
      // Clear active question if it was deleted
      activeQuestionId: activeQuestionId === questionId ? null : activeQuestionId,
    })
  },

  /**
   * Update a question's data
   */
  updateQuestion: (questionId, data) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.map((q) =>
            q.id === questionId ? { ...q, ...data } : q
          ),
        })),
      },
      isDirty: true,
    })
  },

  /**
   * Update a segment's data within a question
   */
  updateSegment: (questionId, segmentId, data) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  segments: q.segments.map((s) =>
                    s.id === segmentId ? { ...s, ...data } : s
                  ),
                }
              : q
          ),
        })),
      },
      isDirty: true,
    })
  },

  /**
   * Add a new option to an MCQ question
   */
  addMcqOption: (questionId) => {
    const { exam } = get()
    if (!exam) return

    const newOption: EditorSegment = {
      id: `option-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      order: 0, // Will be recalculated
      instruction: '',
      maxPoints: 0, // Options default to 0 points until marked correct
      isCorrect: false,
      rubric: null,
    }

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.map((q) => {
            if (q.id !== questionId) return q
            const newSegments = [...q.segments, { ...newOption, order: q.segments.length }]
            return { ...q, segments: newSegments }
          }),
        })),
      },
      isDirty: true,
    })
  },

  /**
   * Remove an option from an MCQ question
   */
  removeMcqOption: (questionId, segmentId) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.map((q) => {
            if (q.id !== questionId) return q
            const newSegments = q.segments
              .filter((s) => s.id !== segmentId)
              .map((s, idx) => ({ ...s, order: idx })) // Reorder
            return { ...q, segments: newSegments }
          }),
        })),
      },
      isDirty: true,
    })
  },

  /**
   * Toggle whether an MCQ option is correct
   */
  toggleMcqOptionCorrect: (questionId, segmentId) => {
    const { exam } = get()
    if (!exam) return

    set({
      exam: {
        ...exam,
        sections: exam.sections.map((section) => ({
          ...section,
          questions: section.questions.map((q) => {
            if (q.id !== questionId) return q
            return {
              ...q,
              segments: q.segments.map((s) =>
                s.id === segmentId ? { ...s, isCorrect: !s.isCorrect } : s
              ),
            }
          }),
        })),
      },
      isDirty: true,
    })
  },
}))

/**
 * Selector for total points (memoized)
 */
export const useTotalPoints = () => {
  return useExamStore((state) => calculateTotalPoints(state.exam))
}

/**
 * Selector for question count
 */
export const useQuestionCount = () => {
  return useExamStore((state) => {
    if (!state.exam) return 0
    return state.exam.sections.reduce((sum, section) => sum + section.questions.length, 0)
  })
}

/**
 * Selector for getting a specific question by ID
 */
export const useQuestion = (questionId: string | null) => {
  return useExamStore((state) => {
    if (!state.exam || !questionId) return null
    for (const section of state.exam.sections) {
      const question = section.questions.find((q) => q.id === questionId)
      if (question) return question
    }
    return null
  })
}

/**
 * Selector for getting all questions flat
 */
export const useAllQuestions = () => {
  return useExamStore((state) => {
    if (!state.exam) return []
    return state.exam.sections.flatMap((section) =>
      section.questions.map((q, index) => ({
        ...q,
        sectionId: section.id,
        sectionTitle: section.title,
        globalIndex: index,
      }))
    )
  })
}

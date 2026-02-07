import { useCallback, useEffect, useState } from 'react'
import { Exam, Question, QuestionType, Segment, ValidationErrors, ContentSegment, Rubric } from '@/types/exams'
import { parseContent, serializeContent, segmentsToPlainText } from '@/lib/content'
import { getCsrfToken } from '@/lib/csrfClient'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'

const withCsrfHeaders = async (headers: HeadersInit = {}) => ({
    ...headers,
    'x-csrf-token': await getCsrfToken()
})

type ValidationDictionary = {
    validationTitle: string
    validationDate: string
    validationDatePast: string
    validationDuration: string
    validationContent: string
    validationMcqCorrectOptions: string
    validationCorrectionReleaseAtInvalid?: string
    validationCorrectionReleaseAtPast?: string
    validationCorrectionReleaseAtBeforeStart?: string
    validationCorrectionReleaseAtBeforeEnd?: string
}

interface UseExamBuilderDataArgs {
    examId: string
    initialData: Exam
    dict: ValidationDictionary
    locale: string
}

const normalizeExam = (incoming: Exam): Exam => ({
    ...incoming,
    gradingConfig: incoming.gradingConfig ?? null,
    sections: incoming.sections.map((section) => ({
        ...section,
        introContent: parseContent((section as unknown as { introContent?: unknown }).introContent),
        questions: section.questions.map((question) => ({
            ...question,
            content: parseContent((question as unknown as { content: unknown }).content),
            answerTemplate: parseContent((question as unknown as { answerTemplate?: unknown }).answerTemplate),
            answerTemplateLocked: Boolean((question as unknown as { answerTemplateLocked?: unknown }).answerTemplateLocked),
            studentTools: (question as unknown as { studentTools?: unknown }).studentTools ?? null,
            shuffleOptions: Boolean((question as unknown as { shuffleOptions?: unknown }).shuffleOptions),
            segments: question.segments.map((segment) => ({
                ...segment,
                maxPoints: segment.maxPoints === -999 ? null : segment.maxPoints,
                isCorrect: Boolean((segment as Segment).isCorrect),
            })),
        })),
    })),
})

export function useExamBuilderData({ examId, initialData, dict, locale }: UseExamBuilderDataArgs) {
    const [exam, setExam] = useState<Exam>(normalizeExam(initialData))
    const [liveExam, setLiveExam] = useState<Exam>(normalizeExam(initialData))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    const [validationDetails, setValidationDetails] = useState<ValidationErrors | null>(null)
    const [showValidationUI, setShowValidationUI] = useState(false)

    const getPlainStringValue = useCallback((value?: string | null) => {
        if (!value) return ''
        try {
            const parsed = JSON.parse(value)
            if (Array.isArray(parsed)) {
                return segmentsToPlainText(parseContent(parsed)).trim()
            }
        } catch {
            // Not JSON, use raw string
        }
        return value.trim()
    }, [])

    const getMcqPositivePointsSum = useCallback((segments: Segment[]) => {
        return segments.reduce((sum, segment) => {
            const value = segment.maxPoints
            if (typeof value === 'number' && value > 0) return sum + value
            return sum
        }, 0)
    }, [])

    const reloadExam = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}`, { cache: 'no-store' })
            if (!res.ok) {
                const text = await res.text()
                setError(text || 'Failed to load exam')
                return null
            }
            const data = (await res.json()) as Exam
            const parsed = normalizeExam({
                ...data,
                courseSections: exam.courseSections,
                canEdit: exam.canEdit,
                baseExamId: exam.baseExamId,
                baseExamTitle: exam.baseExamTitle,
            })
            setExam(parsed)
            setLiveExam(parsed)
            setError(null)
            return parsed
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
            return null
        } finally {
            setLoading(false)
        }
    }, [examId, exam.baseExamId, exam.baseExamTitle, exam.canEdit, exam.courseSections])

    const getValidationErrors = useCallback((target?: Exam): ValidationErrors => {
        const errors: ValidationErrors = { questions: [] }
        const examToValidate = target || liveExam || exam

        if (!examToValidate.title || examToValidate.title.trim() === '') errors.title = true
        if (!examToValidate.startAt) {
            errors.date = true
        } else if (new Date(examToValidate.startAt) < new Date()) {
            errors.datePast = true
        }
        if (!examToValidate.durationMinutes || examToValidate.durationMinutes <= 0) errors.duration = true
        const correctionReleaseAt = examToValidate.gradingConfig?.correctionReleaseAt
        if (correctionReleaseAt) {
            const releaseDate = new Date(correctionReleaseAt)
            const now = new Date()
            if (Number.isNaN(releaseDate.getTime())) {
                errors.correctionReleaseAtInvalid = true
            } else {
                if (releaseDate < now) {
                    errors.correctionReleaseAtPast = true
                }
                if (examToValidate.startAt) {
                    const startDate = new Date(examToValidate.startAt)
                    if (examToValidate.durationMinutes && examToValidate.durationMinutes > 0) {
                        const endDate = new Date(startDate)
                        endDate.setMinutes(endDate.getMinutes() + examToValidate.durationMinutes)
                        if (releaseDate < endDate) {
                            errors.correctionReleaseAtBeforeEnd = true
                        }
                    } else if (releaseDate < startDate) {
                        errors.correctionReleaseAtBeforeStart = true
                    }
                }
            }
        }

        const hasQuestions = examToValidate.sections.some((section) => section.questions.length > 0)
        if (!hasQuestions) errors.hasQuestions = true

        for (const section of examToValidate.sections) {
            for (const question of section.questions) {
                const questionErrors: ValidationErrors['questions'][0] = {
                    questionId: question.id,
                    sectionId: section.id,
                }
                const contentText = segmentsToPlainText(question.content || [])
                if (contentText.trim() === '') questionErrors.missingContent = true
                if (!question.customLabel || question.customLabel.trim() === '') questionErrors.missingLabel = true

                if (question.type === 'MCQ') {
                    if (!question.segments || question.segments.length === 0) {
                        questionErrors.missingMcqOptions = true
                    } else {
                        const missingOptions: Array<{ segmentId: string }> = []
                        const missingPoints: Array<{ segmentId: string }> = []
                        const requireAllCorrect = question.requireAllCorrect === true
                        if (requireAllCorrect && !question.segments.some((segment) => segment.isCorrect)) {
                            questionErrors.mcqMissingCorrectOptions = true
                        }

                        for (const segment of question.segments) {
                            if (getPlainStringValue(segment.instruction) === '') {
                                missingOptions.push({ segmentId: segment.id })
                            }
                            if (!requireAllCorrect) {
                                const pointsValue = (segment as Segment).maxPoints
                                if (pointsValue === null || pointsValue === undefined || Number.isNaN(pointsValue)) {
                                    missingPoints.push({ segmentId: segment.id })
                                }
                            }
                        }
                        if (missingOptions.length > 0) questionErrors.missingMcqOptionText = missingOptions
                        if (missingPoints.length > 0) questionErrors.missingMcqOptionPoints = missingPoints
                        const totalPoints = question.maxPoints
                        if (totalPoints === null || totalPoints === undefined || Number.isNaN(totalPoints)) {
                            questionErrors.missingPoints = true
                        } else if (!requireAllCorrect) {
                            const positiveSum = getMcqPositivePointsSum(question.segments)
                            if (Math.abs(totalPoints - positiveSum) > 1e-6) {
                                questionErrors.mcqTotalPointsMismatch = true
                            }
                        }
                    }
                } else {
                    if (!question.segments || question.segments.length === 0) {
                        questionErrors.missingPoints = true
                    } else {
                        for (const segment of question.segments) {
                            if (segment.maxPoints === null || segment.maxPoints === undefined || segment.maxPoints <= 0) {
                                questionErrors.missingPoints = true
                                break
                            }
                        }
                    }
                }

                if (
                    questionErrors.missingContent ||
                    questionErrors.missingLabel ||
                    questionErrors.missingPoints ||
                    questionErrors.missingMcqOptions ||
                    questionErrors.missingMcqOptionText ||
                    questionErrors.missingMcqOptionPoints
                    || questionErrors.mcqTotalPointsMismatch
                    || questionErrors.mcqMissingCorrectOptions
                ) {
                    errors.questions.push(questionErrors)
                }
            }
        }
        return errors
    }, [exam, getMcqPositivePointsSum, getPlainStringValue, liveExam])

    const computeValidationDetails = useCallback(
        (target?: Exam): ValidationErrors | null => {
            const errs = getValidationErrors(target)
        if (
            errs.title ||
            errs.date ||
            errs.datePast ||
            errs.duration ||
            errs.correctionReleaseAtInvalid ||
            errs.correctionReleaseAtPast ||
            errs.correctionReleaseAtBeforeStart ||
            errs.correctionReleaseAtBeforeEnd ||
            errs.hasQuestions ||
            errs.questions.length > 0
        ) {
            return errs
        }
            return null
        },
        [getValidationErrors]
    )

    useEffect(() => {
        setLiveExam(exam)
    }, [exam])

    // Compute validation data lazily; only attach when UI needs to show it
    useEffect(() => {
        if (showValidationUI) {
            setValidationDetails(computeValidationDetails(exam))
        }
    }, [computeValidationDetails, exam, showValidationUI])

    const mergeWithDuration = useCallback(
        (incoming: Exam, previous: Exam): Exam => ({
            ...incoming,
            durationMinutes: incoming.durationMinutes ?? previous.durationMinutes ?? null,
        }),
        []
    )

    const updateLiveExam = useCallback((updater: (prev: Exam) => Exam) => {
        setLiveExam((prev) => updater(prev))
    }, [])

    const updateLiveQuestionContent = useCallback(
        (sectionId: string, questionId: string, content: ContentSegment[]) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, content } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionAnswerTemplate = useCallback(
        (sectionId: string, questionId: string, answerTemplate: ContentSegment[]) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, answerTemplate } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionAnswerTemplateLocked = useCallback(
        (sectionId: string, questionId: string, answerTemplateLocked: boolean) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, answerTemplateLocked } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionStudentTools = useCallback(
        (sectionId: string, questionId: string, studentTools: Question['studentTools']) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, studentTools } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionMaxPoints = useCallback(
        (sectionId: string, questionId: string, maxPoints: number | null) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, maxPoints: maxPoints ?? null } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionRequireAllCorrect = useCallback(
        (sectionId: string, questionId: string, requireAllCorrect: boolean) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, requireAllCorrect } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionShuffleOptions = useCallback(
        (sectionId: string, questionId: string, shuffleOptions: boolean) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, shuffleOptions } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveQuestionLabel = useCallback(
        (sectionId: string, questionId: string, customLabel: string | null) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId ? { ...q, customLabel } : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSegmentInstruction = useCallback(
        (sectionId: string, questionId: string, segmentId: string, instruction: string) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId ? { ...s, instruction } : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSegmentOrder = useCallback(
        (sectionId: string, questionId: string, segmentId: string, order: number) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId ? { ...s, order } : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSectionLabel = useCallback(
        (sectionId: string, customLabel: string | null) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId ? { ...section, customLabel } : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSectionTitle = useCallback(
        (sectionId: string, title: string) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId ? { ...section, title } : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSectionIntro = useCallback(
        (sectionId: string, introContent: ContentSegment[]) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId ? { ...section, introContent } : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSegmentCriteria = useCallback(
        (sectionId: string, questionId: string, segmentId: string, criteria: string) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId
                                                    ? {
                                                          ...s,
                                                          rubric: s.rubric
                                                              ? { ...s.rubric, criteria }
                                                              : {
                                                                    id: s.id,
                                                                    criteria,
                                                                    levels: [],
                                                                    examples: [],
                                                                } satisfies Rubric,
                                                      }
                                                    : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSegmentPerfectAnswer = useCallback(
        (sectionId: string, questionId: string, segmentId: string, examples: string[]) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId
                                                    ? {
                                                          ...s,
                                                          rubric: s.rubric
                                                              ? { ...s.rubric, examples }
                                                              : {
                                                                    id: s.id,
                                                                    criteria: '',
                                                                    levels: [],
                                                                    examples,
                                                                } satisfies Rubric,
                                                      }
                                                    : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveTitle = useCallback((title: string) => {
        updateLiveExam((prev) => ({ ...prev, title }))
    }, [updateLiveExam])

    const updateLiveDate = useCallback((startAt: string | null) => {
        updateLiveExam((prev) => ({ ...prev, startAt }))
    }, [updateLiveExam])

    const updateLiveDuration = useCallback((durationMinutes: number | null) => {
        updateLiveExam((prev) => ({ ...prev, durationMinutes }))
    }, [updateLiveExam])

    const updateLiveHonorCommitment = useCallback((requireHonorCommitment: boolean) => {
        updateLiveExam((prev) => ({ ...prev, requireHonorCommitment }))
    }, [updateLiveExam])

    const updateLiveAllowedMaterials = useCallback((allowedMaterials: string | null) => {
        updateLiveExam((prev) => ({ ...prev, allowedMaterials }))
    }, [updateLiveExam])

    const updateLiveGradingConfig = useCallback((gradingConfig: Exam['gradingConfig']) => {
        updateLiveExam((prev) => ({ ...prev, gradingConfig }))
    }, [updateLiveExam])

    const updateLiveSegmentPoints = useCallback(
        (sectionId: string, questionId: string, segmentId: string, maxPoints: number | null | undefined) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId ? { ...s, maxPoints: maxPoints ?? null } : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const updateLiveSegmentCorrect = useCallback(
        (sectionId: string, questionId: string, segmentId: string, isCorrect: boolean) =>
            updateLiveExam((prev) => ({
                ...prev,
                sections: prev.sections.map((section) =>
                    section.id === sectionId
                        ? {
                              ...section,
                              questions: section.questions.map((q) =>
                                  q.id === questionId
                                      ? {
                                            ...q,
                                            segments: q.segments.map((s) =>
                                                s.id === segmentId ? { ...s, isCorrect } : s
                                            ),
                                        }
                                      : q
                              ),
                          }
                        : section
                ),
            })),
        [updateLiveExam]
    )

    const addSection = useCallback(
        async (
            atTop = false,
            afterQuestionId?: string,
            afterSectionId?: string,
            isDefault = false
        ): Promise<string | null> => {
            try {
                setLoading(true)
                const currentSections = exam.sections
                const minOrder = currentSections.length ? Math.min(...currentSections.map((s) => s.order)) : 0
                const maxOrder = currentSections.length ? Math.max(...currentSections.map((s) => s.order)) : -1
                const newOrder = atTop ? minOrder - 1 : maxOrder + 1

                const res = await fetch(`/api/exams/${examId}/sections`, {
                    method: 'POST',
                    headers: await withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        title: '',
                        order: newOrder,
                        customLabel: null,
                        afterQuestionId,
                        afterSectionId,
                        isDefault,
                    }),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to create section')
                }
                const created = (await res.json()) as { section?: { id: string } } | { id: string }
                await reloadExam()
                // The API may return either the section directly or wrapped
                if ('section' in created && created.section?.id) return created.section.id
                if ('id' in created && created.id) return created.id
                return null
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create section')
                return null
            } finally {
                setLoading(false)
            }
        },
        [exam.sections, examId, reloadExam]
    )

    const addQuestion = useCallback(
        async (
            sectionId?: string,
            type: QuestionType = 'TEXT',
            atTop = false,
            afterQuestionId?: string,
            outsideSection = false
        ) => {
            try {
                setLoading(true)

                await fetchJsonWithCsrf(`/api/exams/${examId}/questions`, {
                    method: 'POST',
                    body: {
                        content: serializeContent(parseContent('')),
                        answerTemplate: serializeContent(parseContent('')),
                        type,
                        atTop,
                        afterQuestionId,
                        outsideSection,
                        ...(sectionId ? { sectionId } : {}),
                    },
                })
                await reloadExam()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            } finally {
                setLoading(false)
            }
        },
        [examId, reloadExam]
    )

    const updateSection = useCallback(
        async (sectionId: string, data: { title?: string; customLabel?: string | null; order?: number; introContent?: ContentSegment[] | string | null }) => {
            try {
                const payload: Record<string, unknown> = { ...data }
                if (data.introContent !== undefined) {
                    payload.introContent = Array.isArray(data.introContent)
                        ? serializeContent(data.introContent)
                        : data.introContent
                }
                const res = await fetch(`/api/exams/${examId}/sections/${sectionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Failed to update section')
                await reloadExam()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            }
        },
        [examId, reloadExam]
    )

    const updateQuestion = useCallback(
        async (
            sectionId: string,
            questionId: string,
            data: Partial<Question> & { targetSectionId?: string; targetOrder?: number }
        ) => {
            try {
                const payload: Record<string, unknown> = { ...data }
                if (data.content !== undefined) {
                    payload.content = serializeContent(data.content as ContentSegment[])
                }
                if (data.answerTemplate !== undefined) {
                    payload.answerTemplate = serializeContent(data.answerTemplate as ContentSegment[])
                }
                if (data.answerTemplateLocked !== undefined) {
                    payload.answerTemplateLocked = data.answerTemplateLocked
                }
                if (data.studentTools !== undefined) {
                    payload.studentTools = data.studentTools
                }
                const res = await fetch(`/api/exams/${examId}/sections/${sectionId}/questions/${questionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update question')
                }
                await reloadExam()
                setValidationDetails((details) => {
                    if (!details) return null
                    return getValidationErrors()
                })
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            }
        },
        [examId, getValidationErrors, reloadExam]
    )

    const deleteQuestion = useCallback(
        async (sectionId: string, questionId: string) => {
            try {
                setLoading(true)
                const res = await fetch(`/api/exams/${examId}/sections/${sectionId}/questions/${questionId}`, {
                    method: 'DELETE',
                })
                if (!res.ok) throw new Error('Failed to delete question')
                await reloadExam()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            } finally {
                setLoading(false)
            }
        },
        [examId, reloadExam]
    )

    const deleteSection = useCallback(async (sectionId: string) => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}/sections/${sectionId}`, { method: 'DELETE' })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || 'Failed to delete section')
            }
            await reloadExam()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
        } finally {
            setLoading(false)
        }
    }, [examId, reloadExam])

    const deleteExam = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/exams/${examId}`, {
                method: 'DELETE',
                headers: await withCsrfHeaders()
            })
            if (!res.ok) throw new Error('Failed to delete exam')
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error')
            return false
        } finally {
            setLoading(false)
        }
    }, [examId])

    const addSegment = useCallback(
        async (questionId: string) => {
            try {
                setLoading(true)
                const question = exam.sections.flatMap((s) => s.questions).find((q) => q.id === questionId)
                const isMCQ = question?.type === 'MCQ'
                const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        instruction: isMCQ ? '' : 'New segment instruction',
                        maxPoints: isMCQ ? null : 1,
                    }),
                })
                if (!res.ok) throw new Error('Failed to create segment')
                await reloadExam()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            } finally {
                setLoading(false)
            }
        },
        [exam.sections, examId, reloadExam]
    )

    const updateSegment = useCallback(
        async (
            questionId: string,
            segmentId: string,
            data: { instruction?: string; maxPoints?: number | null; rubric?: Segment['rubric']; order?: number; isCorrect?: boolean }
        ) => {
            try {
                const hasData = Object.keys(data).some((key) => data[key as keyof typeof data] !== undefined)
                if (!hasData) return

                const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments/${segmentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })

                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update segment')
                }

                await reloadExam()
                setValidationDetails((details) => {
                    if (!details) return null
                    return getValidationErrors()
                })
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            }
        },
        [examId, getValidationErrors, reloadExam]
    )

    const deleteSegment = useCallback(
        async (questionId: string, segmentId: string) => {
            try {
                setLoading(true)
                const res = await fetch(`/api/exams/${examId}/questions/${questionId}/segments/${segmentId}`, {
                    method: 'DELETE',
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to delete segment')
                }
                await reloadExam()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Network error')
            } finally {
                setLoading(false)
            }
        },
        [examId, reloadExam]
    )

    const canPublish = useCallback(() => {
        const errors = getValidationErrors()
        const hasErrors =
            errors.title ||
            errors.date ||
            errors.datePast ||
            errors.duration ||
            errors.correctionReleaseAtInvalid ||
            errors.correctionReleaseAtPast ||
            errors.correctionReleaseAtBeforeStart ||
            errors.correctionReleaseAtBeforeEnd ||
            errors.hasQuestions ||
            errors.questions.length > 0
        return !hasErrors
    }, [getValidationErrors])

    const buildValidationMessages = useCallback(() => {
        const errors = getValidationErrors()
        setValidationDetails(errors)

        const errorMessages: string[] = []
        if (errors.title) errorMessages.push(dict.validationTitle)
        if (errors.date) errorMessages.push(dict.validationDate)
        if (errors.datePast) errorMessages.push(dict.validationDatePast)
        if (errors.duration) errorMessages.push(dict.validationDuration)
        if (errors.correctionReleaseAtInvalid) {
            errorMessages.push(
                dict.validationCorrectionReleaseAtInvalid ||
                (locale === 'fr' ? 'Date d’envoi du corrigé invalide.' : 'Invalid correction release date.')
            )
        }
        if (errors.correctionReleaseAtPast) {
            errorMessages.push(
                dict.validationCorrectionReleaseAtPast ||
                (locale === 'fr' ? 'La date ne peut pas être dans le passé.' : 'Date cannot be in the past.')
            )
        }
        if (errors.correctionReleaseAtBeforeStart) {
            errorMessages.push(
                dict.validationCorrectionReleaseAtBeforeStart ||
                (locale === 'fr' ? 'La date ne peut pas être avant le début de l’examen.' : 'Date cannot be before exam start.')
            )
        }
        if (errors.correctionReleaseAtBeforeEnd) {
            errorMessages.push(
                dict.validationCorrectionReleaseAtBeforeEnd ||
                (locale === 'fr' ? 'La date ne peut pas être avant la fin de l’examen.' : 'Date cannot be before exam end.')
            )
        }
        if (errors.hasQuestions) errorMessages.push(dict.validationContent)

        if (errors.questions.length > 0) {
            const questionErrors = errors.questions.map((qErr) => {
                const parts: string[] = []
                if (qErr.missingContent) parts.push(locale === 'fr' ? 'intitulé manquant' : 'missing title')
                if (qErr.missingLabel) parts.push(locale === 'fr' ? 'numéro manquant' : 'missing number')
                if (qErr.missingPoints) parts.push(locale === 'fr' ? 'points manquants' : 'missing points')
                if (qErr.missingMcqOptions) parts.push(locale === 'fr' ? 'options manquantes' : 'missing options')
                if (qErr.missingMcqOptionText && qErr.missingMcqOptionText.length > 0) {
                    parts.push(
                        locale === 'fr'
                            ? `${qErr.missingMcqOptionText.length} option${qErr.missingMcqOptionText.length > 1 ? 's' : ''} sans texte`
                            : `${qErr.missingMcqOptionText.length} option${qErr.missingMcqOptionText.length > 1 ? 's' : ''} without text`
                    )
                }
                if (qErr.missingMcqOptionPoints && qErr.missingMcqOptionPoints.length > 0) {
                    parts.push(
                        locale === 'fr'
                            ? `${qErr.missingMcqOptionPoints.length} option${qErr.missingMcqOptionPoints.length > 1 ? 's' : ''} sans points`
                            : `${qErr.missingMcqOptionPoints.length} option${qErr.missingMcqOptionPoints.length > 1 ? 's' : ''} without points`
                    )
                }
                if (qErr.mcqTotalPointsMismatch) {
                    parts.push(
                        locale === 'fr'
                            ? 'total de points incoherent'
                            : 'total points mismatch'
                    )
                }
                if (qErr.mcqMissingCorrectOptions) {
                    parts.push(
                        locale === 'fr'
                            ? 'QCM : aucune bonne réponse indiquée'
                            : 'MCQ: no correct option selected'
                    )
                }
                return locale === 'fr' ? `Question avec ${parts.join(', ')}` : `Question with ${parts.join(', ')}`
            })
            errorMessages.push(...questionErrors)
        }

        return { errors, errorMessages }
    }, [dict, getValidationErrors, locale])

    const handlePublishRequest = useCallback(async (policy?: 'PUBLISH_ALL' | 'PUBLISH_EXCEPT_DRAFT_SECTIONS' | 'DELETE_DRAFTS_THEN_PUBLISH') => {
        setLoading(true)
        setValidationErrors([])
        setShowValidationUI(true)
        const { errorMessages } = buildValidationMessages()

        if (errorMessages.length > 0) {
            setValidationErrors(errorMessages)
            setLoading(false)
            return { success: false }
        }

        try {
            const res = await fetch(`/api/exams/${examId}/publish`, {
                method: 'POST',
                headers: await withCsrfHeaders(policy ? { 'Content-Type': 'application/json' } : {}),
                body: policy ? JSON.stringify({ policy }) : undefined,
            })
            const data = await res.json()
            if (data.error === 'validation') {
                const serverErrors = data.missing.map((key: string) => {
                    switch (key) {
                        case 'title':
                            return dict.validationTitle
                        case 'date':
                            return dict.validationDate
                        case 'date_past':
                            return dict.validationDatePast
                        case 'duration':
                            return dict.validationDuration
                        case 'correction_release_at_invalid':
                            return dict.validationCorrectionReleaseAtInvalid
                        case 'correction_release_at_past':
                            return dict.validationCorrectionReleaseAtPast
                        case 'correction_release_at_before_start':
                            return dict.validationCorrectionReleaseAtBeforeStart
                        case 'correction_release_at_before_end':
                            return dict.validationCorrectionReleaseAtBeforeEnd
                        case 'content':
                            return dict.validationContent
                        case 'question_content':
                            return locale === 'fr'
                                ? 'Toutes les questions doivent avoir un intitulé rempli'
                                : 'All questions must have a filled title'
                        case 'question_points':
                            return locale === 'fr'
                                ? 'Toutes les questions doivent avoir un nombre de points défini'
                                : 'All questions must have points defined'
                        case 'mcq_options':
                            return locale === 'fr'
                                ? 'Les questions QCM doivent avoir au moins une option de réponse'
                                : 'MCQ questions must have at least one answer option'
                        case 'mcq_option_text':
                            return locale === 'fr'
                                ? 'Toutes les options de réponse QCM doivent avoir un texte rempli'
                                : 'All MCQ answer options must have filled text'
                        case 'mcq_option_points':
                            return locale === 'fr'
                                ? 'Toutes les options de réponse QCM doivent avoir des points définis'
                                : 'All MCQ answer options must have points defined'
                        case 'mcq_points_mismatch':
                            return locale === 'fr'
                                ? 'Le total des points QCM doit \u00eatre \u00e9gal \u00e0 la somme des points positifs'
                                : 'MCQ total points must equal the sum of positive option points'
                        case 'mcq_correct_options':
                            return dict.validationMcqCorrectOptions
                        default:
                            return key
                    }
                })
                setValidationErrors(serverErrors)
                setValidationDetails(getValidationErrors())
                return { success: false }
            }
            if (!res.ok) throw new Error('Failed to publish exam')
            await reloadExam()
            setValidationErrors([])
            setValidationDetails(null)
            setShowValidationUI(false)
            return { success: true, data }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to publish exam')
            return { success: false }
        } finally {
            setLoading(false)
        }
    }, [buildValidationMessages, dict, examId, getValidationErrors, locale, reloadExam])

    const handlePublish = useCallback(async () => {
        const result = await handlePublishRequest()
        return result.success
    }, [handlePublishRequest])

    const handlePublishWithPolicy = useCallback(async (policy: 'PUBLISH_ALL' | 'PUBLISH_EXCEPT_DRAFT_SECTIONS' | 'DELETE_DRAFTS_THEN_PUBLISH') => {
        return handlePublishRequest(policy)
    }, [handlePublishRequest])

    const handleUnpublish = useCallback(async () => {
        setLoading(true)
        setValidationErrors([])
        setError(null)
        try {
            await fetchJsonWithCsrf(`/api/exams/${examId}/publish`, {
                method: 'DELETE'
            })
            const reloaded = await reloadExam()
            if (reloaded) {
                setValidationDetails(computeValidationDetails(reloaded))
            }
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unpublish exam')
            return false
        } finally {
            setLoading(false)
        }
    }, [computeValidationDetails, examId, reloadExam])

    const handleToggleHonorCommitment = useCallback(
        async (checked: boolean) => {
            // Avoid no-op requests and clear stale errors before toggling
            if (exam.requireHonorCommitment === checked) return
            setError(null)
            setLoading(true)
            try {
                const res = await fetch(`/api/exams/${examId}`, {
                    method: 'PUT',
                    headers: await withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ requireHonorCommitment: checked }),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update honor commitment setting')
                }
                const updatedRaw = (await res.json()) as Exam
                const updated = mergeWithDuration(updatedRaw, exam)
                setExam(updated)
                setLiveExam(updated)
                updateLiveHonorCommitment(checked)
                setValidationDetails(computeValidationDetails(updated))
                setError(null)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update honor commitment setting')
            } finally {
                setLoading(false)
            }
        },
        [computeValidationDetails, exam, examId, mergeWithDuration, updateLiveHonorCommitment]
    )

    const handleUpdateAllowedMaterials = useCallback(
        async (value: string) => {
            setError(null)
            setLoading(true)
            try {
                const res = await fetch(`/api/exams/${examId}`, {
                    method: 'PUT',
                    headers: await withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ allowedMaterials: value.trim() || null }),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update allowed materials')
                }
                const trimmed = value.trim() || null
                updateLiveAllowedMaterials(trimmed)
                setExam((prev) => ({ ...prev, allowedMaterials: trimmed }))
                setValidationDetails(computeValidationDetails({ ...exam, allowedMaterials: trimmed }))
                await reloadExam()
                setError(null)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update allowed materials')
            } finally {
                setLoading(false)
            }
        },
        [computeValidationDetails, exam, examId, reloadExam, updateLiveAllowedMaterials]
    )

    const handleUpdateGradingConfig = useCallback(
        async (gradingConfig: Exam['gradingConfig']) => {
            setError(null)
            setLoading(true)
            try {
                const res = await fetch(`/api/exams/${examId}`, {
                    method: 'PUT',
                    headers: await withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ gradingConfig }),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update grading config')
                }
                updateLiveGradingConfig(gradingConfig ?? null)
                setExam((prev) => ({ ...prev, gradingConfig: gradingConfig ?? null }))
                await reloadExam()
                setError(null)
                return true
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update grading config')
                return false
            } finally {
                setLoading(false)
            }
        },
        [examId, reloadExam, updateLiveGradingConfig]
    )

    const handleUpdateMetadata = useCallback(
        async (field: 'title' | 'date' | 'duration', payload: { title?: string; date?: Date | null; duration?: string | null }, onWarning?: (message: string | null) => void) => {
            setError(null)
            setLoading(true)
            try {
                const body: Record<string, unknown> = {}
                if (field === 'title') body.title = payload.title
                if (field === 'date') {
                    const tempDate = payload.date
                    const isPast = tempDate ? tempDate < new Date() : false
                    if (isPast) {
                        onWarning?.(dict.validationDatePast)
                    } else {
                        onWarning?.(null)
                    }
                    body.startAt = tempDate ? tempDate.toISOString() : null
                }
                if (field === 'duration') {
                    const durationValue = payload.duration ? parseInt(payload.duration, 10) : null
                    if (durationValue === 0) {
                        onWarning?.(dict.validationDuration)
                        setLoading(false)
                        return false
                    }
                    if (durationValue !== null && (durationValue < 0 || Number.isNaN(durationValue))) {
                        throw new Error('Invalid duration value')
                    }
                    body.durationMinutes = durationValue
                    if (durationValue !== null) {
                        updateLiveDuration(durationValue)
                    }
                }

                const res = await fetch(`/api/exams/${examId}`, {
                    method: 'PUT',
                    headers: await withCsrfHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(body),
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Failed to update exam')
                }
                const updatedExamRaw = (await res.json()) as Exam
                const updatedExam = mergeWithDuration(updatedExamRaw, exam)
                setExam(updatedExam)
                setLiveExam(updatedExam)
                if (field === 'title') {
                    updateLiveTitle(updatedExam.title)
                }
                if (field === 'date') {
                    updateLiveDate(updatedExam.startAt)
                }
                if (field === 'duration') {
                    updateLiveDuration(updatedExam.durationMinutes ?? null)
                }
                setValidationDetails(computeValidationDetails(updatedExam))
                setError(null)
                return true
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update exam metadata')
                return false
            } finally {
                setLoading(false)
            }
        },
        [computeValidationDetails, dict.validationDatePast, dict.validationDuration, exam, examId, mergeWithDuration, updateLiveDate, updateLiveDuration, updateLiveTitle]
    )

    return {
        exam,
        liveExam,
        setExam,
        setLiveExam,
        loading,
        error,
        setError,
        validationErrors,
        validationDetails,
        setValidationErrors,
        setValidationDetails,
        showValidationUI,
        setShowValidationUI,
        reloadExam,
        addSection,
        addQuestion,
        updateSection,
        updateQuestion,
        deleteQuestion,
        deleteSection,
        deleteExam,
        addSegment,
        updateSegment,
        deleteSegment,
        getValidationErrors,
        canPublish,
        handlePublish,
        handlePublishWithPolicy,
        handleUnpublish,
        handleToggleHonorCommitment,
        handleUpdateAllowedMaterials,
        handleUpdateMetadata,
        updateLiveQuestionContent,
        updateLiveQuestionAnswerTemplate,
        updateLiveQuestionAnswerTemplateLocked,
        updateLiveQuestionStudentTools,
        updateLiveQuestionLabel,
        updateLiveQuestionMaxPoints,
        updateLiveQuestionRequireAllCorrect,
        updateLiveQuestionShuffleOptions,
        updateLiveSegmentInstruction,
        updateLiveSegmentOrder,
        updateLiveSectionLabel,
        updateLiveSectionTitle,
        updateLiveSectionIntro,
        updateLiveSegmentCriteria,
        updateLiveSegmentPerfectAnswer,
        updateLiveTitle,
        updateLiveDate,
        updateLiveDuration,
        updateLiveHonorCommitment,
        updateLiveAllowedMaterials,
        updateLiveGradingConfig,
        updateLiveSegmentPoints,
        updateLiveSegmentCorrect,
        handleUpdateGradingConfig,
    }
}

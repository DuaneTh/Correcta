'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchJsonWithCsrf } from '@/lib/fetchJsonWithCsrf'
import ExamPreview from '@/components/exams/ExamPreview'
import { ExamLayout } from '@/components/exams/builder/ExamLayout'
import { ExamMetadataHeader } from '@/components/exams/builder/ExamMetadataHeader'
import { PreviewToggle } from '@/components/exams/builder/PreviewToggle'
import { SectionList } from '@/components/exams/builder/SectionList'
import { useExamBuilderData } from '@/components/exams/hooks/useExamBuilderData'
import { Exam, ExamChange } from '@/types/exams'

type ExamBuilderDictionary = {
    teacher: {
        examBuilderPage: Record<string, string> & {
            validationTitle: string
            validationDate: string
            validationDatePast: string
            validationDuration: string
            validationContent: string
            validationMcqCorrectOptions: string
        }
    }
}

interface ExamBuilderProps {
    examId: string
    initialData: Exam
    isLocked?: boolean
    dictionary: ExamBuilderDictionary
    locale?: string
}

export default function ExamBuilder({ examId, initialData, isLocked = false, dictionary, locale = 'fr' }: ExamBuilderProps) {
    const router = useRouter()
    const dict = dictionary.teacher.examBuilderPage
    const isLiveExam = isLocked
    const [liveEditEnabled, setLiveEditEnabled] = useState(false)
    const isEditingLocked = isLiveExam && !liveEditEnabled
    const canEdit = initialData.canEdit !== false
    const isReadOnly = isEditingLocked || !canEdit
    const [viewMode, setViewMode] = useState<'default' | 'focus'>('default')
    const [previewEnabled, setPreviewEnabled] = useState(true)

    useEffect(() => {
        if (!isLiveExam && liveEditEnabled) {
            setLiveEditEnabled(false)
        }
    }, [isLiveExam, liveEditEnabled])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const storedViewMode = window.localStorage.getItem('examBuilder:viewMode')
        const storedPreview = window.localStorage.getItem('examBuilder:previewEnabled')
        if (storedViewMode === 'focus' || storedViewMode === 'default') {
            setViewMode(storedViewMode)
        }
        if (storedPreview === 'true' || storedPreview === 'false') {
            setPreviewEnabled(storedPreview === 'true')
        }
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem('examBuilder:viewMode', viewMode)
    }, [viewMode])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem('examBuilder:previewEnabled', String(previewEnabled))
    }, [previewEnabled])

    const {
        exam,
        liveExam,
        loading,
        error,
        setError,
        validationErrors,
        validationDetails,
        showValidationUI,
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
        handlePublish,
        handlePublishWithPolicy,
        handleUnpublish,
        handleToggleHonorCommitment,
        handleUpdateAllowedMaterials,
        handleUpdateGradingConfig,
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
        updateLiveSegmentPoints,
        updateLiveSegmentCorrect,
        updateLiveSegmentCriteria,
        updateLiveSegmentPerfectAnswer,
        updateLiveSectionTitle,
        updateLiveSectionLabel,
        updateLiveSectionIntro,
        updateLiveAllowedMaterials,
        updateLiveTitle,
        updateLiveDate,
        updateLiveDuration,
        updateLiveHonorCommitment,
        updateLiveGradingConfig,
        canPublish,
    } = useExamBuilderData({ examId, initialData, dict, locale })

    const [previewMode, setPreviewMode] = useState<'student' | 'correction'>('student')
    const [selectedPreviewNodeId, setSelectedPreviewNodeId] = useState<string | null>(null)
    const isFocusMode = viewMode === 'focus'
    const hidePreviewSectionHeader =
        isFocusMode &&
        (selectedPreviewNodeId?.startsWith('question:') || selectedPreviewNodeId?.startsWith('qcm:'))
    const previewLabel = locale === 'fr' ? 'Prévisualisation' : 'Preview'
    type LiveEditOp =
        | { type: 'updateExam'; data: { title?: string; startAt?: string | null; durationMinutes?: number | null; requireHonorCommitment?: boolean; allowedMaterials?: string | null; gradingConfig?: Exam['gradingConfig'] } }
        | { type: 'updateSection'; data: { sectionId: string; patch: Parameters<typeof updateSection>[1] } }
        | { type: 'updateQuestion'; data: { sectionId: string; questionId: string; patch: Parameters<typeof updateQuestion>[2] } }
        | { type: 'updateSegment'; data: { questionId: string; segmentId: string; patch: Parameters<typeof updateSegment>[2] } }
    const [pendingLiveOps, setPendingLiveOps] = useState<LiveEditOp[]>([])
    const hasPerfectExamples = useMemo(() => {
        return liveExam.sections.some((section) =>
            section.questions.some((question) =>
                question.segments.some((segment) => {
                    const examples = segment.rubric?.examples
                    if (Array.isArray(examples)) {
                        return examples.some((example) => example?.trim())
                    }
                    if (typeof examples === 'string') {
                        return examples.trim().length > 0
                    }
                    return false
                })
            )
        )
    }, [liveExam.sections])

    useEffect(() => {
        if (!hasPerfectExamples && previewMode === 'correction') {
            setPreviewMode('student')
        }
    }, [hasPerfectExamples, previewMode])

    const handleExamDelete = async () => {
        const success = await deleteExam()
        if (success) router.push(`/teacher/courses/${exam.courseId}`)
    }

    const pendingPreviewChanges = useMemo(() => {
        if (!isLiveExam || !liveEditEnabled || pendingLiveOps.length === 0) return [] as ExamChange[]
        const changeMap = new Map<string, ExamChange>()
        const now = new Date().toISOString()

        const findSection = (source: Exam, sectionId: string) =>
            source.sections.find((section) => section.id === sectionId)
        const findQuestion = (source: Exam, questionId: string) =>
            source.sections.flatMap((section) => section.questions).find((question) => question.id === questionId)
        const findSegment = (source: Exam, segmentId: string) =>
            source.sections
                .flatMap((section) => section.questions)
                .flatMap((question) => question.segments)
                .find((segment) => segment.id === segmentId)

        const pushChange = (change: ExamChange) => {
            const key = `${change.entityType}:${change.entityId}:${change.field}`
            changeMap.set(key, change)
        }

        for (const op of pendingLiveOps) {
            if (op.type === 'updateExam') {
                if (op.data.title !== undefined) {
                    pushChange({
                        id: `preview-exam-title`,
                        entityType: 'EXAM',
                        entityId: exam.id,
                        entityLabel: exam.title,
                        field: 'title',
                        beforeValue: exam.title,
                        afterValue: liveExam.title,
                        createdAt: now,
                    })
                }
                if (op.data.allowedMaterials !== undefined) {
                    pushChange({
                        id: `preview-exam-materials`,
                        entityType: 'EXAM',
                        entityId: exam.id,
                        entityLabel: exam.title,
                        field: 'allowedMaterials',
                        beforeValue: exam.allowedMaterials ?? null,
                        afterValue: liveExam.allowedMaterials ?? null,
                        createdAt: now,
                    })
                }
                if (op.data.requireHonorCommitment !== undefined) {
                    pushChange({
                        id: `preview-exam-honor`,
                        entityType: 'EXAM',
                        entityId: exam.id,
                        entityLabel: exam.title,
                        field: 'requireHonorCommitment',
                        beforeValue: exam.requireHonorCommitment ?? false,
                        afterValue: liveExam.requireHonorCommitment ?? false,
                        createdAt: now,
                    })
                }
            }

            if (op.type === 'updateSection') {
                const beforeSection = findSection(exam, op.data.sectionId)
                const afterSection = findSection(liveExam, op.data.sectionId)
                if (!beforeSection || !afterSection) continue
                const sectionLabel = afterSection.customLabel || afterSection.title || beforeSection.title

                if (op.data.patch.title !== undefined) {
                    pushChange({
                        id: `preview-section-title-${afterSection.id}`,
                        entityType: 'SECTION',
                        entityId: afterSection.id,
                        entityLabel: sectionLabel,
                        field: 'title',
                        beforeValue: beforeSection.title,
                        afterValue: afterSection.title,
                        createdAt: now,
                    })
                }
                if (op.data.patch.customLabel !== undefined) {
                    pushChange({
                        id: `preview-section-label-${afterSection.id}`,
                        entityType: 'SECTION',
                        entityId: afterSection.id,
                        entityLabel: sectionLabel,
                        field: 'customLabel',
                        beforeValue: beforeSection.customLabel ?? null,
                        afterValue: afterSection.customLabel ?? null,
                        createdAt: now,
                    })
                }
                if (op.data.patch.introContent !== undefined) {
                    pushChange({
                        id: `preview-section-intro-${afterSection.id}`,
                        entityType: 'SECTION',
                        entityId: afterSection.id,
                        entityLabel: sectionLabel,
                        field: 'introContent',
                        beforeValue: beforeSection.introContent ?? null,
                        afterValue: afterSection.introContent ?? null,
                        createdAt: now,
                    })
                }
            }

            if (op.type === 'updateQuestion') {
                const beforeQuestion = findQuestion(exam, op.data.questionId)
                const afterQuestion = findQuestion(liveExam, op.data.questionId)
                if (!beforeQuestion || !afterQuestion) continue
                const questionLabel = afterQuestion.customLabel || `Question ${afterQuestion.order + 1}`

                if (op.data.patch.content !== undefined) {
                    pushChange({
                        id: `preview-question-content-${afterQuestion.id}`,
                        entityType: 'QUESTION',
                        entityId: afterQuestion.id,
                        entityLabel: questionLabel,
                        field: 'content',
                        beforeValue: beforeQuestion.content,
                        afterValue: afterQuestion.content,
                        createdAt: now,
                    })
                }
                if (op.data.patch.answerTemplate !== undefined) {
                    pushChange({
                        id: `preview-question-template-${afterQuestion.id}`,
                        entityType: 'QUESTION',
                        entityId: afterQuestion.id,
                        entityLabel: questionLabel,
                        field: 'answerTemplate',
                        beforeValue: beforeQuestion.answerTemplate ?? null,
                        afterValue: afterQuestion.answerTemplate ?? null,
                        createdAt: now,
                    })
                }
                if (op.data.patch.studentTools !== undefined) {
                    pushChange({
                        id: `preview-question-tools-${afterQuestion.id}`,
                        entityType: 'QUESTION',
                        entityId: afterQuestion.id,
                        entityLabel: questionLabel,
                        field: 'studentTools',
                        beforeValue: beforeQuestion.studentTools ?? null,
                        afterValue: afterQuestion.studentTools ?? null,
                        createdAt: now,
                    })
                }
            }

            if (op.type === 'updateSegment') {
                const beforeSegment = findSegment(exam, op.data.segmentId)
                const afterSegment = findSegment(liveExam, op.data.segmentId)
                const afterQuestion = findQuestion(liveExam, op.data.questionId)
                if (!beforeSegment || !afterSegment || !afterQuestion) continue
                const questionLabel = afterQuestion.customLabel || `Question ${afterQuestion.order + 1}`

                if (op.data.patch.instruction !== undefined) {
                    pushChange({
                        id: `preview-segment-instruction-${afterSegment.id}`,
                        entityType: 'SEGMENT',
                        entityId: afterSegment.id,
                        entityLabel: questionLabel,
                        field: 'instruction',
                        beforeValue: beforeSegment.instruction,
                        afterValue: afterSegment.instruction,
                        createdAt: now,
                    })
                }
            }
        }

        return Array.from(changeMap.values())
    }, [exam, liveExam, isLiveExam, liveEditEnabled, pendingLiveOps])

    const deferLiveEdits = isLiveExam && liveEditEnabled
    const hasPendingLiveEdits = pendingLiveOps.length > 0

    const queueLiveOp = useCallback((op: LiveEditOp) => {
        setPendingLiveOps((prev) => [...prev, op])
    }, [])

    const commitLiveEdits = useCallback(async () => {
        if (pendingLiveOps.length === 0) {
            setLiveEditEnabled(false)
            await reloadExam()
            return
        }
        try {
            setError(null)
            await fetchJsonWithCsrf(`/api/exams/${examId}/batch`, {
                method: 'POST',
                body: { ops: pendingLiveOps },
            })
            setPendingLiveOps([])
            setLiveEditEnabled(false)
            await reloadExam()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply live edits')
        }
    }, [examId, pendingLiveOps, reloadExam, setError])

    const discardLiveEdits = useCallback(async () => {
        setPendingLiveOps([])
        setLiveEditEnabled(false)
        await reloadExam()
    }, [reloadExam])

    const updateSectionQueued = useCallback(async (...args: Parameters<typeof updateSection>) => {
        if (deferLiveEdits) {
            const [sectionId, patch] = args
            queueLiveOp({ type: 'updateSection', data: { sectionId, patch } })
            return
        }
        await updateSection(...args)
    }, [deferLiveEdits, queueLiveOp, updateSection])

    const updateQuestionQueued = useCallback(async (...args: Parameters<typeof updateQuestion>) => {
        if (deferLiveEdits) {
            const [sectionId, questionId, patch] = args
            queueLiveOp({ type: 'updateQuestion', data: { sectionId, questionId, patch } })
            return
        }
        await updateQuestion(...args)
    }, [deferLiveEdits, queueLiveOp, updateQuestion])

    const updateSegmentQueued = useCallback(async (...args: Parameters<typeof updateSegment>) => {
        if (deferLiveEdits) {
            const [questionId, segmentId, patch] = args
            queueLiveOp({ type: 'updateSegment', data: { questionId, segmentId, patch } })
            return
        }
        await updateSegment(...args)
    }, [deferLiveEdits, queueLiveOp, updateSegment])

    const handleUpdateMetadataQueued = useCallback(async (...args: Parameters<typeof handleUpdateMetadata>) => {
        if (deferLiveEdits) {
            const [field, payload, onWarning] = args
            if (field === 'title') {
                updateLiveTitle(payload.title || '')
                queueLiveOp({ type: 'updateExam', data: { title: payload.title || '' } })
            }
            if (field === 'date') {
                const nextDate = payload.date ?? null
                updateLiveDate(nextDate ? nextDate.toISOString() : null)
                const isPast = nextDate ? nextDate < new Date() : false
                onWarning?.(isPast ? dict.validationDatePast : null)
                queueLiveOp({ type: 'updateExam', data: { startAt: nextDate ? nextDate.toISOString() : null } })
            }
            if (field === 'duration') {
                const durationValue = payload.duration ? parseInt(payload.duration, 10) : null
                updateLiveDuration(Number.isNaN(durationValue ?? 0) ? null : durationValue)
                queueLiveOp({ type: 'updateExam', data: { durationMinutes: Number.isNaN(durationValue ?? 0) ? null : durationValue } })
            }
            return true
        }
        return handleUpdateMetadata(...args)
    }, [deferLiveEdits, dict.validationDatePast, handleUpdateMetadata, queueLiveOp, updateLiveDate, updateLiveDuration, updateLiveTitle])

    const handleToggleHonorCommitmentQueued = useCallback(async (checked: boolean) => {
        if (deferLiveEdits) {
            updateLiveHonorCommitment(checked)
            queueLiveOp({ type: 'updateExam', data: { requireHonorCommitment: checked } })
            return
        }
        await handleToggleHonorCommitment(checked)
    }, [deferLiveEdits, handleToggleHonorCommitment, queueLiveOp, updateLiveHonorCommitment])

    const handleUpdateAllowedMaterialsQueued = useCallback(async (value: string) => {
        if (deferLiveEdits) {
            const trimmed = value.trim() || null
            updateLiveAllowedMaterials(trimmed)
            queueLiveOp({ type: 'updateExam', data: { allowedMaterials: trimmed } })
            return
        }
        await handleUpdateAllowedMaterials(value)
    }, [deferLiveEdits, handleUpdateAllowedMaterials, queueLiveOp, updateLiveAllowedMaterials])

    const handleUpdateGradingConfigQueued = useCallback(async (gradingConfig: Exam['gradingConfig']) => {
        if (deferLiveEdits) {
            updateLiveGradingConfig(gradingConfig ?? null)
            queueLiveOp({ type: 'updateExam', data: { gradingConfig: gradingConfig ?? null } })
            return true
        }
        return handleUpdateGradingConfig(gradingConfig)
    }, [deferLiveEdits, handleUpdateGradingConfig, queueLiveOp, updateLiveGradingConfig])

    const basePreviewExam = useMemo(() => {
        return {
            ...liveExam,
            changes: pendingPreviewChanges.length > 0 ? pendingPreviewChanges : exam.changes,
        }
    }, [exam.changes, liveExam, pendingPreviewChanges])

    const previewQuestionLabels = useMemo(() => {
        const map = new Map<string, string>()
        const sortedSections = [...basePreviewExam.sections].sort((a, b) => {
            const orderA = typeof a.order === 'number' ? a.order : 0
            const orderB = typeof b.order === 'number' ? b.order : 0
            return orderA !== orderB ? orderA - orderB : a.id.localeCompare(b.id)
        })
        let globalIndex = 0
        sortedSections.forEach((section) => {
            const sortedQuestions = [...section.questions].sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : 0
                const orderB = typeof b.order === 'number' ? b.order : 0
                return orderA !== orderB ? orderA - orderB : a.id.localeCompare(b.id)
            })
            sortedQuestions.forEach((question) => {
                globalIndex += 1
                map.set(question.id, `${globalIndex}.`)
            })
        })
        return map
    }, [basePreviewExam.sections])

    const previewExam = useMemo(() => {
        const applyGlobalLabels = (section: Exam['sections'][number]) => ({
            ...section,
            questions: section.questions.map((question) => {
                const fallback = previewQuestionLabels.get(question.id)
                const customLabel = question.customLabel?.trim()
                return {
                    ...question,
                    customLabel: customLabel ? question.customLabel : fallback ?? question.customLabel,
                }
            }),
        })

        if (!isFocusMode || !selectedPreviewNodeId) return basePreviewExam
        const [kind, id] = selectedPreviewNodeId.split(':')
        if (!kind || !id) return basePreviewExam
        if (kind === 'part') {
            const section = basePreviewExam.sections.find((item) => item.id === id)
            if (!section) return basePreviewExam
            return {
                ...basePreviewExam,
                sections: [applyGlobalLabels(section)],
            }
        }
        if (kind === 'question' || kind === 'qcm') {
            const section = basePreviewExam.sections.find((item) => item.questions.some((q) => q.id === id))
            if (!section) return basePreviewExam
            return {
                ...basePreviewExam,
                sections: [
                    applyGlobalLabels({
                        ...section,
                        questions: section.questions.filter((q) => q.id === id),
                    }),
                ],
            }
        }
        return basePreviewExam
    }, [basePreviewExam, isFocusMode, previewQuestionLabels, selectedPreviewNodeId])

    const previewPanelBody = (
        <div className="relative z-0">
            <div className="mt-1 inline-flex items-center rounded-full border border-gray-200 bg-gray-50 p-1 text-xs font-semibold text-gray-700">
                <button
                    type="button"
                    onClick={() => setPreviewMode('student')}
                    className={`px-3 py-1 rounded-full transition ${
                        previewMode === 'student' ? 'bg-white shadow-sm text-brand-900 border border-brand-100' : ''
                    }`}
                >
                    {locale === 'fr' ? 'Sujet' : 'Student view'}
                </button>
                <div className="relative group">
                    <button
                        type="button"
                        onClick={() => setPreviewMode('correction')}
                        disabled={!hasPerfectExamples}
                        className={`px-3 py-1 rounded-full transition ${
                            previewMode === 'correction' ? 'bg-white shadow-sm text-brand-900 border border-brand-100' : ''
                        } ${!hasPerfectExamples ? 'text-gray-400 cursor-not-allowed' : ''}`}
                    >
                        {locale === 'fr' ? 'Corrigé' : 'Correction'}
                    </button>
                    {!hasPerfectExamples && (
                        <span className="pointer-events-none absolute left-0 top-9 z-[9999] w-56 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 shadow-lg opacity-0 transition group-hover:opacity-100">
                            {locale === 'fr'
                                ? 'Aucun élément de correction à afficher'
                                : 'No correction content to display'}
                        </span>
                    )}
                </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">
                {previewMode === 'correction'
                    ? (locale === 'fr'
                        ? 'Vue corrigée envoyée aux étudiants après l\'examen'
                        : 'Correction view shared after the exam')
                    : (locale === 'fr'
                        ? 'Vue étudiante de l\'examen'
                        : 'Student view of the exam')}
            </p>
            <div className="mt-4">
                <ExamPreview
                    exam={previewExam}
                    dictionary={dictionary}
                    locale={locale}
                    viewMode={previewMode}
                    hideHeader={isFocusMode}
                    hideSectionHeader={hidePreviewSectionHeader}
                    hideHonorCommitment={isFocusMode}
                />
            </div>
        </div>
    )

    const previewHeader = (
        <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-brand-900">{previewLabel}</h2>
            {!isFocusMode && (
                <PreviewToggle
                    label={previewLabel}
                    checked={previewEnabled}
                    onChange={setPreviewEnabled}
                    labelClassName="sr-only"
                />
            )}
        </div>
    )

    const previewContent = (
        <div className="space-y-3">
            {previewHeader}
            {previewPanelBody}
        </div>
    )

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-6">
            <ExamMetadataHeader
                exam={exam}
                liveExam={liveExam}
                dict={dict}
                locale={locale}
                isLocked={isReadOnly}
                isLiveExam={isLiveExam}
                liveEditEnabled={liveEditEnabled}
                hasPendingLiveEdits={hasPendingLiveEdits}
                onConfirmLiveEdits={commitLiveEdits}
                onDiscardLiveEdits={discardLiveEdits}
                onToggleLiveEdit={(enabled) => {
                    if (!enabled) {
                        setLiveEditEnabled(false)
                        return
                    }
                    setLiveEditEnabled(true)
                }}
                loading={loading}
                validationDetails={validationDetails}
                validationErrors={validationErrors}
                canPublish={canPublish()}
                onPublish={handlePublish}
                onPublishWithPolicy={handlePublishWithPolicy}
                onUnpublish={handleUnpublish}
                onDelete={handleExamDelete}
                onUpdateMetadata={handleUpdateMetadataQueued}
                onToggleHonor={handleToggleHonorCommitmentQueued}
                onUpdateAllowedMaterials={handleUpdateAllowedMaterialsQueued}
                onUpdateGradingConfig={handleUpdateGradingConfigQueued}
                onLiveAllowedMaterials={updateLiveAllowedMaterials}
                setError={setError}
                onReload={reloadExam}
                canEdit={canEdit}
            />

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-2 flex justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <ExamLayout
                left={
                    <SectionList
                        liveExam={liveExam}
                        dict={dict}
                        locale={locale}
                        isLocked={isReadOnly}
                        loading={loading}
                        showValidationUI={showValidationUI}
                        validationDetails={validationDetails}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        focusPreview={isFocusMode && previewEnabled ? previewContent : null}
                        onSelectedNodeChange={setSelectedPreviewNodeId}
                        previewEnabled={previewEnabled}
                        onPreviewToggle={setPreviewEnabled}
                        addSection={addSection}
                        addQuestion={addQuestion}
                        addSegment={addSegment}
                        updateSection={updateSectionQueued}
                        updateQuestion={updateQuestionQueued}
                        updateSegment={updateSegmentQueued}
                        deleteSegment={deleteSegment}
                        deleteQuestion={deleteQuestion}
                        deleteSection={deleteSection}
                        updateLiveQuestionContent={updateLiveQuestionContent}
                        updateLiveQuestionAnswerTemplate={updateLiveQuestionAnswerTemplate}
                        updateLiveQuestionAnswerTemplateLocked={updateLiveQuestionAnswerTemplateLocked}
                        updateLiveQuestionStudentTools={updateLiveQuestionStudentTools}
                        updateLiveQuestionLabel={updateLiveQuestionLabel}
                        updateLiveQuestionMaxPoints={updateLiveQuestionMaxPoints}
                        updateLiveQuestionRequireAllCorrect={updateLiveQuestionRequireAllCorrect}
                        updateLiveQuestionShuffleOptions={updateLiveQuestionShuffleOptions}
                        updateLiveSegmentInstruction={updateLiveSegmentInstruction}
                        updateLiveSegmentOrder={updateLiveSegmentOrder}
                        updateLiveSegmentPoints={updateLiveSegmentPoints}
                        updateLiveSegmentCorrect={updateLiveSegmentCorrect}
                        updateLiveSegmentCriteria={updateLiveSegmentCriteria}
                        updateLiveSegmentPerfectAnswer={updateLiveSegmentPerfectAnswer}
                        updateLiveSectionTitle={updateLiveSectionTitle}
                        updateLiveSectionLabel={updateLiveSectionLabel}
                        updateLiveSectionIntro={updateLiveSectionIntro}
                    />
                }
                right={!isFocusMode && previewEnabled ? previewContent : null}
            />
        </div>
    )
}

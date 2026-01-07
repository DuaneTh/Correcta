"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit2, Loader2, Save, Trash2, X } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { ExamStatusBadge } from '@/components/teacher/ExamStatusBadge'
import { getCorrectionReleaseInfo } from '@/lib/correction-release'
import { getExamEndAt } from '@/lib/exam-time'
import { Exam, ValidationErrors } from '@/types/exams'

type ExamMetadataHeaderProps = {
    exam: Exam
    liveExam: Exam
    dict: Record<string, string>
    locale: string
    isLocked: boolean
    isLiveExam: boolean
    liveEditEnabled: boolean
    hasPendingLiveEdits: boolean
    onConfirmLiveEdits: () => void
    onDiscardLiveEdits: () => void
    onToggleLiveEdit: (enabled: boolean) => void
    loading: boolean
    validationDetails: ValidationErrors | null
    validationErrors: string[]
    canPublish: boolean
    onPublish: () => Promise<boolean>
    onPublishWithPolicy: (
        policy: 'PUBLISH_ALL' | 'PUBLISH_EXCEPT_DRAFT_SECTIONS' | 'DELETE_DRAFTS_THEN_PUBLISH'
    ) => Promise<{ success: boolean; data?: any }>
    onUnpublish: () => Promise<boolean>
    onDelete: () => void
    onUpdateMetadata: (
        field: 'title' | 'date' | 'duration',
        payload: { title?: string; date?: Date | null; duration?: string | null },
        onWarning?: (message: string | null) => void
    ) => Promise<boolean>
    onToggleHonor: (checked: boolean) => Promise<void>
    onUpdateAllowedMaterials: (value: string) => Promise<void>
    onUpdateGradingConfig: (gradingConfig: Exam['gradingConfig']) => Promise<boolean>
    onLiveAllowedMaterials: (value: string) => void
    setError: (message: string | null) => void
    onReload: () => Promise<Exam | null>
    canEdit: boolean
}

const isNonEmpty = (value?: string | null) => Boolean(value && value.trim())

export function ExamMetadataHeader({
    exam,
    liveExam,
    dict,
    locale,
    isLocked,
    isLiveExam,
    liveEditEnabled,
    hasPendingLiveEdits,
    onConfirmLiveEdits,
    onDiscardLiveEdits,
    onToggleLiveEdit,
    loading,
    validationDetails,
    validationErrors,
    canPublish,
    onPublish,
    onPublishWithPolicy,
    onUnpublish,
    onDelete,
    onUpdateMetadata,
    onToggleHonor,
    onUpdateAllowedMaterials,
    onUpdateGradingConfig,
    onLiveAllowedMaterials,
    setError,
    onReload,
    canEdit,
}: ExamMetadataHeaderProps) {
    const router = useRouter()
    const isFrench = locale === 'fr'
    const [editingTitle, setEditingTitle] = useState(false)
    const [tempTitle, setTempTitle] = useState(exam.title)
    const [editingDate, setEditingDate] = useState(false)
    const [tempDate, setTempDate] = useState<Date | null>(exam.startAt ? new Date(exam.startAt) : null)
    const [editingDuration, setEditingDuration] = useState(false)
    const [tempDuration, setTempDuration] = useState(exam.durationMinutes?.toString() || '')
    const [editingAllowedMaterials, setEditingAllowedMaterials] = useState(false)
    const [tempAllowedMaterials, setTempAllowedMaterials] = useState(exam.allowedMaterials || '')
    const [dateWarning, setDateWarning] = useState<string | null>(null)
    const [durationWarning, setDurationWarning] = useState<string | null>(null)
    const [pendingPublish, setPendingPublish] = useState(false)
    const [pendingUnpublish, setPendingUnpublish] = useState(false)
    const [pendingLiveEdit, setPendingLiveEdit] = useState(false)
    const [pendingCorrectionSend, setPendingCorrectionSend] = useState(false)
    const [pendingDelete, setPendingDelete] = useState(false)
    const [showPublishPolicyModal, setShowPublishPolicyModal] = useState(false)
    const [publishPolicy, setPublishPolicy] = useState<'PUBLISH_ALL' | 'PUBLISH_EXCEPT_DRAFT_SECTIONS' | 'DELETE_DRAFTS_THEN_PUBLISH'>('PUBLISH_ALL')
    const [publishPolicyConfirmText, setPublishPolicyConfirmText] = useState('')
    const [publishPolicyError, setPublishPolicyError] = useState<string | null>(null)
    const [isPublishingPolicy, setIsPublishingPolicy] = useState(false)
    const [showDuplicatePanel, setShowDuplicatePanel] = useState(false)
    const [duplicateSelection, setDuplicateSelection] = useState<string[]>([])
    const [isDuplicating, setIsDuplicating] = useState(false)
    const [editingCorrectionRelease, setEditingCorrectionRelease] = useState(false)
    const [tempCorrectionReleaseAt, setTempCorrectionReleaseAt] = useState<Date | null>(null)
    const [correctionReleaseWarning, setCorrectionReleaseWarning] = useState<string | null>(null)
    const [showStickyLiveBanner, setShowStickyLiveBanner] = useState(false)
    const [stickyLiveWidth, setStickyLiveWidth] = useState<number | null>(null)
    const confirmRef = useRef<HTMLDivElement>(null)
    const deleteConfirmRef = useRef<HTMLDivElement>(null)
    const liveBannerRef = useRef<HTMLDivElement>(null)
    const publishModalRef = useRef<HTMLDivElement>(null)

    const dateLabel = dict.dateLabel || (isFrench ? 'Date et heure' : 'Date & time')
    const durationLabel = dict.durationLabel || (isFrench ? 'Dur\u00e9e' : 'Duration')
    const noDateText = dict.noDate || (isFrench ? 'Non d\u00e9finie' : 'Not set')
    const noDurationText = dict.noDuration || (isFrench ? 'Non d\u00e9finie' : 'Not set')
    const minutesSuffix = dict.minutesSuffix || (isFrench ? 'min' : 'min')
    const validationTitle = dict.validationListTitle || (isFrench ? 'Impossible de publier :' : 'Cannot publish:')
    const publishLabel = dict.publishButton || (isFrench ? 'Publier' : 'Publish')
    const publishConfirmLabel = dict.publishConfirmButton || (isFrench ? 'Confirmer' : 'Confirm')
    const publishCancelLabel = dict.publishCancelButton || (isFrench ? 'Annuler' : 'Cancel')
    const unpublishLabel = dict.unpublishButton || (isFrench ? 'Annuler la publication' : 'Unpublish')
    const liveEditLabel = dict.liveEditEnableLabel || (isFrench ? 'Activer les modifications' : 'Enable edits')
    const liveEditConfirmLabel = dict.liveEditConfirmLabel || (isFrench ? 'Confirmer les modifications' : 'Confirm edits')
    const liveEditCancelLabel = dict.liveEditCancelLabel || (isFrench ? 'Annuler' : 'Cancel')

    const now = useMemo(() => new Date(), [exam.updatedAt, liveExam.updatedAt])
    const startAt = exam.startAt ? new Date(exam.startAt) : null
    const endAt = startAt ? getExamEndAt(startAt, exam.durationMinutes ?? null, exam.endAt ?? null) : null
    const isPublished = exam.status === 'PUBLISHED'
    const isDraft = exam.status === 'DRAFT'
    const isExamStarted = Boolean(isPublished && startAt && now >= startAt)
    const isExamEnded = Boolean(isPublished && endAt && now >= endAt)

    const correctionInfo = useMemo(
        () =>
            getCorrectionReleaseInfo({
                gradingConfig: liveExam.gradingConfig ?? null,
                startAt: liveExam.startAt,
                durationMinutes: liveExam.durationMinutes ?? null,
                endAt: liveExam.endAt ?? null,
                now,
            }),
        [liveExam.gradingConfig, liveExam.startAt, liveExam.durationMinutes, liveExam.endAt, now]
    )

    const correctionReleaseOnEnd = liveExam.gradingConfig?.correctionReleaseOnEnd === true
    const correctionReleaseAtRaw =
        typeof liveExam.gradingConfig?.correctionReleaseAt === 'string'
            ? liveExam.gradingConfig?.correctionReleaseAt
            : null
    const correctionReleaseAt = correctionReleaseAtRaw ? new Date(correctionReleaseAtRaw) : null
    const correctionReleaseLocked = correctionInfo.gradesReleased || correctionInfo.gradesReleasedAt !== null
    const hasCorrectionReleaseError =
        Boolean(validationDetails?.correctionReleaseAtInvalid) ||
        Boolean(validationDetails?.correctionReleaseAtPast) ||
        Boolean(validationDetails?.correctionReleaseAtBeforeStart) ||
        Boolean(validationDetails?.correctionReleaseAtBeforeEnd)
    const resolveCorrectionReleaseErrorMessage = useCallback((value: Date | null) => {
        if (!value) return null
        if (Number.isNaN(value.getTime())) {
            return dict.validationCorrectionReleaseAtInvalid || (isFrench ? 'Date d\u2019envoi du corrig\u00e9 invalide.' : 'Invalid correction release date.')
        }
        const now = new Date()
        if (value < now) {
            return dict.validationCorrectionReleaseAtPast || (isFrench ? 'La date ne peut pas \u00eatre dans le pass\u00e9.' : 'Date cannot be in the past.')
        }
        if (liveExam.startAt) {
            const startDate = new Date(liveExam.startAt)
            if (liveExam.durationMinutes && liveExam.durationMinutes > 0) {
                const endDate = new Date(startDate)
                endDate.setMinutes(endDate.getMinutes() + liveExam.durationMinutes)
                if (value < endDate) {
                    return dict.validationCorrectionReleaseAtBeforeEnd || (isFrench ? 'La date ne peut pas \u00eatre avant la fin de l\u2019examen.' : 'Date cannot be before exam end.')
                }
            } else if (value < startDate) {
                return dict.validationCorrectionReleaseAtBeforeStart || (isFrench ? 'La date ne peut pas \u00eatre avant le d\u00e9but de l\u2019examen.' : 'Date cannot be before exam start.')
            }
        }
        return null
    }, [dict, isFrench, liveExam.durationMinutes, liveExam.startAt])
    const correctionReleaseErrorMessage =
        correctionReleaseWarning ||
        (hasCorrectionReleaseError
            ? validationDetails?.correctionReleaseAtPast
                ? dict.validationCorrectionReleaseAtPast || (isFrench ? 'La date ne peut pas \u00eatre dans le pass\u00e9.' : 'Date cannot be in the past.')
                : validationDetails?.correctionReleaseAtBeforeEnd
                    ? dict.validationCorrectionReleaseAtBeforeEnd || (isFrench ? 'La date ne peut pas \u00eatre avant la fin de l\u2019examen.' : 'Date cannot be before exam end.')
                    : validationDetails?.correctionReleaseAtBeforeStart
                        ? dict.validationCorrectionReleaseAtBeforeStart || (isFrench ? 'La date ne peut pas \u00eatre avant le d\u00e9but de l\u2019examen.' : 'Date cannot be before exam start.')
                        : dict.validationCorrectionReleaseAtInvalid || (isFrench ? 'Date d\u2019envoi du corrig\u00e9 invalide.' : 'Invalid correction release date.')
            : null)

    useEffect(() => {
        setTempTitle(exam.title)
    }, [exam.title])

    useEffect(() => {
        setTempDuration(exam.durationMinutes?.toString() || '')
    }, [exam.durationMinutes])

    useEffect(() => {
        setTempDate(exam.startAt ? new Date(exam.startAt) : null)
    }, [exam.startAt])

    useEffect(() => {
        setTempAllowedMaterials(exam.allowedMaterials || '')
    }, [exam.allowedMaterials])

    useEffect(() => {
        if (editingCorrectionRelease) return
        if (!correctionReleaseAtRaw) {
            setTempCorrectionReleaseAt(null)
            setCorrectionReleaseWarning(null)
            return
        }

        const nextDate = new Date(correctionReleaseAtRaw)
        const nextTime = nextDate.getTime()
        const currentTime = tempCorrectionReleaseAt?.getTime()
        if (currentTime !== nextTime) {
            setTempCorrectionReleaseAt(nextDate)
        }
        const nextWarning = resolveCorrectionReleaseErrorMessage(nextDate)
        if (nextWarning !== correctionReleaseWarning) {
            setCorrectionReleaseWarning(nextWarning)
        }
    }, [correctionReleaseAtRaw, correctionReleaseWarning, editingCorrectionRelease, resolveCorrectionReleaseErrorMessage, tempCorrectionReleaseAt])

    useEffect(() => {
        if (exam.status === 'DRAFT' && exam.startAt) {
            const isPast = new Date(exam.startAt) < new Date()
            setDateWarning(isPast ? dict.validationDatePast : null)
        } else {
            setDateWarning(null)
        }
    }, [exam.startAt, exam.status, dict.validationDatePast])

    useEffect(() => {
        if (!editingDate && isExamStarted) {
            setEditingDate(false)
        }
    }, [editingDate, isExamStarted])

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pendingDelete && deleteConfirmRef.current && !deleteConfirmRef.current.contains(event.target as Node)) {
                setPendingDelete(false)
            }
            if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
                setPendingPublish(false)
                setPendingUnpublish(false)
                setPendingLiveEdit(false)
                setPendingCorrectionSend(false)
                setPendingDelete(false)
                setShowDuplicatePanel(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [pendingDelete])

    const closePublishPolicyModal = useCallback(() => {
        setShowPublishPolicyModal(false)
        setPublishPolicyError(null)
        setPublishPolicyConfirmText('')
    }, [])

    useEffect(() => {
        if (!showPublishPolicyModal) return
        const modal = publishModalRef.current
        if (!modal) return

        const focusableSelector =
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        first?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                closePublishPolicyModal()
                return
            }
            if (event.key !== 'Tab' || focusable.length === 0) return
            if (event.shiftKey) {
                if (document.activeElement === first) {
                    event.preventDefault()
                    last?.focus()
                }
            } else if (document.activeElement === last) {
                event.preventDefault()
                first?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [closePublishPolicyModal, showPublishPolicyModal])

    useEffect(() => {
        const handleScroll = () => {
            if (!liveBannerRef.current) return
            const rect = liveBannerRef.current.getBoundingClientRect()
            setShowStickyLiveBanner(rect.top < 8)
            setStickyLiveWidth(liveBannerRef.current.offsetWidth)
        }
        const handleResize = () => handleScroll()
        window.addEventListener('scroll', handleScroll, { passive: true })
        window.addEventListener('resize', handleResize)
        handleScroll()
        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    useEffect(() => {
        if (publishPolicy !== 'DELETE_DRAFTS_THEN_PUBLISH') {
            setPublishPolicyConfirmText('')
            setPublishPolicyError(null)
        }
    }, [publishPolicy])

    const handleSaveTitle = async () => {
        const success = await onUpdateMetadata('title', { title: tempTitle })
        if (success) setEditingTitle(false)
    }

    const handleSaveDate = async () => {
        const success = await onUpdateMetadata('date', { date: tempDate }, setDateWarning)
        if (success) setEditingDate(false)
    }

    const handleSaveDuration = async () => {
        const success = await onUpdateMetadata('duration', { duration: tempDuration }, setDurationWarning)
        if (success) setEditingDuration(false)
    }

    const isBaseExam = !exam.parentExamId && !exam.classId
    const draftVariants = exam.draftVariantsBySection ?? []
    const draftVariantsCount = exam.draftVariantsCount ?? draftVariants.length
    const hasDraftVariants = isBaseExam && draftVariantsCount > 0
    const deleteConfirmKeyword = isFrench ? 'SUPPRIMER' : 'DELETE'

    const handlePublishClick = async () => {
        if (!canPublish) {
            await onPublish()
            return
        }
        if (hasDraftVariants) {
            setPublishPolicyError(null)
            setShowPublishPolicyModal(true)
            return
        }
        setPendingPublish(true)
    }

    const handleConfirmPublish = async () => {
        const success = await onPublish()
        if (success) setPendingPublish(false)
    }

    const handleConfirmPublishPolicy = async () => {
        if (publishPolicy === 'DELETE_DRAFTS_THEN_PUBLISH' && publishPolicyConfirmText.trim() !== deleteConfirmKeyword) {
            setPublishPolicyError(isFrench ? `Tapez ${deleteConfirmKeyword} pour confirmer.` : `Type ${deleteConfirmKeyword} to confirm.`)
            return
        }
        setPublishPolicyError(null)
        setIsPublishingPolicy(true)
        const result = await onPublishWithPolicy(publishPolicy)
        setIsPublishingPolicy(false)
        if (result.success) {
            setShowPublishPolicyModal(false)
            setPendingPublish(false)
            setPublishPolicy('PUBLISH_ALL')
            setPublishPolicyConfirmText('')
        }
    }

    const handleConfirmUnpublish = async () => {
        const success = await onUnpublish()
        if (success) setPendingUnpublish(false)
    }

    const handleConfirmDelete = () => {
        onDelete()
        setPendingDelete(false)
    }

    const handleDuplicateToSections = async () => {
        if (duplicateSelection.length === 0) return
        setIsDuplicating(true)
        setError(null)
        try {
            const res = await fetch(`/api/exams/${baseExamId}/variants`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classIds: duplicateSelection }),
            })
            if (!res.ok) {
                const text = await res.text()
                throw new Error(text || 'Failed to duplicate exam')
            }
            await onReload()
            setDuplicateSelection([])
            setShowDuplicatePanel(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to duplicate exam')
        } finally {
            setIsDuplicating(false)
        }
    }

    const handleCorrectionReleaseToggle = async (checked: boolean) => {
        const nextConfig = {
            ...(liveExam.gradingConfig ?? {}),
            correctionReleaseOnEnd: checked,
            correctionReleaseAt: checked ? null : (correctionReleaseAtRaw ?? null),
        }
        if (checked) {
            setCorrectionReleaseWarning(null)
        }
        const success = await onUpdateGradingConfig(nextConfig)
        if (!success) return
    }

    const handleCorrectionReleaseDateSave = async () => {
        const nextConfig = {
            ...(liveExam.gradingConfig ?? {}),
            correctionReleaseAt: tempCorrectionReleaseAt ? tempCorrectionReleaseAt.toISOString() : null,
        }
        const success = await onUpdateGradingConfig(nextConfig)
        if (success) setEditingCorrectionRelease(false)
    }

    const handleClearCorrectionReleaseDate = async () => {
        const nextConfig = {
            ...(liveExam.gradingConfig ?? {}),
            correctionReleaseAt: null,
        }
        const success = await onUpdateGradingConfig(nextConfig)
        if (success) {
            setTempCorrectionReleaseAt(null)
            setCorrectionReleaseWarning(null)
            setEditingCorrectionRelease(false)
        }
    }

    const handleSendCorrectionNow = async () => {
        if (!correctionInfo.canSendManually) return
        const nowIso = new Date().toISOString()
        const nextConfig = {
            ...(liveExam.gradingConfig ?? {}),
            correctionReleaseOnEnd: false,
            correctionReleaseAt: null,
            gradesReleased: true,
            gradesReleasedAt: nowIso,
        }
        const success = await onUpdateGradingConfig(nextConfig)
        if (success) setPendingCorrectionSend(false)
    }

    const statusLabel = (() => {
        if (exam.status === 'DRAFT') return dict.examDraftBadge || (isFrench ? 'Brouillon' : 'Draft')
        if (!startAt) return dict.examPublishedBadge || (isFrench ? 'Publi\u00e9' : 'Published')
        if (isExamEnded) return dict.examEndedBadge || (isFrench ? 'Termin\u00e9' : 'Ended')
        if (isExamStarted) return dict.examInProgressBadge || (isFrench ? 'En cours' : 'In progress')
        return dict.examScheduledBadge || (isFrench ? 'Programm\u00e9' : 'Scheduled')
    })()

    const statusClassName = (() => {
        if (exam.status === 'DRAFT') return 'border-amber-200 bg-amber-50 text-amber-700'
        if (isExamEnded) return 'border-gray-200 bg-gray-100 text-gray-600'
        return 'border-brand-900/20 bg-brand-50 text-brand-900'
    })()
    const compactStatusClassName = `${statusClassName} font-semibold shadow-sm text-sm px-2.5 py-1 rounded-md`

    const baseExamId = exam.baseExamId ?? exam.parentExamId ?? exam.id
    const baseExamTitle = exam.id === baseExamId ? exam.title : (exam.baseExamTitle ?? exam.title)
    const courseSections = exam.courseSections ?? []
    const variants = exam.variants ?? []
    const isVariant = Boolean(exam.parentExamId || exam.classId)
    const variantSectionIds = new Set(variants.map((variant) => variant.classId))
    const selectableSections = courseSections.filter((section) => section.canEdit !== false)
    const availableDuplicateSections = selectableSections.filter((section) => !variantSectionIds.has(section.id))

    const metaRows = [
        {
            label: dateLabel,
            value: liveExam.startAt
                ? new Date(liveExam.startAt).toLocaleString(isFrench ? 'fr-FR' : 'en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                  })
                : noDateText,
            editing: editingDate,
            setEditing: setEditingDate,
            renderEditor: () => (
                <DateTimePicker
                    date={tempDate}
                    onChange={(date) => setTempDate(date)}
                    onBlur={handleSaveDate}
                    locale={isFrench ? 'fr' : 'en'}
                    placeholder={isFrench ? 'jj/mm/aaaa hh:mm' : 'dd/mm/yyyy hh:mm'}
                    autoOpen={editingDate}
                    className="w-60 max-w-full"
                    inputClassName="text-sm font-medium"
                />
            ),
            onSave: handleSaveDate,
            warning: dateWarning,
            hasError: Boolean(validationDetails?.date || validationDetails?.datePast),
            locked: isExamStarted,
            clickToEdit: true,
            displayWidthClass: 'w-60',
        },
        {
            label: durationLabel,
            value: liveExam.durationMinutes ? `${liveExam.durationMinutes} ${minutesSuffix}` : noDurationText,
            editing: editingDuration,
            setEditing: setEditingDuration,
            renderEditor: () => (
                <input
                    type="text"
                    value={tempDuration}
                    onChange={(e) => {
                        const numeric = e.target.value.replace(/[^\d]/g, '')
                        setTempDuration(numeric)
                    }}
                    onBlur={handleSaveDuration}
                    autoFocus
                    className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-700 focus:border-brand-900 focus:ring-brand-900"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={durationLabel}
                />
            ),
            onSave: handleSaveDuration,
            warning: durationWarning,
            hasError: Boolean(validationDetails?.duration),
            locked: false,
            clickToEdit: true,
            displayWidthClass: 'w-28',
        },
    ]

    const renderLiveEditControls = () => {
        if (!isLiveExam || !canEdit) return null

        if (liveEditEnabled) {
            return (
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                        onClick={onConfirmLiveEdits}
                        disabled={!hasPendingLiveEdits}
                    >
                        {liveEditConfirmLabel}
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={onDiscardLiveEdits}
                    >
                        {liveEditCancelLabel}
                    </button>
                </div>
            )
        }

        return (
            <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-100"
                onClick={() => onToggleLiveEdit(true)}
            >
                {liveEditLabel}
            </button>
        )
    }

    const renderCancelLiveExamButton = () => {
        if (!canEdit || !isExamStarted || isExamEnded || !isPublished) return null
        if (pendingUnpublish) {
            return (
                <div className="inline-flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                        onClick={handleConfirmUnpublish}
                    >
                        {publishConfirmLabel}
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        onClick={() => setPendingUnpublish(false)}
                    >
                        {publishCancelLabel}
                    </button>
                </div>
            )
        }
        return (
            <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                onClick={() => setPendingUnpublish(true)}
            >
                {isFrench ? 'Annuler l\u2019examen en cours' : 'Cancel live exam'}
            </button>
        )
    }

    return (
        <div className="space-y-3 mb-6" ref={confirmRef}>
            {showPublishPolicyModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="publish-policy-title"
                    onClick={closePublishPolicyModal}
                >
                    <div
                        ref={publishModalRef}
                        className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <h2 id="publish-policy-title" className="text-lg font-semibold text-gray-900">
                                    {isFrench
                                        ? 'Des sujets par section en brouillon existent'
                                        : 'Draft section exams already exist'}
                                </h2>
                                <p className="text-sm text-gray-600">
                                    {isFrench
                                        ? "Le commun peut être publié pour toutes les sections, ou vous pouvez exclure certaines sections tant que leur brouillon n'est pas prêt."
                                        : 'You can publish the base exam for all sections, or exclude sections with drafts until they are ready.'}
                                </p>
                            </div>

                            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    {isFrench ? 'Sections concernées' : 'Affected sections'}
                                </p>
                                {draftVariants.length > 0 ? (
                                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                                        {draftVariants.map((variant) => (
                                            <li key={variant.id} className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-medium">
                                                    {variant.className || (isFrench ? 'Section sans nom' : 'Unnamed section')}
                                                </span>
                                                <Link
                                                    href={`/dashboard/exams/${variant.id}/builder`}
                                                    className="text-xs text-brand-900 underline decoration-dotted underline-offset-4 hover:text-brand-700"
                                                >
                                                    {isFrench ? 'Ouvrir le brouillon' : 'Open draft'}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mt-2 text-sm text-gray-500 italic">
                                        {isFrench ? 'Aucun brouillon détecté.' : 'No draft variants detected.'}
                                    </p>
                                )}
                            </div>

                            <fieldset className="space-y-3">
                                <legend className="text-sm font-semibold text-gray-800">
                                    {isFrench ? 'Que souhaitez-vous faire ?' : 'Choose what to do'}
                                </legend>
                                <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 hover:border-brand-200">
                                    <input
                                        type="radio"
                                        name="publish-policy"
                                        value="PUBLISH_ALL"
                                        checked={publishPolicy === 'PUBLISH_ALL'}
                                        onChange={() => setPublishPolicy('PUBLISH_ALL')}
                                        className="mt-1 h-4 w-4 text-brand-900"
                                        data-autofocus
                                    />
                                    <span className="text-sm text-gray-700">
                                        <span className="font-semibold text-brand-900">
                                            {isFrench ? '[RECOMMANDÉ] Publier le commun pour toutes les sections' : '[RECOMMENDED] Publish the base exam to all sections'}
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            {isFrench
                                                ? 'Les brouillons restent inactifs.'
                                                : 'Draft variants remain inactive.'}
                                        </span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 hover:border-brand-200">
                                    <input
                                        type="radio"
                                        name="publish-policy"
                                        value="PUBLISH_EXCEPT_DRAFT_SECTIONS"
                                        checked={publishPolicy === 'PUBLISH_EXCEPT_DRAFT_SECTIONS'}
                                        onChange={() => setPublishPolicy('PUBLISH_EXCEPT_DRAFT_SECTIONS')}
                                        className="mt-1 h-4 w-4 text-brand-900"
                                    />
                                    <span className="text-sm text-gray-700">
                                        <span className="font-semibold">
                                            {isFrench
                                                ? 'Publier le commun sauf pour les sections ayant un brouillon'
                                                : 'Publish the base exam except for sections with drafts'}
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            {isFrench
                                                ? 'Ces sections ne recevront pas le commun.'
                                                : 'Those sections will not get the base exam.'}
                                        </span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 hover:border-red-200">
                                    <input
                                        type="radio"
                                        name="publish-policy"
                                        value="DELETE_DRAFTS_THEN_PUBLISH"
                                        checked={publishPolicy === 'DELETE_DRAFTS_THEN_PUBLISH'}
                                        onChange={() => setPublishPolicy('DELETE_DRAFTS_THEN_PUBLISH')}
                                        className="mt-1 h-4 w-4 text-red-600"
                                    />
                                    <span className="text-sm text-gray-700">
                                        <span className="font-semibold text-red-700">
                                            {isFrench
                                                ? 'Supprimer les brouillons et publier le commun'
                                                : 'Delete drafts and publish the base exam'}
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            {isFrench
                                                ? 'Les brouillons seront supprimés définitivement.'
                                                : 'Draft variants will be permanently deleted.'}
                                        </span>
                                    </span>
                                </label>
                                {publishPolicy === 'DELETE_DRAFTS_THEN_PUBLISH' && (
                                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        <p className="font-semibold">
                                            {isFrench ? 'Confirmation requise' : 'Confirmation required'}
                                        </p>
                                        <p className="text-xs text-red-600">
                                            {isFrench
                                                ? `Tapez ${deleteConfirmKeyword} pour confirmer la suppression.`
                                                : `Type ${deleteConfirmKeyword} to confirm deletion.`}
                                        </p>
                                        <input
                                            type="text"
                                            value={publishPolicyConfirmText}
                                            onChange={(event) => setPublishPolicyConfirmText(event.target.value)}
                                            className="mt-2 w-full rounded-md border border-red-200 px-3 py-2 text-sm focus:border-red-400 focus:ring-red-400"
                                            aria-label={isFrench ? 'Confirmation suppression' : 'Delete confirmation'}
                                        />
                                    </div>
                                )}
                            </fieldset>

                            {publishPolicyError && (
                                <p className="text-sm text-red-600">{publishPolicyError}</p>
                            )}

                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={closePublishPolicyModal}
                                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    disabled={isPublishingPolicy}
                                >
                                    {isFrench ? 'Annuler' : 'Cancel'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPublishPolicy}
                                    className="inline-flex items-center justify-center rounded-md bg-brand-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                                    disabled={isPublishingPolicy || (publishPolicy === 'DELETE_DRAFTS_THEN_PUBLISH' && publishPolicyConfirmText.trim() !== deleteConfirmKeyword)}
                                >
                                    {isPublishingPolicy
                                        ? (isFrench ? 'Publication...' : 'Publishing...')
                                        : (isFrench ? 'Confirmer' : 'Confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2 mb-2">
                <Link
                    href={`/teacher/courses/${exam.courseId}`}
                    className="inline-flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:text-brand-900 hover:bg-gray-50 transition"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {isFrench ? 'Retour au cours' : 'Back to course'}
                </Link>
                <Link
                    href="/teacher/courses"
                    className="inline-flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:text-brand-900 hover:bg-gray-50 transition"
                >
                    {isFrench ? 'Tous les cours' : 'All courses'}
                </Link>
                <Link
                    href="/dashboard/exams"
                    className="inline-flex items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:text-brand-900 hover:bg-gray-50 transition"
                >
                    {isFrench ? 'Tous les examens' : 'All exams'}
                </Link>
            </div>

            {(variants.length > 0 || isVariant || courseSections.length > 0) && (
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase text-gray-500">
                                {isFrench ? 'Section' : 'Section'}
                            </p>
                            <div className="text-sm font-medium text-gray-900">
                                {isVariant
                                    ? (exam.className || (isFrench ? 'Section sans nom' : 'Unnamed section'))
                                    : (isFrench ? 'Sujet de base (commun)' : 'Base exam (shared)')}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={exam.id}
                                onChange={(event) => {
                                    const nextId = event.target.value
                                    if (nextId && nextId !== exam.id) {
                                        router.push(`/dashboard/exams/${nextId}/builder`)
                                    }
                                }}
                                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-brand-900 focus:ring-brand-900"
                            >
                                <option value={baseExamId}>
                                    {isFrench ? `Sujet de base - ${baseExamTitle}` : `Base exam - ${baseExamTitle}`}
                                </option>
                                {variants.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                        {variant.className || (isFrench ? 'Section' : 'Section')}
                                    </option>
                                ))}
                            </select>

                            {canEdit && !isVariant && (
                                <button
                                    type="button"
                                    onClick={() => setShowDuplicatePanel((prev) => !prev)}
                                    className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    {isFrench ? 'Dupliquer' : 'Duplicate'}
                                </button>
                            )}
                        </div>
                    </div>

                    {showDuplicatePanel && canEdit && !isVariant && (
                        <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
                            {availableDuplicateSections.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">
                                    {isFrench ? 'Toutes vos sections ont d\u00e9j\u00e0 une version d\u00e9di\u00e9e.' : 'All your sections already have a dedicated version.'}
                                </p>
                            ) : (
                                <>
                                    <p className="text-sm text-gray-600">
                                        {isFrench ? 'Choisissez les sections \u00e0 recevoir la version dupliqu\u00e9e :' : 'Select sections for the duplicated version:'}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                    {availableDuplicateSections.map((section) => {
                                            const checked = duplicateSelection.includes(section.id)
                                            return (
                                                <label
                                                    key={section.id}
                                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer ${
                                                        checked ? 'border-brand-300 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-700'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 text-brand-900 border-gray-300 rounded"
                                                        checked={checked}
                                                        onChange={(event) => {
                                                            setDuplicateSelection((prev) =>
                                                                event.target.checked
                                                                    ? [...prev, section.id]
                                                                    : prev.filter((id) => id !== section.id)
                                                            )
                                                        }}
                                                    />
                                                    {section.name}
                                                </label>
                                            )
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleDuplicateToSections}
                                            disabled={isDuplicating || duplicateSelection.length === 0}
                                            className="h-9 rounded-md bg-brand-900 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                                        >
                                            {isDuplicating
                                                ? (isFrench ? 'Duplication...' : 'Duplicating...')
                                                : (isFrench ? 'Dupliquer' : 'Duplicate')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowDuplicatePanel(false)
                                                setDuplicateSelection([])
                                            }}
                                            className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            {isFrench ? 'Annuler' : 'Cancel'}
                                        </button>
                                        <Link
                                            href={`/teacher/exams/new?duplicateFrom=${baseExamId}`}
                                            className="h-9 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center"
                                        >
                                            {isFrench ? 'Autre cours' : 'Other course'}
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!canEdit && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    {isFrench
                        ? 'Vous avez un acc\u00e8s en lecture seule pour cette section.'
                        : 'You have read-only access for this section.'}
                </div>
            )}

            {isLiveExam && (
                <div
                    ref={liveBannerRef}
                    className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm ${showStickyLiveBanner ? 'opacity-0 pointer-events-none' : ''}`}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                            {isFrench ? 'Examen en cours' : 'Live exam'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {renderLiveEditControls()}
                            {renderCancelLiveExamButton()}
                        </div>
                    </div>
                </div>
            )}

            {showStickyLiveBanner && isLiveExam && (
                <div
                    className="fixed top-4 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
                    style={stickyLiveWidth ? { width: `${stickyLiveWidth}px` } : undefined}
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900">
                            {isFrench ? 'Examen en cours' : 'Live exam'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {renderLiveEditControls()}
                            {renderCancelLiveExamButton()}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm relative">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex items-center gap-3 flex-wrap min-h-[48px]">
                        {editingTitle ? (
                            <div className="flex items-center gap-2 min-h-[42px]">
                                <input
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    autoFocus
                                    onBlur={handleSaveTitle}
                                    onFocus={(e) => {
                                        const val = e.target.value
                                        requestAnimationFrame(() => {
                                            e.target.selectionStart = val.length
                                            e.target.selectionEnd = val.length
                                        })
                                    }}
                                    className={`w-full max-w-[420px] border-0 border-b px-2 py-1 text-2xl font-semibold text-gray-900 bg-transparent focus:ring-0 focus:border-brand-900 ${validationDetails?.title ? 'border-red-500' : 'border-gray-300'}`}
                                    disabled={isLocked}
                                />
                                <button
                                    onClick={handleSaveTitle}
                                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                                    disabled={loading}
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingTitle(false)
                                        setTempTitle(exam.title)
                                    }}
                                    className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <h1
                                    className={`text-2xl font-semibold text-gray-900 ${!isLocked ? 'cursor-pointer hover:text-brand-900' : ''}`}
                                    onClick={() => {
                                        if (isLocked) return
                                        setEditingTitle(true)
                                    }}
                                >
                                    {liveExam.title}
                                </h1>
                                {!isLocked && (
                                    <button
                                        type="button"
                                        onClick={() => setEditingTitle(true)}
                                        className="p-1 text-gray-400 hover:text-gray-700"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        {!isExamStarted && !isDraft && <ExamStatusBadge label={statusLabel} className={statusClassName} />}
                    </div>

                    <div className="flex items-center gap-2">
                        {(isExamStarted || isExamEnded) && (
                            <ExamStatusBadge
                                label={statusLabel}
                                className={compactStatusClassName}
                            />
                        )}
                        {isDraft && (
                            pendingDelete ? (
                                <div className="inline-flex items-center gap-2" ref={deleteConfirmRef}>
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
                                        onClick={handleConfirmDelete}
                                    >
                                        {publishConfirmLabel}
                                    </button>
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                        onClick={() => setPendingDelete(false)}
                                    >
                                        {publishCancelLabel}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setPendingDelete(true)}
                                    title={isFrench ? 'Supprimer le brouillon' : 'Delete draft'}
                                    aria-label={isFrench ? 'Supprimer le brouillon' : 'Delete draft'}
                                    className="inline-flex items-center justify-center rounded-md border border-transparent p-2 text-gray-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">{isFrench ? 'Supprimer le brouillon' : 'Delete draft'}</span>
                                </button>
                            )
                        )}
                        {exam.status === 'PUBLISHED' && !isExamStarted && !isExamEnded ? (
                            <button
                                type="button"
                                onClick={() => setPendingUnpublish((prev) => !prev)}
                                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                                {unpublishLabel}
                            </button>
                        ) : exam.status !== 'PUBLISHED' ? (
                            <div className="relative flex items-center">
                                <button
                                    type="button"
                                    onClick={handlePublishClick}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : publishLabel}
                                </button>
                                {isDraft && (
                                    <div className="absolute right-0 top-full mt-2 pointer-events-none">
                                        <ExamStatusBadge
                                            label={statusLabel}
                                            className={compactStatusClassName}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>

                {pendingPublish && canPublish && (
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                            onClick={handleConfirmPublish}
                        >
                            {publishConfirmLabel}
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() => setPendingPublish(false)}
                        >
                            {publishCancelLabel}
                        </button>
                    </div>
                )}

                {pendingUnpublish && exam.status === 'PUBLISHED' && !isExamStarted && !isExamEnded && (
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                            onClick={handleConfirmUnpublish}
                        >
                            {publishConfirmLabel}
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() => setPendingUnpublish(false)}
                        >
                            {publishCancelLabel}
                        </button>
                    </div>
                )}


                <div className="grid md:grid-cols-2 gap-4">
                    {metaRows.map((row, index) => (
                        <div key={`${row.label}-${index}`} className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase text-gray-500">{row.label}</label>
                                {!isLocked && !row.locked && !row.editing && !row.clickToEdit && (
                                    <button
                                        type="button"
                                        onClick={() => row.setEditing(true)}
                                        className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                        {isFrench ? 'Modifier' : 'Edit'}
                                    </button>
                                )}
                            </div>
                            {row.editing && !row.locked ? (
                                row.renderEditor()
                            ) : (
                                <div
                                    onClick={() => {
                                        if (!row.clickToEdit || isLocked || row.locked) return
                                        row.setEditing(true)
                                    }}
                                    className={`text-sm text-gray-900 ${row.hasError ? 'text-red-700' : ''} ${row.clickToEdit && !isLocked && !row.locked ? 'cursor-pointer hover:text-brand-900' : ''} ${row.displayWidthClass ? `${row.displayWidthClass} inline-block` : ''}`}
                                >
                                    {row.value}
                                </div>
                            )}
                            {row.warning && (
                                <p className="text-xs text-red-600">{row.warning}</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-3 border-t border-gray-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={liveExam.requireHonorCommitment ?? false}
                            onChange={(e) => onToggleHonor(e.target.checked)}
                            disabled={loading || isLocked}
                            className="w-4 h-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                        />
                        <span className="text-sm text-gray-700">
                            {isFrench ? 'Demander une d\u00e9claration d\u2019honneur' : 'Require honor statement'}
                        </span>
                    </label>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-gray-500 block">
                            {isFrench ? 'Mentions pour l\u2019examen' : 'Exam notes'}
                        </label>
                        {editingAllowedMaterials ? (
                            <div className="flex items-start gap-2">
                                <textarea
                                    value={tempAllowedMaterials}
                                    onChange={(e) => {
                                        setTempAllowedMaterials(e.target.value)
                                        onLiveAllowedMaterials(e.target.value)
                                    }}
                                    autoFocus
                                    onFocus={(e) => {
                                        const val = e.target.value
                                        requestAnimationFrame(() => {
                                            e.target.selectionStart = val.length
                                            e.target.selectionEnd = val.length
                                        })
                                    }}
                                    onBlur={async () => {
                                        await onUpdateAllowedMaterials(tempAllowedMaterials)
                                        setEditingAllowedMaterials(false)
                                    }}
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:italic placeholder:text-gray-400 focus:border-brand-900 focus:ring-brand-900 resize-none"
                                    rows={1}
                                    disabled={loading || isLocked}
                                    placeholder={isFrench ? 'ex. R\u00e8gle, calculatrice, documents\u2026' : 'e.g. ruler, calculator, notes\u2026'}
                                />
                                <div className="flex items-start gap-1 pt-1">
                                    <button
                                        onClick={async () => {
                                            await onUpdateAllowedMaterials(tempAllowedMaterials)
                                            setEditingAllowedMaterials(false)
                                        }}
                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                        disabled={loading}
                                    >
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingAllowedMaterials(false)
                                            setTempAllowedMaterials(exam.allowedMaterials || '')
                                            onLiveAllowedMaterials(exam.allowedMaterials || '')
                                        }}
                                        className="p-1 text-gray-400 hover:bg-gray-50 rounded"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div
                                onClick={() => !isLocked && setEditingAllowedMaterials(true)}
                                className={`${!isLocked ? 'cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors' : ''}`}
                            >
                                {isNonEmpty(liveExam.allowedMaterials) ? (
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{liveExam.allowedMaterials}</p>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">
                                        {isFrench ? 'Cliquez pour ajouter des mentions\u2026' : 'Click to add notes\u2026'}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-gray-500 block">
                            {isFrench ? 'Envoi du corrig\u00e9 (facultatif et d\u00e9finissable plus tard)' : 'Correction release (optional, can be set later)'}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={correctionReleaseOnEnd}
                                onChange={(e) => handleCorrectionReleaseToggle(e.target.checked)}
                                disabled={correctionReleaseLocked}
                                className="w-4 h-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                            />
                            {isFrench ? 'Envoyer la correction \u00e0 la fin de l\u2019examen' : 'Release correction when the exam ends'}
                        </label>

                        {!correctionReleaseOnEnd && (
                            <div className="space-y-1">
                                {editingCorrectionRelease ? (
                                    <DateTimePicker
                                        date={tempCorrectionReleaseAt}
                                        onChange={(date) => {
                                            setTempCorrectionReleaseAt(date)
                                            setCorrectionReleaseWarning(resolveCorrectionReleaseErrorMessage(date))
                                        }}
                                        onBlur={handleCorrectionReleaseDateSave}
                                        locale={isFrench ? 'fr' : 'en'}
                                        placeholder={isFrench ? 'jj/mm/aaaa hh:mm' : 'dd/mm/yyyy hh:mm'}
                                        autoOpen
                                        className="w-60 max-w-full"
                                        inputClassName="text-sm font-medium"
                                        popperPlacement="top-start"
                                        popperClassName="z-40"
                                    />
                                ) : (
                                    <div
                                        onClick={() => {
                                            if (correctionReleaseLocked) return
                                            setEditingCorrectionRelease(true)
                                        }}
                                        className={`text-sm w-60 inline-block ${correctionReleaseAt ? 'text-gray-900' : 'text-gray-400 italic'} ${!correctionReleaseLocked ? 'cursor-pointer hover:text-brand-900' : ''}`}
                                    >
                                        {correctionReleaseAt
                                            ? correctionReleaseAt.toLocaleString(isFrench ? 'fr-FR' : 'en-US', {
                                                  dateStyle: 'short',
                                                  timeStyle: 'short',
                                              })
                                            : isFrench
                                                ? 'jj/mm/aaaa hh:mm'
                                                : 'dd/mm/yyyy hh:mm'}
                                    </div>
                                )}
                                {correctionReleaseErrorMessage && (
                                    <p className="text-xs text-red-600">
                                        {correctionReleaseErrorMessage}
                                    </p>
                                )}
                                {correctionReleaseAt && (
                                    <button
                                        type="button"
                                        onClick={handleClearCorrectionReleaseDate}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                        disabled={correctionReleaseLocked}
                                    >
                                        {isFrench ? 'Supprimer' : 'Clear'}
                                    </button>
                                )}
                            </div>
                        )}

                        {correctionInfo.canSendManually && !correctionInfo.isReleased && (
                            <div className="flex items-center gap-2">
                                {pendingCorrectionSend ? (
                                    <>
                                        <button
                                            type="button"
                                            className="inline-flex items-center justify-center rounded-md bg-brand-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                                            onClick={handleSendCorrectionNow}
                                        >
                                            {publishConfirmLabel}
                                        </button>
                                        <button
                                            type="button"
                                            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                            onClick={() => setPendingCorrectionSend(false)}
                                        >
                                            {publishCancelLabel}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-900 hover:bg-brand-100"
                                        onClick={() => setPendingCorrectionSend(true)}
                                    >
                                        {isFrench ? 'Envoyer la correction maintenant' : 'Send correction now'}
                                    </button>
                                )}
                            </div>
                        )}

                        {correctionReleaseLocked && (
                            <p className="text-xs text-gray-500">
                                {isFrench ? 'Correction d\u00e9j\u00e0 envoy\u00e9e.' : 'Correction already released.'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex justify-end">
                    <span className="text-xs text-gray-500">
                        {isFrench ? 'Enregistrement automatique' : 'Autosave enabled'}
                    </span>
                </div>

                {validationErrors.length > 0 && (
                    <div className="mt-2 p-4 bg-red-50 rounded border border-red-300">
                        <p className="font-semibold text-sm mb-2 text-red-900">{validationTitle}</p>
                        <ul className="list-disc list-inside text-sm space-y-1">
                            {validationErrors.map((err, i) => (
                                <li key={`${err}-${i}`} className="text-red-900">
                                    {err}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    )
}

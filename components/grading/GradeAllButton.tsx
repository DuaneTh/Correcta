'use client'

import { useState } from 'react'
import { Wand2, FileText, Loader2, RefreshCw } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { GradingProgressModal } from './GradingProgressModal'
import { RubricReviewModal } from './RubricReviewModal'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { Inline, Stack } from '@/components/ui/Layout'

interface RubricStatus {
    total: number
    generated: number
    allGenerated: boolean
}

interface GradingStatus {
    total: number
    graded: number
    allGraded: boolean
}

interface GradeAllButtonProps {
    examId: string
    rubricStatus?: RubricStatus
    gradingStatus?: GradingStatus
    onComplete?: () => void
    onPublishAfterGrading?: () => void
    disabled?: boolean
}

export function GradeAllButton({
    examId,
    rubricStatus,
    gradingStatus,
    onComplete,
    onPublishAfterGrading,
    disabled
}: GradeAllButtonProps) {
    const [loading, setLoading] = useState(false)
    const [showRubricReview, setShowRubricReview] = useState(false)
    const [showProgress, setShowProgress] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [publishAfterGrading, setPublishAfterGrading] = useState(false)
    const [syncGradingInProgress, setSyncGradingInProgress] = useState(false)
    const [activeAction, setActiveAction] = useState<'rubric' | 'grading' | null>(null)

    // Determine button states
    const hasRubrics = rubricStatus?.allGenerated ?? false
    const hasAnyRubric = (rubricStatus?.generated ?? 0) > 0
    const hasGradedAttempts = (gradingStatus?.graded ?? 0) > 0
    const noTextQuestions = (rubricStatus?.total ?? 0) === 0

    // Button labels
    const rubricButtonLabel = hasAnyRubric ? 'Régénérer le barème' : 'Générer le barème'
    const gradingButtonLabel = hasGradedAttempts ? 'Recorriger les copies' : 'Corriger les copies'

    // Can only grade if rubrics are generated (or no TEXT questions)
    const canGrade = hasRubrics || noTextQuestions

    // Step 1: Open rubric review modal for rubric generation
    const handleRubricClick = () => {
        setError(null)
        setActiveAction('rubric')
        setShowRubricReview(true)
    }

    // Direct grading (skip rubric review if already generated)
    const handleGradingClick = () => {
        setError(null)
        setActiveAction('grading')
        if (hasRubrics || noTextQuestions) {
            // Rubrics already exist, go directly to grading
            handleStartGrading()
        } else {
            // Show rubric review first
            setShowRubricReview(true)
        }
    }

    // Step 2: On confirm from rubric review, save rubrics and optionally start grading
    const handleRubricConfirm = async () => {
        setShowRubricReview(false)

        if (activeAction === 'rubric') {
            // Just rubric generation - refresh to show updated state
            onComplete?.()
            setActiveAction(null)
        } else {
            // Continue to grading
            await handleStartGrading()
        }
    }

    const handleStartGrading = async () => {
        setLoading(true)
        setError(null)

        try {
            const csrfToken = await getCsrfToken()

            // First try queue-based grading
            const res = await fetch(`/api/exams/${examId}/grade-all`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            if (!res.ok) {
                const data = await res.json()

                // If queue not available, fall back to synchronous grading
                if (data.error === 'QUEUE_NOT_AVAILABLE') {
                    console.log('[Grade All] Queue not available, using synchronous grading')
                    await handleSyncGrading(csrfToken)
                    return
                }
                throw new Error('Erreur lors du lancement de la correction')
            }

            const data = await res.json()
            console.log('[Grade All] Enqueued:', data)

            // If jobs were enqueued, show progress modal
            if (data.enqueuedCount > 0) {
                setShowProgress(true)
            } else {
                // No jobs to enqueue - all answers already graded
                setError('Toutes les copies sont déjà corrigées')
                onComplete?.()
            }
        } catch (err) {
            console.error('[Grade All] Error:', err)
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setLoading(false)
            setActiveAction(null)
        }
    }

    // Synchronous grading fallback (no Redis/worker required)
    const handleSyncGrading = async (csrfToken: string) => {
        try {
            setSyncGradingInProgress(true)

            const res = await fetch(`/api/exams/${examId}/grade-sync`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Erreur lors de la correction')
            }

            const data = await res.json()
            console.log('[Grade All] Sync grading complete:', data)

            if (data.gradedCount === 0 && data.totalAnswers === 0) {
                setError('Toutes les copies sont déjà corrigées')
            } else {
                // Grading complete - trigger completion callback
                onComplete?.()
                if (publishAfterGrading && onPublishAfterGrading) {
                    onPublishAfterGrading()
                }
                setPublishAfterGrading(false)
            }
        } catch (err) {
            console.error('[Grade All] Sync grading error:', err)
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setLoading(false)
            setSyncGradingInProgress(false)
            setActiveAction(null)
        }
    }

    const handleRubricClose = () => {
        setShowRubricReview(false)
        setActiveAction(null)
    }

    const handleProgressComplete = () => {
        setShowProgress(false)
        onComplete?.()

        // If publish after grading was checked, trigger publish
        if (publishAfterGrading && onPublishAfterGrading) {
            onPublishAfterGrading()
        }
        // Reset for next time
        setPublishAfterGrading(false)
    }

    const handleProgressClose = () => {
        setShowProgress(false)
    }

    // If no TEXT questions, show a simpler single button
    if (noTextQuestions) {
        return (
            <>
                <Stack gap="xs">
                    <Button
                        variant="primary"
                        onClick={handleGradingClick}
                        disabled={loading || disabled}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Wand2 className="w-4 h-4" />
                        {loading ? 'Chargement...' : gradingButtonLabel}
                    </Button>
                    {error && (
                        <Text variant="muted" className="text-red-600 whitespace-nowrap">
                            {error}
                        </Text>
                    )}
                </Stack>

                <GradingProgressModal
                    examId={examId}
                    isOpen={showProgress}
                    onClose={handleProgressClose}
                    onComplete={handleProgressComplete}
                    publishAfterGrading={publishAfterGrading}
                    onPublishAfterGradingChange={setPublishAfterGrading}
                />

                {syncGradingInProgress && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Correction en cours...
                                </h2>
                                <p className="text-sm text-gray-600 text-center">
                                    Veuillez patienter, la correction de toutes les copies est en cours.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    return (
        <>
            <Inline gap="sm" align="center">
                {/* Rubric generation button */}
                <Button
                    variant={hasAnyRubric ? "secondary" : "primary"}
                    onClick={handleRubricClick}
                    disabled={loading || disabled}
                    className={hasAnyRubric ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' : ''}
                >
                    {hasAnyRubric ? (
                        <RefreshCw className="w-4 h-4" />
                    ) : (
                        <FileText className="w-4 h-4" />
                    )}
                    {loading && activeAction === 'rubric' ? 'Chargement...' : rubricButtonLabel}
                </Button>

                {/* Grading button */}
                <Button
                    variant={hasGradedAttempts ? "secondary" : "primary"}
                    onClick={handleGradingClick}
                    disabled={loading || disabled || !canGrade}
                    title={!canGrade ? 'Le barème doit être généré avant de corriger' : undefined}
                    className={hasGradedAttempts ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200' : 'bg-green-600 hover:bg-green-700'}
                >
                    {hasGradedAttempts ? (
                        <RefreshCw className="w-4 h-4" />
                    ) : (
                        <Wand2 className="w-4 h-4" />
                    )}
                    {loading && activeAction === 'grading' ? 'Chargement...' : gradingButtonLabel}
                </Button>

                {/* Error display */}
                {error && (
                    <Text variant="muted" className="text-red-600 whitespace-nowrap">
                        {error}
                    </Text>
                )}
            </Inline>

            {/* Step 1: Rubric review modal */}
            <RubricReviewModal
                examId={examId}
                isOpen={showRubricReview}
                onClose={handleRubricClose}
                onConfirm={handleRubricConfirm}
                rubricOnly={activeAction === 'rubric'}
            />

            {/* Step 2: Progress modal (for queue-based grading) */}
            <GradingProgressModal
                examId={examId}
                isOpen={showProgress}
                onClose={handleProgressClose}
                onComplete={handleProgressComplete}
                publishAfterGrading={publishAfterGrading}
                onPublishAfterGradingChange={setPublishAfterGrading}
            />

            {/* Sync grading overlay (when queue not available) */}
            {syncGradingInProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                        <div className="flex flex-col items-center gap-4">
                            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                            <h2 className="text-xl font-semibold text-gray-900">
                                Correction en cours...
                            </h2>
                            <p className="text-sm text-gray-600 text-center">
                                Veuillez patienter, la correction de toutes les copies est en cours.
                                Cette opération peut prendre quelques instants.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

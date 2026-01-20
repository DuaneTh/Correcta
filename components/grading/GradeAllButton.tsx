'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { GradingProgressModal } from './GradingProgressModal'
import { RubricReviewModal } from './RubricReviewModal'

interface GradeAllButtonProps {
    examId: string
    onComplete?: () => void
    onPublishAfterGrading?: () => void
}

export function GradeAllButton({ examId, onComplete, onPublishAfterGrading }: GradeAllButtonProps) {
    const [loading, setLoading] = useState(false)
    const [showRubricReview, setShowRubricReview] = useState(false)
    const [showProgress, setShowProgress] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [publishAfterGrading, setPublishAfterGrading] = useState(false)

    // Step 1: Open rubric review modal
    const handleClick = () => {
        setError(null)
        setShowRubricReview(true)
    }

    // Step 2: On confirm from rubric review, start grading
    const handleRubricConfirm = async () => {
        setShowRubricReview(false)
        setLoading(true)
        setError(null)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/grade-all`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            if (!res.ok) {
                const data = await res.json()
                if (data.error === 'QUEUE_NOT_AVAILABLE') {
                    throw new Error('Le service de correction IA n\'est pas disponible')
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
                setError('Toutes les copies sont deja corrigees')
            }
        } catch (err) {
            console.error('[Grade All] Error:', err)
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setLoading(false)
        }
    }

    const handleRubricClose = () => {
        setShowRubricReview(false)
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

    return (
        <>
            <div className="relative">
                <button
                    onClick={handleClick}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    <Wand2 className="w-4 h-4" />
                    {loading ? 'Chargement...' : 'Corriger toutes les copies'}
                </button>

                {error && (
                    <p className="absolute top-full left-0 mt-1 text-sm text-red-600">
                        {error}
                    </p>
                )}
            </div>

            {/* Step 1: Rubric review modal */}
            <RubricReviewModal
                examId={examId}
                isOpen={showRubricReview}
                onClose={handleRubricClose}
                onConfirm={handleRubricConfirm}
            />

            {/* Step 2: Progress modal */}
            <GradingProgressModal
                examId={examId}
                isOpen={showProgress}
                onClose={handleProgressClose}
                onComplete={handleProgressComplete}
                publishAfterGrading={publishAfterGrading}
                onPublishAfterGradingChange={setPublishAfterGrading}
            />
        </>
    )
}

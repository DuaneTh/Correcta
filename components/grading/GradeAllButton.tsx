'use client'

import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { GradingProgressModal } from './GradingProgressModal'

interface GradeAllButtonProps {
    examId: string
    onComplete?: () => void
}

export function GradeAllButton({ examId, onComplete }: GradeAllButtonProps) {
    const [loading, setLoading] = useState(false)
    const [showProgress, setShowProgress] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleClick = async () => {
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

    const handleProgressComplete = () => {
        setShowProgress(false)
        onComplete?.()
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

            <GradingProgressModal
                examId={examId}
                isOpen={showProgress}
                onClose={handleProgressClose}
                onComplete={handleProgressComplete}
            />
        </>
    )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, Loader2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'

interface GradingProgressModalProps {
    examId: string
    isOpen: boolean
    onClose: () => void
    onComplete: () => void
    publishAfterGrading?: boolean
    onPublishAfterGradingChange?: (value: boolean) => void
}

interface ProgressData {
    completed: number
    total: number
    percentage: number
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
    canCancel: boolean
}

export function GradingProgressModal({
    examId,
    isOpen,
    onClose,
    onComplete,
    publishAfterGrading,
    onPublishAfterGradingChange
}: GradingProgressModalProps) {
    const [progress, setProgress] = useState<ProgressData | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)
    const [isSwitchingToSync, setIsSwitchingToSync] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isStuck, setIsStuck] = useState(false)
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const lastCompletedRef = useRef<number>(0)
    const stuckCheckCountRef = useRef<number>(0)

    const fetchProgress = useCallback(async () => {
        try {
            const res = await fetch(`/api/exams/${examId}/grading-progress`)
            if (!res.ok) {
                throw new Error('Failed to fetch progress')
            }
            const data: ProgressData = await res.json()
            setProgress(data)

            // Auto-close when complete
            if (data.status === 'COMPLETED') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current)
                    pollIntervalRef.current = null
                }
                setIsStuck(false)
                // Small delay before closing to show completion state
                setTimeout(() => {
                    onComplete()
                    onClose()
                }, 1500)
            } else if (data.status === 'IN_PROGRESS') {
                // Check if progress is stuck (no change after several polls)
                if (data.completed === lastCompletedRef.current) {
                    stuckCheckCountRef.current++
                    // After 15 polls (30 seconds with 2s interval) with no progress, consider stuck
                    if (stuckCheckCountRef.current >= 15) {
                        setIsStuck(true)
                    }
                } else {
                    // Progress was made, reset stuck counter
                    lastCompletedRef.current = data.completed
                    stuckCheckCountRef.current = 0
                    setIsStuck(false)
                }
            }
        } catch (err) {
            console.error('Error fetching progress:', err)
            setError('Erreur lors de la recuperation du statut')
        }
    }, [examId, onComplete, onClose])

    // Start polling when modal opens
    useEffect(() => {
        if (isOpen) {
            // Reset state
            lastCompletedRef.current = 0
            stuckCheckCountRef.current = 0
            setIsStuck(false)
            setError(null)

            fetchProgress() // Initial fetch
            pollIntervalRef.current = setInterval(fetchProgress, 2000)
        }

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }
        }
    }, [isOpen, fetchProgress])

    // Switch to synchronous grading when queue is stuck
    const handleSwitchToSync = async () => {
        setIsSwitchingToSync(true)
        setError(null)

        try {
            const csrfToken = await getCsrfToken()

            // First reset stuck attempts
            await fetch(`/api/exams/${examId}/reset-grading`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            // Then run synchronous grading
            const res = await fetch(`/api/exams/${examId}/grade-sync`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Erreur lors de la correction')
            }

            const data = await res.json()
            console.log('[Grading] Sync grading complete:', data)

            // Stop polling and trigger completion
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }

            setIsStuck(false)
            onComplete()
            onClose()
        } catch (err) {
            console.error('[Grading] Switch to sync error:', err)
            setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        } finally {
            setIsSwitchingToSync(false)
        }
    }

    const handleCancel = async () => {
        setIsCancelling(true)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/grading-progress`, {
                method: 'DELETE',
                headers: { 'x-csrf-token': csrfToken }
            })

            if (!res.ok) {
                throw new Error('Failed to cancel grading')
            }

            // Stop polling and close
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
            }
            onComplete() // Refresh the list
            onClose()
        } catch (err) {
            console.error('Error cancelling grading:', err)
            setError('Erreur lors de l\'annulation')
        } finally {
            setIsCancelling(false)
        }
    }

    const handleClose = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
        }
        onClose()
    }

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    if (!isOpen) return null

    const isComplete = progress?.status === 'COMPLETED'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    {isComplete ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    ) : (
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    )}
                    <h2 className="text-xl font-semibold text-gray-900">
                        {isComplete ? 'Correction terminee' : 'Correction en cours...'}
                    </h2>
                </div>

                {/* Progress content */}
                {error ? (
                    <div className="text-red-600 text-sm mb-4">{error}</div>
                ) : progress ? (
                    <div className="space-y-4">
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                    isComplete ? 'bg-green-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${progress.percentage}%` }}
                            />
                        </div>

                        {/* Progress text */}
                        <p className="text-center text-gray-700 font-medium">
                            {progress.completed} / {progress.total} {progress.total > 1 ? 'copies corrigees' : 'copie corrigee'}
                        </p>

                        {/* Percentage */}
                        <p className="text-center text-2xl font-bold text-gray-900">
                            {progress.percentage}%
                        </p>

                        {/* Stuck warning */}
                        {isStuck && !isComplete && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-sm text-amber-800 font-medium">
                                    La correction semble bloquee
                                </p>
                                <p className="text-xs text-amber-600 mt-1">
                                    Le service de correction en arriere-plan ne repond pas.
                                </p>
                                <button
                                    onClick={handleSwitchToSync}
                                    disabled={isSwitchingToSync}
                                    className="mt-2 w-full px-3 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                                >
                                    {isSwitchingToSync ? 'Correction en cours...' : 'Corriger directement (sans file d\'attente)'}
                                </button>
                            </div>
                        )}

                        {/* Publish option checkbox */}
                        {onPublishAfterGradingChange && (
                            <div className="pt-2 border-t border-gray-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={publishAfterGrading || false}
                                        onChange={(e) => onPublishAfterGradingChange(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        disabled={isComplete}
                                    />
                                    <span className="text-sm text-gray-700">
                                        Publier les notes immediatement apres correction
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-7">
                                    Les etudiants pourront voir leurs notes des la fin de la correction.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                    </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex justify-end gap-3">
                    {progress?.canCancel && !isComplete && (
                        <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                        >
                            {isCancelling ? 'Annulation...' : 'Annuler'}
                        </button>
                    )}
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        {isComplete ? 'Fermer' : 'Laisser en arriere-plan'}
                    </button>
                </div>
            </div>
        </div>
    )
}

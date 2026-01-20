'use client'

import { useState } from 'react'
import { RotateCcw, Loader2 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface ReGradeButtonProps {
    attemptId: string
    answerId: string
    hasHumanOverride: boolean
    onSuccess: () => void
}

export default function ReGradeButton({
    attemptId,
    answerId,
    hasHumanOverride,
    onSuccess,
}: ReGradeButtonProps) {
    const [loading, setLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const handleReGrade = async () => {
        setLoading(true)
        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/attempts/${attemptId}/grading/enqueue-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken,
                },
                body: JSON.stringify({ answerId }),
            })

            if (res.ok) {
                onSuccess()
            } else {
                const data = await res.json()
                console.error('Re-grade failed:', data.message || 'Unknown error')
            }
        } catch (error) {
            console.error('Re-grade error:', error)
        } finally {
            setLoading(false)
            setShowConfirm(false)
        }
    }

    const handleClick = () => {
        if (hasHumanOverride) {
            setShowConfirm(true)
        } else {
            handleReGrade()
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                )}
                Recorriger (IA)
            </button>

            <ConfirmModal
                open={showConfirm}
                title="Recorriger avec l'IA"
                description="Cette reponse a ete modifiee manuellement. Voulez-vous vraiment relancer la correction IA? La note actuelle sera remplacee."
                confirmLabel="Recorriger"
                cancelLabel="Annuler"
                onConfirm={handleReGrade}
                onCancel={() => setShowConfirm(false)}
            />
        </>
    )
}

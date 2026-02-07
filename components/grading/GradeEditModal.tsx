'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import MathRenderer from '@/components/exams/MathRenderer'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Form'
import { Text } from '@/components/ui/Text'
import { Stack, Surface } from '@/components/ui/Layout'

interface GradeEditModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (score: number, feedback: string) => void
    questionContent: string
    studentAnswer: string
    maxPoints: number
    currentScore: number
    currentFeedback: string
    aiRationale?: string
    isAiGrade: boolean
}

const getFocusable = (container: HTMLElement | null): HTMLElement[] => {
    if (!container) return []
    const selectors = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ]
    return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')))
}

export default function GradeEditModal({
    isOpen,
    onClose,
    onSave,
    questionContent,
    studentAnswer,
    maxPoints,
    currentScore,
    currentFeedback,
    aiRationale,
    isAiGrade,
}: GradeEditModalProps) {
    const [score, setScore] = useState(currentScore)
    const [feedback, setFeedback] = useState(currentFeedback)
    const [contextExpanded, setContextExpanded] = useState(true)

    const panelRef = useRef<HTMLDivElement | null>(null)
    const closeButtonRef = useRef<HTMLButtonElement | null>(null)

    // Reset form when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            setScore(currentScore)
            setFeedback(currentFeedback)
            closeButtonRef.current?.focus()
        }
    }, [isOpen, currentScore, currentFeedback])

    // Handle escape key and body scroll lock
    useEffect(() => {
        if (!isOpen) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
            }
        }
        document.addEventListener('keydown', handleKey)

        return () => {
            document.removeEventListener('keydown', handleKey)
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen, onClose])

    // Focus trap
    const handleTrap = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Tab') return
        const focusable = getFocusable(panelRef.current)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
        }
    }

    const handleSave = () => {
        onSave(score, feedback)
    }

    const handleScoreChange = (value: string) => {
        const numValue = parseFloat(value)
        if (!isNaN(numValue)) {
            // Clamp to valid range
            setScore(Math.min(Math.max(0, numValue), maxPoints))
        } else if (value === '') {
            setScore(0)
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Modifier la note"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={handleTrap}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <Text as="h2" variant="sectionTitle">Modifier la note</Text>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        aria-label="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* AI Grade Warning */}
                    {isAiGrade && (
                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <Text variant="caption" className="text-blue-800">
                                Note generee par IA - sera marquee comme modifiee par le professeur
                            </Text>
                        </div>
                    )}

                    {/* Context Section (Collapsible) */}
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setContextExpanded(!contextExpanded)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                            aria-expanded={contextExpanded}
                        >
                            <Text variant="label">Contexte</Text>
                            {contextExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                        </button>

                        {contextExpanded && (
                            <Stack gap="md" className="p-4 border-t border-gray-200">
                                {/* Question Content */}
                                <div>
                                    <Text variant="overline" className="mb-2">Question</Text>
                                    <Surface tone="subtle" className="p-3">
                                        <MathRenderer text={questionContent} />
                                    </Surface>
                                </div>

                                {/* Student Answer */}
                                <div>
                                    <Text variant="overline" className="mb-2">Reponse de l&apos;etudiant</Text>
                                    <div className="text-gray-800 bg-blue-50 p-3 rounded-md border border-blue-100">
                                        {studentAnswer ? (
                                            <MathRenderer text={studentAnswer} />
                                        ) : (
                                            <Text variant="caption" className="italic">Aucune reponse fournie</Text>
                                        )}
                                    </div>
                                </div>

                                {/* AI Rationale */}
                                {aiRationale && (
                                    <div>
                                        <Text variant="overline" className="mb-2">
                                            <span className="inline-flex items-center gap-1">
                                                <Sparkles className="w-3 h-3" />
                                                Raisonnement IA
                                            </span>
                                        </Text>
                                        <Surface tone="subtle" className="p-3">
                                            <Text variant="caption">
                                                <MathRenderer text={aiRationale} />
                                            </Text>
                                        </Surface>
                                    </div>
                                )}
                            </Stack>
                        )}
                    </div>

                    {/* Edit Section */}
                    <Stack gap="md">
                        {/* Score Input */}
                        <div>
                            <Text as="label" variant="label" htmlFor="grade-score" className="mb-1">
                                Score (0 - {maxPoints})
                            </Text>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="grade-score"
                                    type="number"
                                    min="0"
                                    max={maxPoints}
                                    step="0.5"
                                    value={score}
                                    onChange={(e) => handleScoreChange(e.target.value)}
                                    className="w-32"
                                />
                                <Text variant="caption">/ {maxPoints}</Text>
                            </div>
                        </div>

                        {/* Feedback Textarea */}
                        <div>
                            <Text as="label" variant="label" htmlFor="grade-feedback" className="mb-1">
                                Commentaire pour l&apos;etudiant
                            </Text>
                            <Textarea
                                id="grade-feedback"
                                rows={4}
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Commentaire pour l'etudiant..."
                            />
                            <Text variant="xsMuted" className="mt-1">
                                Ce commentaire sera visible par l&apos;etudiant apres publication
                            </Text>
                        </div>
                    </Stack>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="secondary"
                    >
                        Annuler
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        variant="primary"
                    >
                        Enregistrer
                    </Button>
                </div>
            </div>
        </div>
    )
}

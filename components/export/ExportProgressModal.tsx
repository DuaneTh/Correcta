'use client'

import { useState, useEffect } from 'react'
import { X, Download, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Stack } from '@/components/ui/Layout'

interface ExportProgressModalProps {
    examId: string
    jobId: string
    onClose: () => void
}

type ExportStatus = 'queued' | 'active' | 'completed' | 'failed'

interface StatusResponse {
    status: ExportStatus
    progress?: number
    phase?: string
    result?: {
        filename: string
        size: number
        attemptCount: number
        downloadUrl: string
    }
    error?: string
}

export function ExportProgressModal({ examId, jobId, onClose }: ExportProgressModalProps) {
    const [status, setStatus] = useState<StatusResponse>({ status: 'queued', progress: 0 })
    const [polling, setPolling] = useState(true)

    useEffect(() => {
        if (!polling) return

        const pollStatus = async () => {
            try {
                const res = await fetch(`/api/exams/${examId}/export/status?jobId=${jobId}`)
                if (res.ok) {
                    const data: StatusResponse = await res.json()
                    setStatus(data)

                    if (data.status === 'completed' || data.status === 'failed') {
                        setPolling(false)
                    }
                }
            } catch (error) {
                console.error('Error polling export status:', error)
            }
        }

        pollStatus()
        const interval = setInterval(pollStatus, 1000)

        return () => clearInterval(interval)
    }, [examId, jobId, polling])

    const getPhaseLabel = (phase?: string) => {
        switch (phase) {
            case 'loading': return 'Chargement des donnees...'
            case 'processing': return 'Traitement des copies...'
            case 'generating': return 'Generation du PDF...'
            case 'saving': return 'Enregistrement...'
            case 'complete': return 'Termine !'
            default: return 'En attente...'
        }
    }

    const handleDownload = () => {
        if (status.result?.downloadUrl) {
            window.location.href = status.result.downloadUrl
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={status.status === 'completed' || status.status === 'failed' ? onClose : undefined}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                {/* Close button only when done */}
                {(status.status === 'completed' || status.status === 'failed') && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                <Stack gap="md" className="text-center">
                    {/* Icon */}
                    <div>
                        {status.status === 'completed' ? (
                            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                        ) : status.status === 'failed' ? (
                            <XCircle className="w-12 h-12 mx-auto text-red-500" />
                        ) : (
                            <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
                        )}
                    </div>

                    {/* Title */}
                    <Text as="h3" variant="sectionTitle">
                        {status.status === 'completed'
                            ? 'Export termine'
                            : status.status === 'failed'
                                ? 'Erreur d\'export'
                                : 'Export en cours...'}
                    </Text>

                    {/* Phase label */}
                    <Text variant="caption">
                        {status.status === 'failed'
                            ? status.error || 'Une erreur est survenue'
                            : getPhaseLabel(status.phase)}
                    </Text>

                    {/* Progress bar */}
                    {status.status !== 'completed' && status.status !== 'failed' && (
                        <div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${status.progress || 0}%` }}
                                />
                            </div>
                            <Text variant="xsMuted" className="mt-1">{status.progress || 0}%</Text>
                        </div>
                    )}

                    {/* Result info */}
                    {status.status === 'completed' && status.result && (
                        <Stack gap="xs">
                            <Text variant="caption">{status.result.attemptCount} copies exportees</Text>
                            <Text variant="caption">Taille: {(status.result.size / 1024).toFixed(1)} Ko</Text>
                        </Stack>
                    )}

                    {/* Actions */}
                    <div className="flex justify-center gap-3">
                        {status.status === 'completed' && (
                            <Button
                                onClick={handleDownload}
                                variant="primary"
                            >
                                <Download className="w-4 h-4" />
                                Telecharger
                            </Button>
                        )}
                        {(status.status === 'completed' || status.status === 'failed') && (
                            <Button
                                onClick={onClose}
                                variant="secondary"
                            >
                                Fermer
                            </Button>
                        )}
                    </div>
                </Stack>
            </div>
        </div>
    )
}

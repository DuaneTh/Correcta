'use client'

import { useState, useEffect } from 'react'
import { X, Download, Loader2, CheckCircle, XCircle } from 'lucide-react'

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

                <div className="text-center">
                    {/* Icon */}
                    <div className="mb-4">
                        {status.status === 'completed' ? (
                            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                        ) : status.status === 'failed' ? (
                            <XCircle className="w-12 h-12 mx-auto text-red-500" />
                        ) : (
                            <Loader2 className="w-12 h-12 mx-auto text-indigo-600 animate-spin" />
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {status.status === 'completed'
                            ? 'Export termine'
                            : status.status === 'failed'
                                ? 'Erreur d\'export'
                                : 'Export en cours...'}
                    </h3>

                    {/* Phase label */}
                    <p className="text-sm text-gray-600 mb-4">
                        {status.status === 'failed'
                            ? status.error || 'Une erreur est survenue'
                            : getPhaseLabel(status.phase)}
                    </p>

                    {/* Progress bar */}
                    {status.status !== 'completed' && status.status !== 'failed' && (
                        <div className="mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${status.progress || 0}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{status.progress || 0}%</p>
                        </div>
                    )}

                    {/* Result info */}
                    {status.status === 'completed' && status.result && (
                        <div className="mb-4 text-sm text-gray-600">
                            <p>{status.result.attemptCount} copies exportees</p>
                            <p>Taille: {(status.result.size / 1024).toFixed(1)} Ko</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-center gap-3 mt-6">
                        {status.status === 'completed' && (
                            <button
                                onClick={handleDownload}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Telecharger
                            </button>
                        )}
                        {(status.status === 'completed' || status.status === 'failed') && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                                Fermer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { getCsrfToken } from '@/lib/csrfClient'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/components/ui/cn'

type PDFImportUploaderProps = {
    courseId: string
    onCancel?: () => void
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed'

type UploadResponse = {
    jobId: string
}

type StatusResponse = {
    status: 'waiting' | 'processing' | 'completed' | 'failed'
    examId?: string
    error?: string
    warnings?: string[]
}

export default function PDFImportUploader({ courseId, onCancel }: PDFImportUploaderProps) {
    const router = useRouter()
    const [status, setStatus] = useState<UploadStatus>('idle')
    const [error, setError] = useState<string | null>(null)
    const [progress, setProgress] = useState<string>('')
    const [warnings, setWarnings] = useState<string[]>([])
    const [jobId, setJobId] = useState<string | null>(null)

    const onDrop = async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return

        const file = acceptedFiles[0]
        setStatus('uploading')
        setProgress('Téléversement du PDF...')
        setError(null)

        try {
            // Get CSRF token
            const csrfToken = await getCsrfToken()

            // Create FormData
            const formData = new FormData()
            formData.append('file', file)
            formData.append('courseId', courseId)

            // Upload
            const uploadRes = await fetch('/api/exam-import/upload', {
                method: 'POST',
                headers: {
                    'x-csrf-token': csrfToken
                },
                body: formData
            })

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json().catch(() => ({}))
                throw new Error(errorData.error || 'Échec du téléversement')
            }

            const uploadData: UploadResponse = await uploadRes.json()
            setJobId(uploadData.jobId)
            setStatus('processing')
            setProgress('Analyse IA en cours... Cela peut prendre 10-30 secondes')
        } catch (err) {
            setStatus('failed')
            setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
    }

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        maxSize: 32 * 1024 * 1024,
        disabled: status !== 'idle',
        onDropRejected: (fileRejections) => {
            const rejection = fileRejections[0]
            if (rejection.errors.some(e => e.code === 'file-too-large')) {
                setError('Le fichier est trop volumineux. Maximum 32 Mo.')
            } else if (rejection.errors.some(e => e.code === 'file-invalid-type')) {
                setError('Type de fichier invalide. Seuls les PDF sont acceptés.')
            } else {
                setError('Fichier rejeté')
            }
        }
    })

    // Polling effect
    useEffect(() => {
        if (status !== 'processing' || !jobId) return

        let timeoutId: NodeJS.Timeout

        const poll = async () => {
            try {
                const statusRes = await fetch(`/api/exam-import/status/${jobId}`)

                if (!statusRes.ok) {
                    throw new Error('Échec de la vérification du statut')
                }

                const statusData: StatusResponse = await statusRes.json()

                if (statusData.status === 'completed' && statusData.examId) {
                    setStatus('completed')
                    setProgress('Import réussi! Redirection vers l\'éditeur...')

                    if (statusData.warnings && statusData.warnings.length > 0) {
                        setWarnings(statusData.warnings)
                    }

                    // Redirect after a brief delay
                    setTimeout(() => {
                        router.push(`/dashboard/exams/${statusData.examId}/builder`)
                    }, 500)
                } else if (statusData.status === 'failed') {
                    setStatus('failed')
                    setError(statusData.error || 'L\'extraction a échoué')
                } else {
                    // Still processing, poll again
                    timeoutId = setTimeout(poll, 2000)
                }
            } catch (err) {
                setStatus('failed')
                setError(err instanceof Error ? err.message : 'Erreur de communication')
            }
        }

        // Start polling
        poll()

        // Cleanup
        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [status, jobId, router])

    const handleRetry = () => {
        setStatus('idle')
        setError(null)
        setProgress('')
        setWarnings([])
        setJobId(null)
    }

    return (
        <div className="space-y-4">
            {status === 'idle' && (
                <Card
                    {...getRootProps()}
                    className={cn(
                        'border-2 border-dashed transition-colors cursor-pointer',
                        isDragActive
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-300 hover:border-gray-400'
                    )}
                >
                    <input {...getInputProps()} />
                    <CardBody className="py-12 text-center space-y-3" padding="lg">
                        <div className="flex justify-center">
                            <svg
                                className="w-12 h-12 text-gray-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                />
                            </svg>
                        </div>
                        <div className="space-y-1">
                            <Text variant="sectionTitle">
                                {isDragActive ? 'Déposez le fichier PDF ici' : 'Importer un examen existant'}
                            </Text>
                            {!isDragActive && (
                                <Text variant="muted">Glissez-déposez un PDF ou cliquez pour sélectionner</Text>
                            )}
                        </div>
                        <Text variant="caption">Maximum 32 Mo</Text>
                    </CardBody>
                </Card>
            )}

            {(status === 'uploading' || status === 'processing') && (
                <Card>
                    <CardBody className="py-8 text-center space-y-4" padding="lg">
                        <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-900" />
                        </div>
                        <div className="space-y-2">
                            <Text variant="sectionTitle">{progress}</Text>
                            {status === 'processing' && (
                                <Text variant="muted">
                                    L&apos;IA analyse votre document. Veuillez patienter...
                                </Text>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}

            {status === 'completed' && (
                <Card className="border-emerald-200 bg-emerald-50">
                    <CardBody className="py-6 text-center space-y-3" padding="lg">
                        <div className="flex justify-center">
                            <svg
                                className="w-12 h-12 text-emerald-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        </div>
                        <Text variant="sectionTitle" className="text-emerald-900">
                            {progress}
                        </Text>
                        {warnings.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <Text variant="muted" className="text-emerald-800">
                                    Avertissements:
                                </Text>
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {warnings.map((warning, idx) => (
                                        <Badge key={idx} variant="warning">
                                            {warning}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            {status === 'failed' && (
                <Card className="border-red-200 bg-red-50">
                    <CardBody className="py-6 space-y-4" padding="lg">
                        <div className="text-center space-y-3">
                            <div className="flex justify-center">
                                <svg
                                    className="w-12 h-12 text-red-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </div>
                            <Text variant="sectionTitle" className="text-red-900">
                                Échec de l&apos;import
                            </Text>
                            {error && (
                                <Text variant="muted" className="text-red-800">
                                    {error}
                                </Text>
                            )}
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button variant="primary" onClick={handleRetry}>
                                Réessayer
                            </Button>
                            {onCancel && (
                                <Button variant="secondary" onClick={onCancel}>
                                    Annuler
                                </Button>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}

            {status === 'idle' && error && (
                <Card className="border-red-200 bg-red-50">
                    <CardBody padding="md">
                        <Text variant="muted" className="text-red-800">
                            {error}
                        </Text>
                    </CardBody>
                </Card>
            )}
        </div>
    )
}

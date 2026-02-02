"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Surface, Stack, Grid, Inline } from "@/components/ui/Layout"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Text } from "@/components/ui/Text"

interface ProctorEvent {
    id: string
    type: string
    timestamp: string
    metadata: Record<string, unknown> | null
}

interface AttemptData {
    id: string
    startedAt: string
    submittedAt: string | null
    status: string
    student: {
        id: string
        name: string | null
        email: string
    }
    exam: {
        id: string
        title: string
        course: {
            code: string
            name: string
        }
    }
    proctorEvents: ProctorEvent[]
    focusLossPattern: {
        flag: string
        ratio: number
        suspiciousPairs: number
        totalAnswers: number
    }
    externalPastes: number
    internalPastes: number
    antiCheatScore: number
}

interface ProctoringDetailProps {
    attempt: AttemptData
    examId: string
}

export default function ProctoringDetail({ attempt, examId }: ProctoringDetailProps) {
    const router = useRouter()

    const getMetadataString = (metadata: Record<string, unknown> | null, key: string) => {
        const value = metadata?.[key]
        return typeof value === 'string' ? value : null
    }

    const getMetadataNumber = (metadata: Record<string, unknown> | null, key: string) => {
        const value = metadata?.[key]
        return typeof value === 'number' ? value : null
    }

    const getMetadataBoolean = (metadata: Record<string, unknown> | null, key: string) => {
        const value = metadata?.[key]
        return typeof value === 'boolean' ? value : null
    }

    const getEventColor = (type: string) => {
        switch (type) {
            case 'FOCUS_LOST':
                return 'bg-red-50 border-red-200 text-red-800'
            case 'FOCUS_GAINED':
                return 'bg-green-50 border-green-200 text-green-800'
            case 'TAB_SWITCH':
                return 'bg-orange-50 border-orange-200 text-orange-800'
            case 'FULLSCREEN_EXIT':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800'
            case 'COPY':
                return 'bg-purple-50 border-purple-200 text-purple-800'
            case 'PASTE':
                return 'bg-pink-50 border-pink-200 text-pink-800'
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800'
        }
    }

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'FOCUS_LOST':
                return 'Perte de focus'
            case 'FOCUS_GAINED':
                return 'Retour au focus'
            case 'TAB_SWITCH':
                return 'Changement d\'onglet'
            case 'FULLSCREEN_EXIT':
                return 'Sortie plein écran'
            case 'COPY':
                return 'Copie'
            case 'PASTE':
                return 'Collage'
            default:
                return type
        }
    }

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp)
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    const formatRelativeTime = (timestamp: string) => {
        const start = new Date(attempt.startedAt)
        const event = new Date(timestamp)
        const diffMs = event.getTime() - start.getTime()
        const diffSec = Math.floor(diffMs / 1000)
        const mins = Math.floor(diffSec / 60)
        const secs = diffSec % 60
        return `+${mins}m ${secs}s`
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <Stack gap="md" className="mb-6">
                <Button
                    variant="ghost"
                    onClick={() => router.push(`/dashboard/exams/${examId}/proctoring`)}
                    className="w-fit"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour au résumé
                </Button>
                <Text variant="pageTitle">Détails de proctoring</Text>
            </Stack>

            {/* Student and Exam Info */}
            <Surface className="p-6 mb-6 shadow-sm">
                <Grid cols="2" gap="lg">
                    <Stack gap="xs">
                        <Text variant="overline">Étudiant</Text>
                        <Text variant="sectionTitle">{attempt.student.name || 'Sans nom'}</Text>
                        <Text variant="muted">{attempt.student.email}</Text>
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="overline">Examen</Text>
                        <Text variant="sectionTitle">{attempt.exam.title}</Text>
                        <Text variant="muted">{attempt.exam.course.code} - {attempt.exam.course.name}</Text>
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="overline">Début</Text>
                        <Text variant="muted">{formatTimestamp(attempt.startedAt)}</Text>
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="overline">Soumission</Text>
                        <Text variant="muted">
                            {attempt.submittedAt ? formatTimestamp(attempt.submittedAt) : 'Non soumis'}
                        </Text>
                    </Stack>
                </Grid>
            </Surface>

            {/* Pattern Analysis */}
            <Surface className="p-6 mb-6 shadow-sm">
                <Text variant="sectionTitle" className="mb-4">Analyse des patterns</Text>
                <Grid cols="3" gap="md">
                    <Stack gap="xs">
                        <Text variant="overline">Pattern de perte de focus</Text>
                        <div className="flex items-center gap-2">
                            {attempt.focusLossPattern.flag === 'NONE' && (
                                <Badge variant="success">Aucun pattern suspect</Badge>
                            )}
                            {attempt.focusLossPattern.flag === 'SUSPICIOUS' && (
                                <Badge variant="warning" className="bg-orange-50 text-orange-700 border-orange-200">
                                    Pattern suspect
                                </Badge>
                            )}
                            {attempt.focusLossPattern.flag === 'HIGHLY_SUSPICIOUS' && (
                                <Badge className="bg-red-50 text-red-700 border-red-200">
                                    Pattern très suspect
                                </Badge>
                            )}
                        </div>
                        {attempt.focusLossPattern.totalAnswers > 0 && (
                            <Text variant="muted">
                                {attempt.focusLossPattern.suspiciousPairs} réponse{attempt.focusLossPattern.suspiciousPairs > 1 ? 's' : ''} sur {attempt.focusLossPattern.totalAnswers} précédée{attempt.focusLossPattern.suspiciousPairs > 1 ? 's' : ''} d'une perte de focus ({(attempt.focusLossPattern.ratio * 100).toFixed(0)}%)
                            </Text>
                        )}
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="overline">Collages externes</Text>
                        <Text variant="sectionTitle">{attempt.externalPastes}</Text>
                        {(attempt.externalPastes + attempt.internalPastes) > 0 && (
                            <Text variant="muted">
                                {attempt.externalPastes} externe{attempt.externalPastes > 1 ? 's' : ''} / {attempt.externalPastes + attempt.internalPastes} total ({((attempt.externalPastes / (attempt.externalPastes + attempt.internalPastes)) * 100).toFixed(0)}%)
                            </Text>
                        )}
                    </Stack>
                    <Stack gap="xs">
                        <Text variant="overline">Score anti-triche amélioré</Text>
                        <Text variant="sectionTitle">{attempt.antiCheatScore}</Text>
                        <Text variant="muted">
                            Score incluant patterns de focus et collages externes
                        </Text>
                    </Stack>
                </Grid>
            </Surface>

            {/* Event Statistics */}
            <Surface className="p-6 mb-6 shadow-sm">
                <Text variant="sectionTitle" className="mb-4">Statistiques des événements</Text>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(
                        attempt.proctorEvents.reduce((acc, event) => {
                            acc[event.type] = (acc[event.type] || 0) + 1
                            return acc
                        }, {} as Record<string, number>)
                    ).map(([type, count]) => (
                        <Surface key={type} tone="subtle" className="text-center p-3">
                            <Text as="p" className="text-2xl font-bold text-gray-900">{count}</Text>
                            <Text variant="xsMuted" className="mt-1">{getEventLabel(type)}</Text>
                        </Surface>
                    ))}
                    <Surface className="text-center p-3 bg-indigo-50">
                        <Text as="p" className="text-2xl font-bold text-indigo-900">{attempt.proctorEvents.length}</Text>
                        <Text variant="xsMuted" className="mt-1 text-indigo-600">Total</Text>
                    </Surface>
                </div>
            </Surface>

            {/* Timeline */}
            <Surface className="p-6 shadow-sm">
                <Text variant="sectionTitle" className="mb-4">
                    Chronologie des événements ({attempt.proctorEvents.length})
                </Text>

                {attempt.proctorEvents.length === 0 ? (
                    <Text variant="muted" className="text-center py-8">Aucun événement enregistré.</Text>
                ) : (
                    <Stack gap="sm">
                        {attempt.proctorEvents.map((event, index) => {
                            const isExternal = event.type === 'PASTE' && getMetadataBoolean(event.metadata, 'isExternal')
                            const isPaste = event.type === 'PASTE'
                            const borderClass = isPaste
                                ? isExternal === true
                                    ? 'border-2 border-red-300'
                                    : isExternal === false
                                    ? 'border-2 border-green-300'
                                    : ''
                                : ''

                            return (
                                <div
                                    key={event.id}
                                    className={`p-4 rounded-lg border ${getEventColor(event.type)} ${borderClass} flex items-start justify-between`}
                                >
                                    <div className="flex-1">
                                        <Inline gap="sm" align="start">
                                            <span className="font-semibold">{getEventLabel(event.type)}</span>
                                            {isPaste && isExternal === true && (
                                                <Badge className="bg-red-100 text-red-800 border-red-300">
                                                    Collage externe
                                                </Badge>
                                            )}
                                            {isPaste && isExternal === false && (
                                                <Badge variant="success">
                                                    Collage interne
                                                </Badge>
                                            )}
                                            <span className="text-xs opacity-75">
                                                {formatRelativeTime(event.timestamp)}
                                            </span>
                                        </Inline>
                                        <Text variant="xsMuted" className="mt-1">
                                            {formatTimestamp(event.timestamp)}
                                        </Text>
                                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                                            <div className="mt-2 text-xs">
                                                {getMetadataString(event.metadata, 'originalEvent') && (
                                                    <span className="mr-3">
                                                        Event: {getMetadataString(event.metadata, 'originalEvent')}
                                                    </span>
                                                )}
                                                {getMetadataString(event.metadata, 'visibility') && (
                                                    <span>
                                                        Visibility: {getMetadataString(event.metadata, 'visibility')}
                                                    </span>
                                                )}
                                                {getMetadataNumber(event.metadata, 'selectionLength') !== null && (
                                                    <span className="mr-3">
                                                        Selection: {getMetadataNumber(event.metadata, 'selectionLength')} chars
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs font-mono text-gray-500">
                                        #{index + 1}
                                    </div>
                                </div>
                            )
                        })}
                    </Stack>
                )}
            </Surface>
        </div>
    )
}

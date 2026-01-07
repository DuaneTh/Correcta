"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

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
}

interface ProctoringDetailProps {
    attempt: AttemptData
    examId: string
}

export default function ProctoringDetail({ attempt, examId }: ProctoringDetailProps) {
    const router = useRouter()

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
            <div className="mb-6">
                <button
                    onClick={() => router.push(`/dashboard/exams/${examId}/proctoring`)}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour au résumé
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Détails de proctoring</h1>
            </div>

            {/* Student and Exam Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Étudiant</h2>
                        <p className="text-lg font-semibold text-gray-900">{attempt.student.name || 'Sans nom'}</p>
                        <p className="text-sm text-gray-600">{attempt.student.email}</p>
                    </div>
                    <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Examen</h2>
                        <p className="text-lg font-semibold text-gray-900">{attempt.exam.title}</p>
                        <p className="text-sm text-gray-600">{attempt.exam.course.code} - {attempt.exam.course.name}</p>
                    </div>
                    <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Début</h2>
                        <p className="text-sm text-gray-900">{formatTimestamp(attempt.startedAt)}</p>
                    </div>
                    <div>
                        <h2 className="text-sm font-medium text-gray-500 uppercase mb-2">Soumission</h2>
                        <p className="text-sm text-gray-900">
                            {attempt.submittedAt ? formatTimestamp(attempt.submittedAt) : 'Non soumis'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Event Statistics */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiques des événements</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(
                        attempt.proctorEvents.reduce((acc, event) => {
                            acc[event.type] = (acc[event.type] || 0) + 1
                            return acc
                        }, {} as Record<string, number>)
                    ).map(([type, count]) => (
                        <div key={type} className="text-center p-3 bg-gray-50 rounded">
                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                            <p className="text-xs text-gray-600 mt-1">{getEventLabel(type)}</p>
                        </div>
                    ))}
                    <div className="text-center p-3 bg-indigo-50 rounded">
                        <p className="text-2xl font-bold text-indigo-900">{attempt.proctorEvents.length}</p>
                        <p className="text-xs text-indigo-600 mt-1">Total</p>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Chronologie des événements ({attempt.proctorEvents.length})
                </h2>

                {attempt.proctorEvents.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">Aucun événement enregistré.</p>
                ) : (
                    <div className="space-y-3">
                        {attempt.proctorEvents.map((event, index) => (
                            <div
                                key={event.id}
                                className={`p-4 rounded-lg border ${getEventColor(event.type)} flex items-start justify-between`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <span className="font-semibold">{getEventLabel(event.type)}</span>
                                        <span className="text-xs opacity-75">
                                            {formatRelativeTime(event.timestamp)}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1 opacity-75">
                                        {formatTimestamp(event.timestamp)}
                                    </p>
                                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                                        <div className="mt-2 text-xs">
                                            {event.metadata.originalEvent && (
                                                <span className="mr-3">
                                                    Event: {event.metadata.originalEvent}
                                                </span>
                                            )}
                                            {event.metadata.visibility && (
                                                <span>
                                                    Visibility: {event.metadata.visibility}
                                                </span>
                                            )}
                                            {event.metadata.selectionLength !== undefined && (
                                                <span className="mr-3">
                                                    Selection: {event.metadata.selectionLength} chars
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs font-mono text-gray-500">
                                    #{index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

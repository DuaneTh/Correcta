"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle, Clock, XCircle } from "lucide-react"

interface StudentSummary {
    attemptId: string
    student: {
        id: string
        name: string | null
        email: string
    }
    startedAt: string
    submittedAt: string | null
    status: string
    eventCounts: Record<string, number>
    totalEvents: number
    antiCheatScore: number
}

interface ProctoringSummaryProps {
    examId: string
    examTitle: string
    courseCode: string
}

export default function ProctoringSummary({ examId, examTitle, courseCode }: ProctoringSummaryProps) {
    const router = useRouter()
    const [summary, setSummary] = useState<StudentSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'score' | 'name' | 'status'>('score')
    const [sortDesc, setSortDesc] = useState(true)

    const fetchSummary = useCallback(async () => {
        try {
            const res = await fetch(`/api/exams/${examId}/proctoring`)
            if (res.ok) {
                const data = await res.json()
                setSummary(data.summary || [])
            } else {
                console.error('Failed to fetch proctoring summary')
            }
        } catch (error) {
            console.error('Error fetching proctoring summary:', error)
        } finally {
            setLoading(false)
        }
    }, [examId])

    useEffect(() => {
        fetchSummary()
    }, [fetchSummary])

    const getSuspicionColor = (score: number) => {
        if (score === 0) return 'bg-green-100 text-green-800'
        if (score <= 3) return 'bg-yellow-100 text-yellow-800'
        if (score <= 8) return 'bg-orange-100 text-orange-800'
        return 'bg-red-100 text-red-800'
    }

    const getSuspicionLabel = (score: number) => {
        if (score === 0) return 'Aucun'
        if (score <= 3) return 'Faible'
        if (score <= 8) return 'Moyen'
        return 'Élevé'
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'submitted':
                return <CheckCircle className="w-4 h-4 text-green-600" />
            case 'in_progress':
                return <Clock className="w-4 h-4 text-blue-600" />
            case 'expired':
                return <XCircle className="w-4 h-4 text-red-600" />
            default:
                return null
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'Soumis'
            case 'in_progress':
                return 'En cours'
            case 'expired':
                return 'Expiré'
            default:
                return status
        }
    }

    const sortedSummary = [...summary].sort((a, b) => {
        let comparison = 0
        if (sortBy === 'score') {
            comparison = a.antiCheatScore - b.antiCheatScore
        } else if (sortBy === 'name') {
            const nameA = a.student.name || a.student.email
            const nameB = b.student.name || b.student.email
            comparison = nameA.localeCompare(nameB)
        } else if (sortBy === 'status') {
            comparison = a.status.localeCompare(b.status)
        }
        return sortDesc ? -comparison : comparison
    })

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Chargement...</div>
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.push('/dashboard/exams')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour aux examens
                </button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{examTitle}</h1>
                        <p className="text-gray-600 mt-1">{courseCode} - Proctoring / Anti-triche</p>
                    </div>
                    <a
                        href={`/api/exams/${examId}/anti-cheat-report`}
                        download
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Télécharger le rapport anti-triche (CSV)
                    </a>
                </div>
            </div>

            {summary.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                    <p className="text-gray-500">Aucune tentative enregistrée pour cet examen.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => {
                                        if (sortBy === 'name') setSortDesc(!sortDesc)
                                        else { setSortBy('name'); setSortDesc(false) }
                                    }}
                                >
                                    Étudiant {sortBy === 'name' && (sortDesc ? '↓' : '↑')}
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => {
                                        if (sortBy === 'status') setSortDesc(!sortDesc)
                                        else { setSortBy('status'); setSortDesc(false) }
                                    }}
                                >
                                    Statut {sortBy === 'status' && (sortDesc ? '↓' : '↑')}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Événements
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => {
                                        if (sortBy === 'score') setSortDesc(!sortDesc)
                                        else { setSortBy('score'); setSortDesc(true) }
                                    }}
                                >
                                    Score de suspicion (heuristique) {sortBy === 'score' && (sortDesc ? '↓' : '↑')}
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedSummary.map((item) => (
                                <tr key={item.attemptId} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">
                                            {item.student.name || 'Sans nom'}
                                        </div>
                                        <div className="text-xs text-gray-500">{item.student.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {getStatusIcon(item.status)}
                                            <span className="ml-2 text-sm text-gray-700">
                                                {getStatusLabel(item.status)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-xs text-gray-600 space-y-1">
                                            <div>FOCUS_LOST: {item.eventCounts.FOCUS_LOST || 0}</div>
                                            <div>TAB_SWITCH: {item.eventCounts.TAB_SWITCH || 0}</div>
                                            <div>FOCUS_GAINED: {item.eventCounts.FOCUS_GAINED || 0}</div>
                                            <div>COPY: {item.eventCounts.COPY || 0}</div>
                                            <div>PASTE: {item.eventCounts.PASTE || 0}</div>
                                            <div className="font-medium">Total: {item.totalEvents}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${getSuspicionColor(item.antiCheatScore)}`}>
                                            {item.antiCheatScore} - {getSuspicionLabel(item.antiCheatScore)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => router.push(`/dashboard/exams/${examId}/proctoring/${item.attemptId}`)}
                                            className="text-indigo-600 hover:text-indigo-900"
                                        >
                                            Détails
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

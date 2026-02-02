'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Filter, FileDown, FileText, Eye, List, BarChart3 } from 'lucide-react'
import { getCsrfToken } from '@/lib/csrfClient'
import { GradeAllButton } from '@/components/grading/GradeAllButton'
import { ExportProgressModal } from '@/components/export/ExportProgressModal'
import { AttemptDetailModal } from '@/components/grading/AttemptDetailModal'
import { GradingProgressModal } from '@/components/grading/GradingProgressModal'
import { GradeDistributionPanel } from '@/components/grading/GradeDistributionPanel'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Inline, Stack } from '@/components/ui/Layout'
import { Badge } from '@/components/ui/Badge'
import { TextLink } from '@/components/ui/TextLink'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StatPill } from '@/components/ui/StatPill'

interface AttemptSummary {
    attemptId: string
    student: {
        id: string
        name: string
        email: string
    }
    status: string
    submittedAt: string | null
    gradedAt: string | null
    totalScore: number | null
    maxPoints: number | null
    gradedQuestionsCount: number
    isFullyGraded: boolean
    humanModifiedCount: number
}

interface GradingDashboardProps {
    examId: string
    examTitle: string
}

interface RubricStatus {
    total: number
    generated: number
    allGenerated: boolean
}

interface GradingStatusData {
    total: number
    graded: number
    allGraded: boolean
}

type SortField = 'name' | 'submittedAt' | 'score'
type SortOrder = 'asc' | 'desc'
type FilterOption = 'all' | 'ungraded' | 'graded' | 'modified'
type ViewMode = 'list' | 'stats'

export default function GradingDashboard({ examId, examTitle }: GradingDashboardProps) {
    const router = useRouter()
    const [attempts, setAttempts] = useState<AttemptSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [sortField, setSortField] = useState<SortField>('submittedAt')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [releaseMessage, setReleaseMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)
    const [isReleasing, setIsReleasing] = useState(false)
    const [showPublishConfirm, setShowPublishConfirm] = useState(false)
    const [filterOption, setFilterOption] = useState<FilterOption>('all')
    const [showFilterDropdown, setShowFilterDropdown] = useState(false)
    const [showActionsDropdown, setShowActionsDropdown] = useState(false)
    const [exportJobId, setExportJobId] = useState<string | null>(null)
    const [isStartingExport, setIsStartingExport] = useState(false)
    const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null)
    const [showGradingProgress, setShowGradingProgress] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('list')
    const [gradesReleased, setGradesReleased] = useState(false)
    const [rubricStatus, setRubricStatus] = useState<RubricStatus | undefined>(undefined)
    const [gradingStatusData, setGradingStatusData] = useState<GradingStatusData | undefined>(undefined)

    const fetchAttempts = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) {
                setLoading(true)
            }
            const res = await fetch(`/api/exams/${examId}/grading`)
            if (!res.ok) {
                console.error('Failed to fetch grading data')
                return
            }
            const data = await res.json()
            setAttempts(data.attempts || [])
            setGradesReleased(data.gradesReleased || false)
            setRubricStatus(data.rubricStatus)
            setGradingStatusData(data.gradingStatus)
        } catch (error) {
            console.error('Error fetching attempts:', error)
        } finally {
            if (showLoading) {
                setLoading(false)
            }
        }
    }, [examId])

    useEffect(() => {
        fetchAttempts(true)

        // Auto-refresh every 30 seconds to catch grading updates (silent refresh)
        const interval = setInterval(() => {
            fetchAttempts(false)
        }, 30000)

        return () => clearInterval(interval)
    }, [fetchAttempts])

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc')
        }
    }

    // Filter attempts based on selected filter option
    const filteredAttempts = useMemo(() => {
        switch (filterOption) {
            case 'ungraded':
                return attempts.filter(a => a.status === 'SUBMITTED' || a.status === 'GRADING_IN_PROGRESS')
            case 'graded':
                return attempts.filter(a => a.status === 'GRADED')
            case 'modified':
                return attempts.filter(a => a.humanModifiedCount > 0)
            default:
                return attempts
        }
    }, [attempts, filterOption])

    const sortedAttempts = useMemo(() => [...filteredAttempts].sort((a, b) => {
        let comparison = 0

        switch (sortField) {
            case 'name':
                comparison = a.student.name.localeCompare(b.student.name)
                break
            case 'submittedAt':
                const aDate = a.submittedAt ? new Date(a.submittedAt).getTime() : 0
                const bDate = b.submittedAt ? new Date(b.submittedAt).getTime() : 0
                comparison = aDate - bDate
                break
            case 'score':
                const aScore = a.totalScore ?? -1
                const bScore = b.totalScore ?? -1
                comparison = aScore - bScore
                break
        }

        return sortOrder === 'asc' ? comparison : -comparison
    }), [filteredAttempts, sortField, sortOrder])

    // Calculate statistics
    const stats = useMemo(() => {
        const total = attempts.length
        const graded = attempts.filter(a => a.status === 'GRADED').length
        const humanModified = attempts.reduce((sum, a) => sum + (a.humanModifiedCount > 0 ? 1 : 0), 0)

        // Calculate average score
        const gradedWithScores = attempts.filter(a => a.totalScore !== null && a.maxPoints !== null)
        let avgScore = 0
        let avgMaxPoints = 0
        if (gradedWithScores.length > 0) {
            avgScore = gradedWithScores.reduce((sum, a) => sum + (a.totalScore || 0), 0) / gradedWithScores.length
            avgMaxPoints = gradedWithScores[0]?.maxPoints || 0
        }

        const percentage = total > 0 ? Math.round((graded / total) * 100) : 0
        const allGraded = total > 0 && graded === total

        return { total, graded, humanModified, avgScore, avgMaxPoints, percentage, allGraded }
    }, [attempts])

    const gradedCount = stats.graded
    const canPublish = stats.allGraded

    // Prepare grade data for distribution panel
    const gradeDataForPanel = useMemo(() => {
        return attempts
            .filter(a => a.status === 'GRADED' && a.totalScore !== null && a.maxPoints !== null)
            .map(a => ({
                attemptId: a.attemptId,
                studentName: a.student.name,
                originalScore: a.totalScore!,
                currentScore: a.totalScore!,
                maxPoints: a.maxPoints!
            }))
    }, [attempts])

    const handleReleaseResults = async () => {
        setIsReleasing(true)
        setReleaseMessage(null)
        setShowPublishConfirm(false)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/release-results`, {
                method: 'POST',
                headers: { 'x-csrf-token': csrfToken }
            })

            const data = await res.json()

            if (res.ok) {
                setReleaseMessage({
                    type: 'success',
                    text: 'Copies rendues avec succes'
                })
                // Refresh list to update any visual indicators
                fetchAttempts()
            } else if (res.status === 400 && data.error === 'EXAM_NOT_FULLY_GRADED') {
                setReleaseMessage({
                    type: 'warning',
                    text: 'Toutes les copies ne sont pas encore corrigees.'
                })
            } else {
                console.error('Release results error:', data)
                setReleaseMessage({
                    type: 'error',
                    text: 'Une erreur est survenue lors de la publication des resultats.'
                })
            }
        } catch (error) {
            console.error('Error releasing results:', error)
            setReleaseMessage({
                type: 'error',
                text: 'Une erreur est survenue lors de la publication des resultats.'
            })
        } finally {
            setIsReleasing(false)
        }
    }

    const handlePdfExport = async () => {
        setIsStartingExport(true)
        setShowActionsDropdown(false)

        try {
            const csrfToken = await getCsrfToken()
            const res = await fetch(`/api/exams/${examId}/export/pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({})  // Could add classIds filter here
            })

            if (res.ok) {
                const data = await res.json()
                setExportJobId(data.jobId)
            } else {
                console.error('Failed to start export')
                alert('Erreur lors du demarrage de l\'export')
            }
        } catch (error) {
            console.error('Export error:', error)
            alert('Erreur lors du demarrage de l\'export')
        } finally {
            setIsStartingExport(false)
        }
    }

    const getFilterLabel = (filter: FilterOption) => {
        switch (filter) {
            case 'all': return 'Toutes les copies'
            case 'ungraded': return 'Non corrigees'
            case 'graded': return 'Corrigees'
            case 'modified': return 'Modifiees'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'SUBMITTED':
                return <Text variant="muted">Non corrigée</Text>
            case 'GRADING_IN_PROGRESS':
                return <Text variant="muted">Correction en cours</Text>
            case 'GRADED':
                return <Text variant="body">Corrigée</Text>
            case 'IN_PROGRESS':
                return <Text variant="muted">En cours</Text>
            default:
                return <Text variant="muted">{status}</Text>
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Text variant="body" className="text-gray-600">Chargement...</Text>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <Stack gap="lg" className="mb-8">
                    <TextLink href={`/dashboard/exams/${examId}`}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour a l&apos;examen
                    </TextLink>
                    <Inline align="between" gap="md">
                        <Stack gap="xs">
                            <Text as="h1" variant="pageTitle">Correction</Text>
                            <Text variant="muted">{examTitle}</Text>
                        </Stack>
                        <Inline align="start" gap="sm">
                            <GradeAllButton
                                examId={examId}
                                rubricStatus={rubricStatus}
                                gradingStatus={gradingStatusData}
                                onComplete={fetchAttempts}
                                onPublishAfterGrading={handleReleaseResults}
                                disabled={gradesReleased}
                            />

                            {/* Actions dropdown */}
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                                >
                                    <FileDown className="w-4 h-4" />
                                    Exporter
                                    <ChevronDown className="w-4 h-4" />
                                </Button>
                                {showActionsDropdown && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                        <button
                                            onClick={() => {
                                                // Trigger CSV download
                                                const url = `/api/exams/${examId}/export/csv`
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = '' // Let server set filename
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                setShowActionsDropdown(false)
                                            }}
                                            className="w-full px-4 py-2 text-left text-gray-700 flex items-center gap-2 hover:bg-gray-50"
                                        >
                                            <FileDown className="w-4 h-4" />
                                            Exporter les notes (CSV)
                                        </button>
                                        <button
                                            onClick={handlePdfExport}
                                            disabled={isStartingExport}
                                            className="w-full px-4 py-2 text-left text-gray-700 flex items-center gap-2 hover:bg-gray-50 disabled:text-gray-400"
                                        >
                                            <FileText className="w-4 h-4" />
                                            {isStartingExport ? 'Demarrage...' : 'Telecharger rapport (PDF)'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Publish button */}
                            <Button
                                onClick={() => canPublish && !gradesReleased ? setShowPublishConfirm(true) : null}
                                disabled={isReleasing || !canPublish || gradesReleased}
                                variant={canPublish && !gradesReleased ? 'primary' : 'secondary'}
                                title={gradesReleased ? 'Les copies ont deja ete rendues' : !canPublish ? 'Toutes les copies doivent etre corrigees' : undefined}
                            >
                                {isReleasing ? 'Publication...' : gradesReleased ? 'Copies rendues' : 'Rendre les copies'}
                            </Button>
                        </Inline>
                    </Inline>
                </Stack>

                {/* Statistics summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                        <CardBody padding="md">
                            <Stack gap="xs">
                                <Text variant="caption">Copies corrigees</Text>
                                <Text variant="pageTitle" className="text-2xl">
                                    {stats.graded} <Text as="span" variant="body" className="text-gray-500">sur {stats.total}</Text>
                                </Text>
                            </Stack>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody padding="md">
                            <Stack gap="xs">
                                <Text variant="caption">Modifications manuelles</Text>
                                <Text variant="pageTitle" className="text-2xl">
                                    {stats.humanModified} <Text as="span" variant="body" className="text-gray-500">copies</Text>
                                </Text>
                            </Stack>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardBody padding="md">
                            <Stack gap="xs">
                                <Text variant="caption">Score moyen</Text>
                                <Text variant="pageTitle" className="text-2xl">
                                    {stats.avgMaxPoints > 0 ? (
                                        <>
                                            {stats.avgScore.toFixed(1)} <Text as="span" variant="body" className="text-gray-500">/ {stats.avgMaxPoints}</Text>
                                        </>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </Text>
                            </Stack>
                        </CardBody>
                    </Card>
                </div>

                {/* Progress bar (only show if not all graded) - clickable to show details */}
                {!stats.allGraded && stats.total > 0 && (
                    <Card
                        interactive="subtle"
                        onClick={() => setShowGradingProgress(true)}
                        className="mb-6 cursor-pointer border-2 border-transparent hover:border-indigo-200"
                    >
                        <CardBody padding="md">
                            <Stack gap="sm">
                                <Inline align="between" gap="sm">
                                    <Text variant="label">Progression de la correction</Text>
                                    <Text variant="caption">{stats.graded}/{stats.total} copies corrigees</Text>
                                </Inline>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div
                                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                                        style={{ width: `${stats.percentage}%` }}
                                    />
                                </div>
                                <Text variant="caption" className="text-indigo-600 text-center">Cliquez pour voir les details</Text>
                            </Stack>
                        </CardBody>
                    </Card>
                )}

                {/* View mode tabs */}
                <div className="mb-6">
                    <SegmentedControl
                        value={viewMode}
                        onChange={(value) => setViewMode(value)}
                        options={[
                            {
                                value: 'list',
                                label: 'Liste des copies',
                                icon: <List className="w-4 h-4" />
                            },
                            {
                                value: 'stats',
                                label: 'Statistiques et harmonisation',
                                icon: <BarChart3 className="w-4 h-4" />
                            }
                        ]}
                    />
                </div>

                {/* Release message */}
                {releaseMessage && (
                    <div
                        className={`mb-6 p-4 rounded-lg ${releaseMessage.type === 'success'
                                ? 'bg-green-100 text-green-800'
                                : releaseMessage.type === 'warning'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                            }`}
                    >
                        {releaseMessage.text}
                    </div>
                )}

                {/* Publish confirmation modal */}
                {showPublishConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => setShowPublishConfirm(false)}
                        />
                        <Card className="relative w-full max-w-md mx-4">
                            <CardBody padding="lg">
                                <Stack gap="md">
                                    <Text variant="sectionTitle">Publier les notes ?</Text>
                                    <Text variant="muted">Etes-vous sur de vouloir publier les notes ?</Text>
                                    <Text variant="muted">Les etudiants pourront voir leurs notes et les commentaires.</Text>
                                    <div className="bg-blue-50 text-blue-800 px-3 py-2 rounded-lg">
                                        <Text variant="caption" className="text-blue-800">{gradedCount} copies seront publiees</Text>
                                    </div>
                                    <Inline align="end" gap="sm">
                                        <Button
                                            variant="secondary"
                                            onClick={() => setShowPublishConfirm(false)}
                                        >
                                            Annuler
                                        </Button>
                                        <Button
                                            onClick={handleReleaseResults}
                                            disabled={isReleasing}
                                        >
                                            {isReleasing ? 'Publication...' : 'Publier'}
                                        </Button>
                                    </Inline>
                                </Stack>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {/* Stats View - Distribution Panel */}
                {viewMode === 'stats' && (
                    <GradeDistributionPanel
                        examId={examId}
                        grades={gradeDataForPanel}
                        maxPoints={stats.avgMaxPoints || 20}
                        onHarmonizationApplied={fetchAttempts}
                    />
                )}

                {/* List View - Filter dropdown and table */}
                {viewMode === 'list' && (
                    <>
                        {/* Filter dropdown */}
                        <Inline align="start" gap="md" className="mb-4">
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                >
                                    <Filter className="w-4 h-4" />
                                    {getFilterLabel(filterOption)}
                                    <ChevronDown className="w-4 h-4" />
                                </Button>
                                {showFilterDropdown && (
                                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                        {(['all', 'ungraded', 'graded', 'modified'] as FilterOption[]).map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setFilterOption(option)
                                                    setShowFilterDropdown(false)
                                                }}
                                                className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                                                    filterOption === option ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                                                }`}
                                            >
                                                {getFilterLabel(option)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {filterOption !== 'all' && (
                                <Text variant="caption">
                                    {filteredAttempts.length} resultat{filteredAttempts.length !== 1 ? 's' : ''}
                                </Text>
                            )}
                        </Inline>

                        {/* Attempts table */}
                        <Card overflow="hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                onClick={() => handleSort('name')}
                                            >
                                                Etudiant
                                            </th>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                onClick={() => handleSort('submittedAt')}
                                            >
                                                Statut
                                            </th>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                onClick={() => handleSort('score')}
                                            >
                                                Score
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedAttempts.map((attempt, index) => {
                                            const isSubmitted = ['SUBMITTED', 'GRADING_IN_PROGRESS', 'GRADED'].includes(attempt.status)
                                            const hasScore = attempt.totalScore !== null
                                            const hasHumanModifications = attempt.humanModifiedCount > 0

                                            return (
                                                <tr
                                                    key={attempt.attemptId}
                                                    onClick={() => isSubmitted && setSelectedAttemptId(attempt.attemptId)}
                                                    className={`hover:bg-indigo-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                                >
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Stack gap="xs">
                                                            <Text variant="body" className="font-medium">{attempt.student.name}</Text>
                                                            <Text variant="caption">{attempt.student.email}</Text>
                                                        </Stack>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Stack gap="xs">
                                                            <Inline align="start" gap="xs">
                                                                {getStatusLabel(attempt.status)}
                                                                {hasHumanModifications && (
                                                                    <Text
                                                                        variant="caption"
                                                                        className="italic"
                                                                        title={`${attempt.humanModifiedCount} question${attempt.humanModifiedCount > 1 ? 's' : ''} modifiée${attempt.humanModifiedCount > 1 ? 's' : ''} par le professeur`}
                                                                    >
                                                                        (modifié)
                                                                    </Text>
                                                                )}
                                                            </Inline>
                                                            {attempt.gradedAt ? (
                                                                <Text variant="xsMuted">
                                                                    Corrigé le {new Date(attempt.gradedAt).toLocaleString()}
                                                                </Text>
                                                            ) : attempt.submittedAt ? (
                                                                <Text variant="xsMuted">
                                                                    Soumis le {new Date(attempt.submittedAt).toLocaleString()}
                                                                </Text>
                                                            ) : null}
                                                        </Stack>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {hasScore ? (
                                                            <Text variant="body" className="font-bold">
                                                                {attempt.totalScore}{attempt.maxPoints ? ` / ${attempt.maxPoints}` : ''} pts
                                                            </Text>
                                                        ) : (
                                                            <Text variant="muted">Non corrige</Text>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        {isSubmitted ? (
                                                            <Inline align="end" gap="xs">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setSelectedAttemptId(attempt.attemptId)
                                                                    }}
                                                                    title="Apercu rapide"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="primary"
                                                                    size="xs"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        router.push(`/dashboard/exams/${examId}/grading/${attempt.attemptId}`)
                                                                    }}
                                                                >
                                                                    Corriger
                                                                </Button>
                                                            </Inline>
                                                        ) : (
                                                            <Text variant="muted" className="cursor-not-allowed">
                                                                Non disponible
                                                            </Text>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            {sortedAttempts.length === 0 && (
                                <div className="p-12 text-center">
                                    <Text variant="muted">
                                        {filterOption === 'all'
                                            ? 'Aucune copie trouvee pour cet examen.'
                                            : `Aucune copie correspondant au filtre "${getFilterLabel(filterOption)}".`}
                                    </Text>
                                </div>
                            )}
                        </div>
                        </Card>
                    </>
                )}
            </div>

            {/* Export Progress Modal */}
            {exportJobId && (
                <ExportProgressModal
                    examId={examId}
                    jobId={exportJobId}
                    onClose={() => setExportJobId(null)}
                />
            )}

            {/* Attempt Detail Modal */}
            {selectedAttemptId && (
                <AttemptDetailModal
                    attemptId={selectedAttemptId}
                    isOpen={!!selectedAttemptId}
                    onClose={() => setSelectedAttemptId(null)}
                    onGradeUpdated={fetchAttempts}
                />
            )}

            {/* Grading Progress Modal */}
            <GradingProgressModal
                examId={examId}
                isOpen={showGradingProgress}
                onClose={() => setShowGradingProgress(false)}
                onComplete={() => {
                    setShowGradingProgress(false)
                    fetchAttempts()
                }}
            />
        </div>
    )
}

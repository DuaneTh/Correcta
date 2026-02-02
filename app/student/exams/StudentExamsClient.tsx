'use client'

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getExamEndAt } from "@/lib/exam-time"
import { getCorrectionReleaseInfo } from "@/lib/correction-release"
import StartExamButton from "./StartExamButton"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardBody } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Stack } from "@/components/ui/Layout"
import { SearchField } from "@/components/ui/SearchField"
import { Text } from "@/components/ui/Text"
import { cn } from "@/components/ui/cn"

type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'GRADING_IN_PROGRESS'

type ExamRow = {
    id: string
    title: string
    startAt: Date | string
    endAt: Date | string | null
    durationMinutes: number
    gradingConfig?: Record<string, unknown> | null
    archivedAt?: Date | string | null
    course: {
        code: string
        name: string
        classes: Array<{
            enrollments: Array<{
                user: { name: string | null }
            }>
        }>
    }
    attempts: Array<{
        id: string
        status: AttemptStatus
        startedAt: Date | string
        submittedAt: Date | string | null
        score?: number | null
        maxPoints?: number | null
    }>
}

interface StudentExamsClientProps {
    exams: ExamRow[]
    dictionary: Dictionary
    locale: Locale
}

const matchesExamSearch = (exam: ExamRow, term: string, localeString: string): boolean => {
    if (!term) return true
    const lowerTerm = term.toLowerCase()

    if (exam.title.toLowerCase().includes(lowerTerm)) return true
    if (exam.course.name.toLowerCase().includes(lowerTerm)) return true
    if (exam.course.code.toLowerCase().includes(lowerTerm)) return true

    const instructorName = exam.course.classes[0]?.enrollments[0]?.user?.name || ''
    if (instructorName.toLowerCase().includes(lowerTerm)) return true

    const startAt = new Date(exam.startAt)
    const startDate = startAt.toLocaleDateString(localeString)
    const startDateTime = startAt.toLocaleString(localeString)
    const startDateShort = startDate.split('/').slice(0, 2).join('/')
    if (startDate.includes(lowerTerm) || startDateTime.includes(lowerTerm) || startDateShort.includes(lowerTerm)) {
        return true
    }

    const endAt = getExamEndAt(startAt, exam.durationMinutes, exam.endAt ? new Date(exam.endAt) : null)
    if (endAt) {
        const endDate = endAt.toLocaleDateString(localeString)
        const endDateTime = endAt.toLocaleString(localeString)
        const endDateShort = endDate.split('/').slice(0, 2).join('/')
        if (endDate.includes(lowerTerm) || endDateTime.includes(lowerTerm) || endDateShort.includes(lowerTerm)) {
            return true
        }
    }

    return false
}

export default function StudentExamsClient({ exams, dictionary, locale }: StudentExamsClientProps) {
    const router = useRouter()
    const [searchTerm, setSearchTerm] = useState('')
    const dict = dictionary.student.coursesPage
    const localeString = locale === 'fr' ? 'fr-FR' : 'en-US'

    // Auto-refresh every 30 seconds to catch exam start/end events
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh()
        }, 30000)

        return () => clearInterval(interval)
    }, [router])

    const filteredExams = useMemo(() => {
        if (!searchTerm) return exams
        return exams.filter((exam) => matchesExamSearch(exam, searchTerm, localeString))
    }, [exams, searchTerm, localeString])

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Stack gap="lg">
                <Stack gap="md">
                    <Text as="h1" variant="pageTitle">{dictionary.student.header.exams}</Text>
                    <SearchField
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={dict.searchPlaceholder}
                    />
                </Stack>

                <Stack gap="md">
                    {filteredExams.length === 0 ? (
                        <EmptyState
                            title={searchTerm ? "Aucun résultat trouvé" : "Aucun examen disponible"}
                            description={searchTerm ? "Essayez un autre terme de recherche." : "Aucun examen disponible pour le moment."}
                            size="full"
                        />
                    ) : (
                        filteredExams.map((exam) => {
                            const attempt = exam.attempts[0]
                            const now = new Date()
                            const startAt = new Date(exam.startAt)
                            const endAt = getExamEndAt(startAt, exam.durationMinutes, exam.endAt ? new Date(exam.endAt) : null)
                            const instructorName =
                                exam.course.classes[0]?.enrollments[0]?.user?.name || ""

                            const isStarted = Boolean(attempt)
                            const isInProgressAttempt = attempt?.status === "IN_PROGRESS"
                            const isSubmitted =
                                attempt?.status === "SUBMITTED" ||
                                attempt?.status === "GRADED" ||
                                attempt?.status === "GRADING_IN_PROGRESS"
                            const isGraded = attempt?.status === "GRADED"
                            const releaseInfo = getCorrectionReleaseInfo({
                                gradingConfig: exam.gradingConfig as Record<string, unknown> | null,
                                startAt,
                                durationMinutes: exam.durationMinutes,
                                endAt,
                            })
                            const isBeforeStart = now < startAt
                            const isAfterEnd = endAt && now > endAt
                            const isWithinWindow = !isBeforeStart && !isAfterEnd
                            const isArchived = Boolean(exam.archivedAt)
                            const canViewCorrection = Boolean(isSubmitted && (isAfterEnd || isArchived) && isGraded && releaseInfo.isReleased)
                            const score = attempt?.score
                            const maxPoints = attempt?.maxPoints

                            let statusLabel = "Non demarre"
                            let statusVariant: 'neutral' | 'info' | 'success' | 'warning' = 'neutral'
                            let actionButton = null

                            // Handle archived exams - they can only be viewed for results
                            if (isArchived) {
                                statusLabel = isSubmitted ? (canViewCorrection ? dict.statusCorrected : dict.statusSubmitted) : "Archive"
                                statusVariant = isSubmitted
                                    ? (canViewCorrection ? 'success' : 'neutral')
                                    : 'neutral'
                                actionButton = isSubmitted && attempt ? (
                                    <Link href={`/student/attempts/${attempt.id}/results`}>
                                        <Button variant="secondary" size="sm">
                                            {dict.viewGradedCopyButton}
                                        </Button>
                                    </Link>
                                ) : (
                                    <Text variant="caption" className="italic text-gray-400">Examen archive</Text>
                                )
                            } else if (isBeforeStart) {
                                statusLabel = dict.statusUpcoming
                                statusVariant = 'warning'
                                actionButton = (
                                    <Button variant="secondary" size="sm" disabled>
                                        {dict.notAvailableYetButton}
                                    </Button>
                                )
                            } else if (isSubmitted) {
                                statusLabel = canViewCorrection ? dict.statusCorrected : dict.statusSubmitted
                                statusVariant = canViewCorrection ? 'success' : 'info'
                                actionButton = (
                                    <Stack gap="xs">
                                        <Button variant="secondary" size="sm" disabled>
                                            {dict.submittedExamButton}
                                        </Button>
                                        {canViewCorrection ? (
                                            <Link href={`/student/attempts/${attempt.id}/results`}>
                                                <Button variant="secondary" size="sm">
                                                    {dict.viewGradedCopyButton}
                                                </Button>
                                            </Link>
                                        ) : (
                                            !isAfterEnd && (
                                                <Text variant="xsMuted">
                                                    {dict.correctionAfterWindowLabel}
                                                </Text>
                                            )
                                        )}
                                    </Stack>
                                )
                            } else if (isAfterEnd) {
                                statusLabel = dict.statusExpired
                                statusVariant = 'warning'
                                actionButton = (
                                    <Button variant="secondary" size="sm" disabled>
                                        {dict.windowClosedButton}
                                    </Button>
                                )
                            } else if (isInProgressAttempt && isWithinWindow) {
                                statusLabel = dict.statusInProgress
                                statusVariant = 'info'
                                actionButton = (
                                    <StartExamButton
                                        examId={exam.id}
                                        label={dict.resumeButton}
                                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900"
                                    />
                                )
                            } else if (!isStarted && isWithinWindow) {
                                statusLabel = dict.statusAvailable
                                statusVariant = 'success'
                                actionButton = (
                                    <StartExamButton
                                        examId={exam.id}
                                        label={dictionary.student.nextExamPage.availableExam.startButton}
                                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900"
                                    />
                                )
                            } else {
                                actionButton = (
                                    <Button variant="secondary" size="sm" disabled>
                                        Non disponible
                                    </Button>
                                )
                            }

                            if (isInProgressAttempt && isWithinWindow) {
                                return (
                                    <Card
                                        key={exam.id}
                                        className="border-brand-200 bg-brand-50"
                                    >
                                        <CardBody padding="md">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <Stack gap="sm">
                                                    <Badge variant="info" className="text-white bg-brand-900 border-brand-900 w-fit">
                                                        {dict.statusInProgress}
                                                    </Badge>
                                                    <Stack gap="xs">
                                                        <Text variant="caption">
                                                            {exam.course.code} - {exam.course.name}
                                                        </Text>
                                                        <Text variant="caption">
                                                            {dict.teacherLabel} : {instructorName}
                                                        </Text>
                                                        <Text as="h3" variant="sectionTitle">{exam.title}</Text>
                                                    </Stack>
                                                    <Stack gap="xs">
                                                        <Text variant="muted">
                                                            {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                                        </Text>
                                                        <Text variant="muted">
                                                            {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                                        </Text>
                                                        {endAt && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                    </Stack>
                                                </Stack>
                                                <div className="flex-shrink-0">{actionButton}</div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                )
                            }

                            if (!isStarted && isWithinWindow) {
                                return (
                                    <Card
                                        key={exam.id}
                                        className="border-brand-200 bg-brand-50"
                                    >
                                        <CardBody padding="md">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <Stack gap="sm">
                                                    <Badge variant="info" className="text-white bg-brand-900 border-brand-900 w-fit">
                                                        {dict.statusAvailable}
                                                    </Badge>
                                                    <Stack gap="xs">
                                                        <Text variant="caption">
                                                            {exam.course.code} - {exam.course.name}
                                                        </Text>
                                                        <Text variant="caption">
                                                            {dict.teacherLabel} : {instructorName}
                                                        </Text>
                                                        <Text as="h3" variant="sectionTitle">{exam.title}</Text>
                                                    </Stack>
                                                    <Stack gap="xs">
                                                        <Text variant="muted">
                                                            {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                                        </Text>
                                                        <Text variant="muted">
                                                            {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                                        </Text>
                                                        {endAt && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                    </Stack>
                                                </Stack>
                                                <div className="flex-shrink-0">{actionButton}</div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                )
                            }

                            return (
                                <Card
                                    key={exam.id}
                                    className={cn("bg-gray-50", isArchived ? 'opacity-70' : '')}
                                >
                                    <CardBody padding="md">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <Stack gap="sm" className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={statusVariant}>
                                                        {statusLabel}
                                                    </Badge>
                                                    {canViewCorrection && score !== null && score !== undefined && maxPoints ? (
                                                        <Badge variant="info" className="bg-brand-100 text-brand-900 border-brand-200">
                                                            {score} / {maxPoints}
                                                        </Badge>
                                                    ) : null}
                                                </div>
                                                <Text variant="caption">
                                                    {exam.course.code} - {exam.course.name}
                                                </Text>
                                                <Text variant="caption">
                                                    {dict.teacherLabel} : {instructorName}
                                                </Text>
                                                <Text as="h3" variant="sectionTitle">{exam.title}</Text>
                                                <Stack gap="xs">
                                                    <Text variant="muted">
                                                        {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                                    </Text>
                                                    <Text variant="muted">
                                                        {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                                    </Text>
                                                    {endAt && !isArchived && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                </Stack>
                                            </Stack>
                                            <div className="flex-shrink-0">{actionButton}</div>
                                        </div>
                                    </CardBody>
                                </Card>
                            )
                        })
                    )}
                </Stack>
            </Stack>
        </div>
    )
}

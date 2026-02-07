"use client"

import { useState } from "react"
import Link from "next/link"
import { getExamEndAt } from "@/lib/exam-time"
import { getCorrectionReleaseInfo } from "@/lib/correction-release"
import StartExamButton from "@/app/student/components/StartExamButton"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardBody } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Grid, Stack } from "@/components/ui/Layout"
import { SearchField } from "@/components/ui/SearchField"
import { Text } from "@/components/ui/Text"
import { cn } from "@/components/ui/cn"

type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'GRADING_IN_PROGRESS'

interface ExamWithDetails {
    id: string
    title: string
    startAt: Date
    endAt: Date | null
    durationMinutes: number
    gradingConfig?: Record<string, unknown> | null
    archivedAt?: Date | string | null
    attempts: Array<{
        id: string
        status: AttemptStatus
        startedAt: Date
        submittedAt: Date | null
        score?: number | null
        maxPoints?: number | null
    }>
}

interface CourseWithDetails {
    id: string
    code: string
    name: string
    instructor?: {
        name: string | null
        email: string
    }
    exams: ExamWithDetails[]
}

interface Props {
    courses: CourseWithDetails[]
    dictionary: Dictionary
    locale: Locale
}

export default function StudentCoursesClient({ courses, dictionary, locale }: Props) {
    const [searchTerm, setSearchTerm] = useState('')
    const dict = dictionary.student.coursesPage
    const localeString = locale === 'fr' ? 'fr-FR' : 'en-US'

    // Fonction de matching pour un cours
    function matchesCourseSearch(course: CourseWithDetails, term: string): boolean {
        if (!term) return true
        const lowerTerm = term.toLowerCase()

        // Nom du cours
        if (course.name.toLowerCase().includes(lowerTerm)) return true

        // Code du cours
        if (course.code.toLowerCase().includes(lowerTerm)) return true

        // Nom du professeur
        if (course.instructor?.name?.toLowerCase().includes(lowerTerm)) return true

        return false
    }

    // Fonction de matching pour un examen
    function matchesExamSearch(exam: ExamWithDetails, term: string): boolean {
        if (!term) return true
        const lowerTerm = term.toLowerCase()

        // Titre de l'examen
        if (exam.title.toLowerCase().includes(lowerTerm)) return true

        // Dates formatées (plusieurs formats pour plus de flexibilité)
        const startDate = new Date(exam.startAt).toLocaleDateString(localeString)
        const startDateTime = new Date(exam.startAt).toLocaleString(localeString)
        const startDateShort = startDate.split('/').slice(0, 2).join('/') // JJ/MM

        if (startDate.includes(lowerTerm) ||
            startDateTime.includes(lowerTerm) ||
            startDateShort.includes(lowerTerm)) {
            return true
        }

        const computedEndAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)
        if (computedEndAt) {
            const endDate = computedEndAt.toLocaleDateString(localeString)
            const endDateTime = computedEndAt.toLocaleString(localeString)
            const endDateShort = endDate.split('/').slice(0, 2).join('/')

            if (endDate.includes(lowerTerm) ||
                endDateTime.includes(lowerTerm) ||
                endDateShort.includes(lowerTerm)) {
                return true
            }
        }

        return false
    }

    // Filtrage des cours et examens
    const filteredCourses = courses
        .map(course => {
            // Filtrer les examens du cours
            const filteredExams = course.exams.filter(exam =>
                matchesExamSearch(exam, searchTerm)
            )

            // Vérifier si le cours lui-même matche
            const courseMatches = matchesCourseSearch(course, searchTerm)

            // Inclure le cours si lui-même ou au moins un examen matche
            if (courseMatches || filteredExams.length > 0) {
                return {
                    ...course,
                    exams: courseMatches ? course.exams : filteredExams
                }
            }
            return null
        })
        .filter((course): course is CourseWithDetails => course !== null)

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Stack gap="lg">
                <Stack gap="md">
                    <Text as="h1" variant="pageTitle">{dict.title}</Text>
                    <SearchField
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={dict.searchPlaceholder}
                    />
                </Stack>

                <Stack gap="xl">
                    {filteredCourses.length === 0 ? (
                        <EmptyState
                            title={searchTerm ? "Aucun résultat trouvé" : "Aucun cours disponible"}
                            description={searchTerm ? "Essayez un autre terme de recherche." : "Aucun cours disponible pour le moment."}
                            size="full"
                        />
                    ) : (
                        filteredCourses.map((course) => (
                            <Card key={course.id}>
                                <CardBody padding="lg">
                                    <Stack gap="md">
                                        {/* En-tête du cours */}
                                        <div className="pb-4 border-b border-gray-200">
                                            <Text as="h2" variant="sectionTitle">
                                                {course.code ? `${course.code} - ` : ''}{course.name}
                                            </Text>
                                            {course.instructor?.name && (
                                                <Text variant="caption" className="mt-1">
                                                    {dict.teacherLabel} : {course.instructor.name}
                                                </Text>
                                            )}
                                        </div>

                                        {/* Liste des examens du cours */}
                                        <Stack gap="sm">
                                            <Text variant="label">{dict.examsSectionLabel}</Text>
                                            {course.exams.length === 0 ? (
                                                <Text variant="caption" className="italic">Aucun examen pour ce cours.</Text>
                                            ) : (
                                                <Stack gap="sm">
                                                    {course.exams.map((exam) => {
                                                        const attempt = exam.attempts[0]
                                                        const now = new Date()
                                                        const startAt = new Date(exam.startAt)
                                                        const endAt = getExamEndAt(exam.startAt, exam.durationMinutes, exam.endAt)

                                                        const isStarted = !!attempt
                                                        const isInProgressAttempt = attempt?.status === 'IN_PROGRESS'
                                                        const isSubmitted = attempt?.status === 'SUBMITTED' || attempt?.status === 'GRADED' || attempt?.status === 'GRADING_IN_PROGRESS'
                                                        const isGraded = attempt?.status === 'GRADED'
                                                        const isBeforeStart = now < startAt
                                                        const isAfterEnd = endAt && now > endAt
                                                        const isWithinWindow = !isBeforeStart && !isAfterEnd
                                                        const isArchived = Boolean(exam.archivedAt)
                                                        const releaseInfo = getCorrectionReleaseInfo({
                                                            gradingConfig: exam.gradingConfig,
                                                            startAt,
                                                            durationMinutes: exam.durationMinutes,
                                                            endAt,
                                                        })
                                                        const canViewCorrection = Boolean(isSubmitted && (isAfterEnd || isArchived) && isGraded && releaseInfo.isReleased)
                                                        const score = attempt?.score
                                                        const maxPoints = attempt?.maxPoints

                                                        let statusLabel = "Non démarré"
                                                        let statusVariant: 'neutral' | 'info' | 'success' | 'warning' = 'neutral'
                                                        let actionButton = null

                                                        // Handle archived exams first
                                                        if (isArchived) {
                                                            statusLabel = isGraded && canViewCorrection ? dict.statusCorrected : (isSubmitted ? dict.statusSubmitted : "Archivé")
                                                            statusVariant = canViewCorrection ? 'success' : 'neutral'
                                                            actionButton = isSubmitted && attempt ? (
                                                                <Link href={`/student/attempts/${attempt.id}/results`}>
                                                                    <Button variant="secondary" size="sm">
                                                                        {dict.viewGradedCopyButton}
                                                                    </Button>
                                                                </Link>
                                                            ) : (
                                                                <Text variant="caption" className="italic text-gray-400">Examen archivé</Text>
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
                                                                    attemptId={attempt.id}
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
                                                                                    {dict.statusAvailable}
                                                                                </Badge>
                                                                                <Stack gap="xs">
                                                                                    <Text variant="caption">
                                                                                        {course.code} - {course.name}
                                                                                    </Text>
                                                                                    <Text as="h3" variant="sectionTitle">
                                                                                        {exam.title}
                                                                                    </Text>
                                                                                </Stack>
                                                                                <Stack gap="xs">
                                                                                    <Text variant="muted">{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</Text>
                                                                                    <Text variant="muted">{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</Text>
                                                                                    {endAt && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                                                </Stack>
                                                                            </Stack>
                                                                            <div className="flex-shrink-0">
                                                                                {actionButton}
                                                                            </div>
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
                                                                                    {dict.statusInProgress}
                                                                                </Badge>
                                                                                <Stack gap="xs">
                                                                                    <Text variant="caption">
                                                                                        {course.code} - {course.name}
                                                                                    </Text>
                                                                                    <Text as="h3" variant="sectionTitle">
                                                                                        {exam.title}
                                                                                    </Text>
                                                                                </Stack>
                                                                                <Stack gap="xs">
                                                                                    <Text variant="muted">{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</Text>
                                                                                    <Text variant="muted">{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</Text>
                                                                                    {endAt && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                                                </Stack>
                                                                            </Stack>
                                                                            <div className="flex-shrink-0">
                                                                                {actionButton}
                                                                            </div>
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
                                                                            <Text as="h3" variant="sectionTitle">{exam.title}</Text>
                                                                            <Stack gap="xs">
                                                                                <Text variant="muted">{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</Text>
                                                                                <Text variant="muted">{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</Text>
                                                                                {endAt && !isArchived && <Text variant="muted">Fin : {endAt.toLocaleString(localeString)}</Text>}
                                                                            </Stack>
                                                                        </Stack>
                                                                        <div className="flex-shrink-0">
                                                                            {actionButton}
                                                                        </div>
                                                                    </div>
                                                                </CardBody>
                                                            </Card>
                                                        )
                                                    })}
                                                </Stack>
                                            )}
                                        </Stack>
                                    </Stack>
                                </CardBody>
                            </Card>
                        ))
                    )}
                </Stack>
            </Stack>
        </div>
    )
}

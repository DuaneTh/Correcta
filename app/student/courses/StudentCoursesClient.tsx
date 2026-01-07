"use client"

import { useState } from "react"
import Link from "next/link"
import { getExamEndAt } from "@/lib/exam-time"
import { getCorrectionReleaseInfo } from "@/lib/correction-release"
import StartExamButton from "@/app/student/components/StartExamButton"
import type { Dictionary } from "@/lib/i18n/dictionaries"

type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'GRADING_IN_PROGRESS'

interface ExamWithDetails {
    id: string
    title: string
    startAt: Date
    endAt: Date | null
    durationMinutes: number
    gradingConfig?: Record<string, unknown> | null
    attempts: Array<{
        id: string
        status: AttemptStatus
        startedAt: Date
        submittedAt: Date | null
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
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-brand-900 mb-4">{dict.title}</h1>

                {/* Barre de recherche */}
                <div className="w-full">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={dict.searchPlaceholder}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-500"
                    />
                </div>
            </div>

            <div className="grid gap-8">
                {filteredCourses.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">
                            {searchTerm
                                ? "Aucun résultat trouvé pour votre recherche."
                                : "Aucun cours disponible pour le moment."}
                        </p>
                    </div>
                ) : (
                    filteredCourses.map((course) => (
                        <div key={course.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            {/* En-tête du cours */}
                            <div className="mb-4 pb-4 border-b border-gray-200">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {course.code ? `${course.code} - ` : ''}{course.name}
                                </h2>
                                {course.instructor?.name && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {dict.teacherLabel} : {course.instructor.name}
                                    </p>
                                )}
                            </div>

                            {/* Liste des examens du cours */}
                            <div className="space-y-4">
                                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <span>{dict.examsSectionLabel}</span>
                                </h4>
                                {course.exams.length === 0 ? (
                                    <p className="text-gray-500 text-sm italic">Aucun examen pour ce cours.</p>
                                ) : (
                                    course.exams.map((exam) => {
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
                                        const releaseInfo = getCorrectionReleaseInfo({
                                            gradingConfig: exam.gradingConfig,
                                            startAt,
                                            durationMinutes: exam.durationMinutes,
                                            endAt,
                                        })
                                        const canViewCorrection = Boolean(isSubmitted && isAfterEnd && isGraded && releaseInfo.isReleased)

                                        let statusLabel = "Non démarré"
                                        let statusColor = "bg-gray-100 text-gray-800"
                                        let actionButton = null

                                        if (isBeforeStart) {
                                            statusLabel = dict.statusUpcoming
                                            statusColor = "bg-yellow-100 text-yellow-800"
                                            actionButton = (
                                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed text-sm">
                                                    {dict.notAvailableYetButton}
                                                </button>
                                            )
                                        } else if (isSubmitted) {
                                            statusLabel = canViewCorrection ? dict.statusCorrected : dict.statusSubmitted
                                            statusColor = canViewCorrection ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-brand-50 text-brand-900 border border-brand-700"
                                            actionButton = (
                                                <div className="flex flex-col gap-2">
                                                    <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed text-sm">
                                                        {dict.submittedExamButton}
                                                    </button>
                                                    {canViewCorrection ? (
                                                        <Link
                                                            href={`/student/attempts/${attempt.id}/results`}
                                                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                                        >
                                                            {dict.viewGradedCopyButton}
                                                        </Link>
                                                    ) : (
                                                        !isAfterEnd && (
                                                            <p className="text-xs text-gray-500">
                                                                {dict.correctionAfterWindowLabel}
                                                            </p>
                                                        )
                                                    )}
                                                </div>
                                            )
                                        } else if (isAfterEnd) {
                                            statusLabel = dict.statusExpired
                                            statusColor = "bg-red-100 text-red-800"
                                            actionButton = (
                                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed text-sm">
                                                    {dict.windowClosedButton}
                                                </button>
                                            )
                                        } else if (isInProgressAttempt && isWithinWindow) {
                                            statusLabel = dict.statusInProgress
                                            statusColor = "bg-blue-100 text-blue-800"
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
                                            statusColor = "bg-green-100 text-green-800"
                                            actionButton = (
                                                <StartExamButton
                                                    examId={exam.id}
                                                    label={dictionary.student.nextExamPage.availableExam.startButton}
                                                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-900 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-900"
                                                />
                                            )
                                        } else {
                                            actionButton = (
                                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed text-sm">
                                                    Non disponible
                                                </button>
                                            )
                                        }

                                        if (isInProgressAttempt && isWithinWindow) {
                                            return (
                                                <div
                                                    key={exam.id}
                                                    className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                                                >
                                                    <div className="space-y-2">
                                                        <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white bg-brand-900 border border-brand-900">
                                                            {dict.statusAvailable}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm text-gray-500">
                                                                {course.code} - {course.name}
                                                            </p>
                                                            <h3 className="text-lg font-semibold text-gray-900">
                                                                {exam.title}
                                                            </h3>
                                                        </div>
                                                        <div className="text-sm text-gray-600 space-y-1">
                                                            <p>{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</p>
                                                            <p>{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</p>
                                                            {endAt && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {actionButton}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        if (!isStarted && isWithinWindow) {
                                            return (
                                                <div
                                                    key={exam.id}
                                                    className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                                                >
                                                    <div className="space-y-2">
                                                        <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white bg-brand-900 border border-brand-900">
                                                            {dict.statusInProgress}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm text-gray-500">
                                                                {course.code} - {course.name}
                                                            </p>
                                                            <h3 className="text-lg font-semibold text-gray-900">
                                                                {exam.title}
                                                            </h3>
                                                        </div>
                                                        <div className="text-sm text-gray-600 space-y-1">
                                                            <p>{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</p>
                                                            <p>{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</p>
                                                            {endAt && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {actionButton}
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={exam.id} className="bg-gray-50 p-4 rounded-md border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{exam.title}</h3>
                                                    <div className="text-sm text-gray-600 space-y-1">
                                                        <p>{dict.examMeta.durationLabel} : {exam.durationMinutes} minutes</p>
                                                        <p>{dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}</p>
                                                        {endAt && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {actionButton}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

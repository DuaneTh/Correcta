'use client'

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getExamEndAt } from "@/lib/exam-time"
import { getCorrectionReleaseInfo } from "@/lib/correction-release"
import StartExamButton from "./StartExamButton"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import type { Locale } from "@/lib/i18n/config"

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
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-brand-900 mb-4">{dictionary.student.header.exams}</h1>

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

            <div className="grid gap-6">
                {filteredExams.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">
                            {searchTerm
                                ? "Aucun r?sultat trouv? pour votre recherche."
                                : "Aucun examen disponible pour le moment."}
                        </p>
                    </div>
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
                        let statusColor = "bg-gray-100 text-gray-800"
                        let actionButton = null

                        // Handle archived exams - they can only be viewed for results
                        if (isArchived) {
                            statusLabel = isSubmitted ? (canViewCorrection ? dict.statusCorrected : dict.statusSubmitted) : "Archive"
                            statusColor = isSubmitted
                                ? (canViewCorrection ? "bg-emerald-50 text-emerald-900 border border-emerald-200" : "bg-gray-100 text-gray-600")
                                : "bg-gray-100 text-gray-500"
                            actionButton = isSubmitted && attempt ? (
                                <Link
                                    href={`/student/attempts/${attempt.id}/results`}
                                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                                >
                                    {dict.viewGradedCopyButton}
                                </Link>
                            ) : (
                                <span className="text-sm text-gray-400 italic">Examen archive</span>
                            )
                        } else if (isBeforeStart) {
                            statusLabel = dict.statusUpcoming
                            statusColor = "bg-yellow-100 text-yellow-800"
                            actionButton = (
                                <button disabled className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed text-sm">
                                    {dict.notAvailableYetButton}
                                </button>
                            )
                        } else if (isSubmitted) {
                            statusLabel = canViewCorrection ? dict.statusCorrected : dict.statusSubmitted
                            statusColor = canViewCorrection
                                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                                : "bg-brand-50 text-brand-900 border border-brand-700"
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
                                            {dict.statusInProgress}
                                        </span>
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                {exam.course.code} - {exam.course.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {dict.teacherLabel} : {instructorName}
                                            </p>
                                            <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>
                                                {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                            </p>
                                            <p>
                                                {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                            </p>
                                            {endAt && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">{actionButton}</div>
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
                                            {dict.statusAvailable}
                                        </span>
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                {exam.course.code} - {exam.course.name}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {dict.teacherLabel} : {instructorName}
                                            </p>
                                            <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p>
                                                {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                            </p>
                                            <p>
                                                {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                            </p>
                                            {endAt && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">{actionButton}</div>
                                </div>
                            )
                        }

                        return (
                            <div
                                key={exam.id}
                                className={`bg-gray-50 p-4 rounded-md border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isArchived ? 'opacity-70' : ''}`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                                            {statusLabel}
                                        </span>
                                        {canViewCorrection && score !== null && score !== undefined && maxPoints ? (
                                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-brand-100 text-brand-900 border border-brand-200">
                                                {score} / {maxPoints}
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {exam.course.code} - {exam.course.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {dict.teacherLabel} : {instructorName}
                                    </p>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{exam.title}</h3>
                                    <div className="text-sm text-gray-600 space-y-1">
                                        <p>
                                            {dict.examMeta.durationLabel} : {exam.durationMinutes} minutes
                                        </p>
                                        <p>
                                            {dict.examMeta.startLabel} : {new Date(exam.startAt).toLocaleString(localeString)}
                                        </p>
                                        {endAt && !isArchived && <p>Fin : {endAt.toLocaleString(localeString)}</p>}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">{actionButton}</div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

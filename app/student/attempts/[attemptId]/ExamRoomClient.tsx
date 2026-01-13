
"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import type { Dictionary } from "@/lib/i18n/dictionaries"
import MathRenderer from "@/components/exams/MathRenderer"
import ExamChangeLog from "@/components/exams/ExamChangeLog"
import StringMathField from "@/components/exams/StringMathField"
import { ContentSegment, StudentToolsConfig, StudentMathSymbolSet, ExamChange } from "@/types/exams"
import { parseContent, segmentsToPlainText, serializeContent } from "@/lib/content"
import { getCsrfToken } from "@/lib/csrfClient"

type Segment = {
    id: string
    questionId: string
    instruction: string
    maxPoints: number | null
    order?: number
}

type Question = {
    id: string
    content: ContentSegment[]
    answerTemplate?: ContentSegment[]
    answerTemplateLocked?: boolean
    studentTools?: StudentToolsConfig | null
    shuffleOptions?: boolean
    type: "TEXT" | "MCQ" | "CODE"
    order: number
    customLabel?: string | null
    requireAllCorrect?: boolean
    maxPoints?: number | null
    segments: Segment[]
}

type Section = {
    id: string
    title: string
    order: number
    isDefault?: boolean
    customLabel?: string | null
    introContent?: ContentSegment[] | string | null
    questions: Question[]
}

type AnswerSegment = {
    segmentId: string
    content: string
}

type ExamData = {
    id: string
    title: string
    startAt: string | null
    durationMinutes: number | null
    course: {
        code: string
        name: string
        teacherName?: string | null
    }
    author?: {
        id: string
        name: string | null
        email: string
    } | null
    requireHonorCommitment?: boolean
    allowedMaterials?: string | null
    changes?: ExamChange[]
    sections: Section[]
}

type AttemptData = {
    id: string
    status: string
    startedAt: string
    submittedAt: string | null
    deadlineAt: string
    honorStatementText?: string | null
    nonce?: string
    answers: {
        segments: AnswerSegment[]
    }[]
}
const defaultStudentTools: StudentToolsConfig = {
    math: { enabled: true, symbolSet: "full" },
    table: { enabled: true, maxRows: null, maxCols: null, allowMath: true },
    graph: {
        enabled: true,
        allowPoints: true,
        allowLines: true,
        allowCurves: true,
        allowFunctions: true,
        allowAreas: true,
        allowText: true,
    },
}

const normalizeStudentTools = (tools?: StudentToolsConfig | null): StudentToolsConfig => ({
    math: {
        enabled: tools?.math?.enabled ?? defaultStudentTools.math?.enabled,
        symbolSet: tools?.math?.symbolSet ?? defaultStudentTools.math?.symbolSet,
    },
    table: {
        enabled: tools?.table?.enabled ?? defaultStudentTools.table?.enabled,
        maxRows: tools?.table?.maxRows ?? defaultStudentTools.table?.maxRows,
        maxCols: tools?.table?.maxCols ?? defaultStudentTools.table?.maxCols,
        allowMath: tools?.table?.allowMath ?? defaultStudentTools.table?.allowMath,
    },
    graph: {
        enabled: tools?.graph?.enabled ?? defaultStudentTools.graph?.enabled,
        allowPoints: tools?.graph?.allowPoints ?? defaultStudentTools.graph?.allowPoints,
        allowLines: tools?.graph?.allowLines ?? defaultStudentTools.graph?.allowLines,
        allowCurves: tools?.graph?.allowCurves ?? defaultStudentTools.graph?.allowCurves,
        allowFunctions: tools?.graph?.allowFunctions ?? defaultStudentTools.graph?.allowFunctions,
        allowAreas: tools?.graph?.allowAreas ?? defaultStudentTools.graph?.allowAreas,
        allowText: tools?.graph?.allowText ?? defaultStudentTools.graph?.allowText,
    },
})

const basicMathQuickSymbols = [
    { label: "a/b", latex: "\\frac{#@}{#0}" },
    { label: "\u221A", latex: "\\sqrt{#0}" },
    { label: "x^", latex: "^{#0}" },
    { label: "x_", latex: "_{#0}" },
    { label: "\u03C0", latex: "\\pi" },
    { label: "\u221E", latex: "\\infty" },
    { label: "\u2264", latex: "\\leq" },
    { label: "\u2265", latex: "\\geq" },
    { label: "\u2260", latex: "\\neq" },
    { label: "\u00D7", latex: "\\times" },
    { label: "\u00B1", latex: "\\pm" },
]

const resolveMathQuickSymbols = (symbolSet?: StudentMathSymbolSet) =>
    symbolSet === "basic" ? basicMathQuickSymbols : undefined

const sortByOrder = <T extends { order?: number }>(items: T[]) =>
    [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

const honorStatementFr =
    "je m'engage sur l'honneur a faire cet examen seul, sans aucune aide d'autrui, sans consulter aucun document (sauf mention contraire), et a ne pas partager mes reponses avec d'autres etudiants."
const honorStatementEn =
    "i commit on my honor to take this exam alone, without any help from others, without consulting any documents (unless otherwise stated), and not to share my answers with other students."

const normalizeHonorText = (value: string) =>
    value
        .replace(/[“”«»]/g, "\"")
        .replace(/[’‘]/g, "'")
        .trim()
        .replace(/^["']|["']$/g, "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim()

const honorStatementFrNormalized = normalizeHonorText(honorStatementFr)
const honorStatementEnNormalized = normalizeHonorText(honorStatementEn)

const isHonorStatementValid = (value: string) => {
    const normalized = normalizeHonorText(value)
    if (!normalized) return false
    return normalized === honorStatementFrNormalized || normalized === honorStatementEnNormalized
}

const hashString = (value: string) => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash)
}

const seededShuffle = <T,>(items: T[], seed: number) => {
    const result = [...items]
    let nextSeed = seed || 1
    const random = () => {
        nextSeed = (nextSeed * 9301 + 49297) % 233280
        return nextSeed / 233280
    }
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

interface ExamRoomClientProps {
    attempt: AttemptData
    exam: ExamData
    studentName?: string | null
    dictionary: Dictionary
    locale?: string
}

export default function ExamRoomClient({
    attempt,
    exam,
    studentName,
    dictionary,
    locale = "fr"
}: ExamRoomClientProps) {
    const router = useRouter()
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [savingStatus, setSavingStatus] = useState<Record<string, "saved" | "saving" | "error" | null>>({})
    const [timeLeft, setTimeLeft] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [honorText, setHonorText] = useState("")
    const [honorTouched, setHonorTouched] = useState(false)
    const [showStickyHeader, setShowStickyHeader] = useState(false)
    const [pendingSubmit, setPendingSubmit] = useState(false)

    const saveTimeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})
    const prefilledTemplateRef = useRef<Set<string>>(new Set())
    const honorSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const dict = dictionary.student.examRunner
    const honorStorageKey = `attempt:${attempt.id}:honorStatement`
    const examHeaderRef = useRef<HTMLDivElement | null>(null)
    const confirmSubmitLabel = locale === "fr" ? "Confirmer" : "Confirm"

    useEffect(() => {
        const initialAnswers: Record<string, string> = {}
        attempt.answers.forEach(ans => {
            ans.segments.forEach(seg => {
                initialAnswers[seg.segmentId] = seg.content
            })
        })
        setAnswers(initialAnswers)
    }, [attempt])

    const timeExpired = timeLeft !== null && timeLeft <= 0
    const honorRequired = exam.requireHonorCommitment !== false
    const honorValid = honorRequired ? isHonorStatementValid(honorText) : true
    const honorLocked = honorRequired && !honorValid
    const answerEditingLocked = timeExpired || isSubmitting || honorLocked

    const buildIntegrityHeaders = async () => {
        const csrfToken = await getCsrfToken()
        const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
        return {
            'x-csrf-token': csrfToken,
            'x-attempt-nonce': attempt.nonce ?? '',
            'x-request-id': requestId
        }
    }

    useEffect(() => {
        if (pendingSubmit && (isSubmitting || timeExpired || honorLocked)) {
            setPendingSubmit(false)
        }
    }, [pendingSubmit, isSubmitting, timeExpired, honorLocked])

    useEffect(() => {
        getCsrfToken().catch(() => {
            // CSRF token will be fetched lazily on mutation
        })
    }, [])

    useEffect(() => {
        if (!pendingSubmit) return
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null
            if (target?.closest('[data-submit-confirm-group="true"]')) {
                return
            }
            setPendingSubmit(false)
        }
        document.addEventListener("mousedown", handleOutsideClick)
        return () => document.removeEventListener("mousedown", handleOutsideClick)
    }, [pendingSubmit])

    const saveHonorStatement = useCallback((value: string) => {
        if (!honorRequired) return
        if (honorSaveTimeoutRef.current) {
            clearTimeout(honorSaveTimeoutRef.current)
        }
        honorSaveTimeoutRef.current = setTimeout(async () => {
            try {
                const integrityHeaders = await buildIntegrityHeaders()
                await fetch(`/api/attempts/${attempt.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...integrityHeaders
                    },
                    body: JSON.stringify({
                        honorStatementText: value
                    })
                })
            } catch (error) {
                console.error("Honor statement save error:", error)
            }
        }, 800)
    }, [attempt.id, honorRequired])

    useEffect(() => {
        if (attempt.honorStatementText) {
            setHonorText(attempt.honorStatementText)
            if (typeof window !== "undefined") {
                localStorage.setItem(honorStorageKey, attempt.honorStatementText)
            }
            return
        }
        if (typeof window === "undefined") return
        const cachedHonorText = localStorage.getItem(honorStorageKey)
        if (cachedHonorText) {
            setHonorText(cachedHonorText)
            saveHonorStatement(cachedHonorText)
        }
    }, [attempt.honorStatementText, honorStorageKey, saveHonorStatement])

    const handleAutoSubmit = useCallback(async () => {
        if (isSubmitting) return

        setIsSubmitting(true)
        try {
            const integrityHeaders = await buildIntegrityHeaders()
            await fetch(`/api/attempts/${attempt.id}/submit`, {
                method: "POST",
                headers: integrityHeaders
            })
            window.location.href = "/student/exams"
        } catch (error) {
            console.error("Auto-submit error:", error)
            window.location.href = "/student/exams"
        }
    }, [attempt.id, isSubmitting])

    useEffect(() => {
        if (!attempt.deadlineAt) return

        const deadlineAt = new Date(attempt.deadlineAt).getTime()

        const interval = setInterval(() => {
            const now = Date.now()
            const remaining = Math.max(0, Math.ceil((deadlineAt - now) / 1000))
            setTimeLeft(remaining)

            if (remaining <= 0) {
                clearInterval(interval)
                handleAutoSubmit()
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [attempt.deadlineAt, handleAutoSubmit])

    useEffect(() => {
        const updateStickyVisibility = () => {
            if (!examHeaderRef.current) return
            const rect = examHeaderRef.current.getBoundingClientRect()
            const headerBottom = rect.top + window.scrollY + rect.height
            setShowStickyHeader(window.scrollY > headerBottom - 8)
        }
        updateStickyVisibility()
        window.addEventListener("scroll", updateStickyVisibility)
        window.addEventListener("resize", updateStickyVisibility)
        return () => {
            window.removeEventListener("scroll", updateStickyVisibility)
            window.removeEventListener("resize", updateStickyVisibility)
        }
    }, [])

    const handleAnswerChange = useCallback((questionId: string, segmentId: string, content: string) => {
        setAnswers(prev => ({ ...prev, [segmentId]: content }))
        setSavingStatus(prev => ({ ...prev, [segmentId]: "saving" }))

        if (saveTimeoutRefs.current[segmentId]) {
            clearTimeout(saveTimeoutRefs.current[segmentId])
        }

        saveTimeoutRefs.current[segmentId] = setTimeout(async () => {
            try {
                const integrityHeaders = await buildIntegrityHeaders()
                const res = await fetch(`/api/attempts/${attempt.id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        ...integrityHeaders
                    },
                    body: JSON.stringify({
                        questionId,
                        segmentId,
                        content
                    })
                })

                if (res.ok) {
                    setSavingStatus(prev => ({ ...prev, [segmentId]: "saved" }))
                } else {
                    setSavingStatus(prev => ({ ...prev, [segmentId]: "error" }))
                }
            } catch (error) {
                console.error("Autosave error:", error)
                setSavingStatus(prev => ({ ...prev, [segmentId]: "error" }))
            }
        }, 1000)
    }, [attempt.id])

    useEffect(() => {
        exam.sections.forEach((section) => {
            section.questions.forEach((question) => {
                if (question.answerTemplateLocked && !question.answerTemplate?.length) {
                    return
                }
                const templateSegments = question.answerTemplate || []
                if (segmentsToPlainText(templateSegments).trim().length === 0) {
                    return
                }
                const firstSegmentId = sortByOrder(question.segments)[0]?.id
                if (!firstSegmentId) return
                if (prefilledTemplateRef.current.has(firstSegmentId)) return
                const existing = answers[firstSegmentId]
                if (existing && existing.trim().length > 0) return
                prefilledTemplateRef.current.add(firstSegmentId)
                handleAnswerChange(question.id, firstSegmentId, serializeContent(templateSegments))
            })
        })
    }, [answers, exam.sections, handleAnswerChange])

    const handleSubmit = async () => {
        if (exam.requireHonorCommitment !== false && !isHonorStatementValid(honorText)) {
            setHonorTouched(true)
            alert(locale === "fr"
                ? "Veuillez recopier correctement la déclaration sur l'honneur avant de soumettre."
                : "Please copy the honor statement correctly before submitting.")
            return
        }
        setIsSubmitting(true)

        try {
            const integrityHeaders = await buildIntegrityHeaders()
            const res = await fetch(`/api/attempts/${attempt.id}/submit`, {
                method: "POST",
                headers: integrityHeaders
            })

            if (res.ok) {
                window.location.href = "/student/exams"
            } else {
                const data = await res.json()
                alert(data.error || dict.actions.submitErrorMessage)
                setIsSubmitting(false)
            }
        } catch (error) {
            console.error("[DEBUG] Submission error:", error)
            alert(dict.actions.submitNetworkError)
            setIsSubmitting(false)
        }
    }

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h > 0 ? `${h}h ` : ""}${m}m ${s}s`
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return locale === "fr" ? "Non planifié" : "Not scheduled"
        const date = new Date(dateString)
        return date.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
            dateStyle: "long",
            timeStyle: "short"
        })
    }


    const sortedSections = useMemo(() => sortByOrder(exam.sections), [exam.sections])

    if (attempt.status !== "IN_PROGRESS") {
        return (
            <div className="max-w-4xl mx-auto py-12 text-center">
                <h1 className="text-2xl font-bold mb-4">{dict.states.finishedTitle}</h1>
                <p className="text-gray-600">{dict.states.finishedMessage}</p>
                <button
                    onClick={() => router.push("/student/exams")}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    {dict.actions.backToListButton}
                </button>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 pb-24 space-y-6">
            {showStickyHeader && (
                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border border-gray-200 rounded-md px-4 py-3 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">
                            {locale === "fr" ? "Examen en cours" : "Exam in progress"}
                        </div>
                        <div className="text-lg font-semibold text-gray-900">{exam.title || dict.header.titleFallback}</div>
                        <div className="text-sm text-gray-600">
                            {dict.header.timeRemainingLabel} {timeLeft !== null ? formatTime(timeLeft) : "..."}
                        </div>
                    </div>
                    {!timeExpired && (
                        <div className="flex items-center gap-2" data-submit-confirm-group="true">
                            <button
                                onClick={async () => {
                                    if (pendingSubmit) {
                                        await handleSubmit()
                                        setPendingSubmit(false)
                                    } else {
                                        setPendingSubmit(true)
                                    }
                                }}
                                disabled={isSubmitting || honorLocked}
                                className="px-5 py-2 rounded-md bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting
                                    ? dict.header.submittingButton
                                    : pendingSubmit
                                        ? confirmSubmitLabel
                                        : dict.header.submitButton}
                            </button>
                            {pendingSubmit && (
                                <button
                                    type="button"
                                    onClick={() => setPendingSubmit(false)}
                                    className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                    {locale === "fr" ? "Annuler" : "Cancel"}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {timeExpired && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 font-medium">{dict.timer.timeExpiredMessage}</p>
                </div>
            )}

            <div className="bg-white rounded-md shadow-sm border border-gray-200">
                <div ref={examHeaderRef} className="p-6 pb-4 border-b border-gray-100">
                    <div className="flex flex-wrap items-start justify-between gap-4 text-sm text-gray-700">
                        <div className="space-y-1">
                            <div className="font-semibold text-gray-900">
                                {exam.course.code} - {exam.course.name}
                            </div>
                            <div>
                                {locale === "fr" ? "Professeur :" : "Teacher:"}{" "}
                                {exam.course.teacherName || exam.author?.name || (locale === "fr" ? "Non renseigné" : "Not provided")}
                            </div>
                            <div>
                                {locale === "fr" ? "Étudiant :" : "Student:"} {studentName || (locale === "fr" ? "Nom Prénom" : "Firstname Lastname")}
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <div>{formatDate(exam.startAt)}</div>
                            <div>
                                {locale === "fr" ? "Durée :" : "Duration:"}{" "}
                                {exam.durationMinutes ? `${exam.durationMinutes} ${locale === "fr" ? "minutes" : "minutes"}` : (locale === "fr" ? "Non défini" : "Not defined")}
                            </div>
                            <div className="font-medium">
                                {dict.header.timeRemainingLabel} {timeLeft !== null ? formatTime(timeLeft) : "..."}
                            </div>
                            {!timeExpired && (
                                <div className="mt-2 flex items-center justify-end gap-2" data-submit-confirm-group="true">
                                    <button
                                        onClick={async () => {
                                            if (pendingSubmit) {
                                                await handleSubmit()
                                                setPendingSubmit(false)
                                            } else {
                                                setPendingSubmit(true)
                                            }
                                        }}
                                        disabled={isSubmitting || honorLocked}
                                        className="px-5 py-2 rounded-md bg-brand-900 text-white text-sm font-semibold hover:bg-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting
                                            ? dict.header.submittingButton
                                            : pendingSubmit
                                                ? confirmSubmitLabel
                                                : dict.header.submitButton}
                                    </button>
                                    {pendingSubmit && (
                                        <button
                                            type="button"
                                            onClick={() => setPendingSubmit(false)}
                                            className="text-xs text-gray-500 hover:text-gray-700"
                                        >
                                            {locale === "fr" ? "Annuler" : "Cancel"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 text-center mt-6">{exam.title}</h1>
                </div>

                {exam.changes && exam.changes.length > 0 && (
                    <div className="px-4 pt-4">
                        <ExamChangeLog changes={exam.changes} locale={locale} />
                    </div>
                )}

                {exam.allowedMaterials && (
                    <div className="p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                            {exam.allowedMaterials}
                        </p>
                    </div>
                )}

                {exam.requireHonorCommitment !== false && (
                    <div className="p-4 border-t border-gray-200">
                        <div className="mb-3">
                            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                {locale === "fr"
                                    ? "Avant de commencer cet examen, vous devez vous engager à respecter le code d'honneur en copiant la déclaration suivante :\n\n\"Je m'engage sur l'honneur à faire cet examen seul, sans aucune aide d'autrui, sans consulter aucun document (sauf mention contraire), et à ne pas partager mes réponses avec d'autres étudiants.\""
                                    : "Before starting this exam, you must commit to respecting the honor code by copying the following statement:\n\n\"I commit on my honor to take this exam alone, without any help from others, without consulting any documents (unless otherwise stated), and not to share my answers with other students.\""}
                            </p>
                        </div>
                        <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                            <textarea
                                placeholder={locale === "fr" ? "Recopiez ici la déclaration sur l'honneur." : "Copy the honor statement here..."}
                                className="w-full min-h-[80px] text-sm text-gray-900 placeholder-gray-400 focus:outline-none resize-none bg-transparent"
                                value={honorText}
                                onChange={(event) => {
                                    const nextValue = event.target.value
                                    setHonorText(nextValue)
                                    if (typeof window !== "undefined") {
                                        localStorage.setItem(honorStorageKey, nextValue)
                                    }
                                    saveHonorStatement(nextValue)
                                    if (honorTouched) {
                                        setHonorTouched(false)
                                    }
                                }}
                                onBlur={() => {
                                    setHonorTouched(true)
                                    saveHonorStatement(honorText)
                                }}
                            />
                        </div>
                        {honorTouched && !honorValid && (
                            <p className="mt-2 text-xs font-medium text-red-600">
                                {locale === "fr"
                                    ? "La déclaration doit être recopiée exactement (français ou anglais)."
                                    : "The statement must be copied exactly (French or English)."}
                            </p>
                        )}
                        {honorValid && honorText.trim().length > 0 && (
                            <p className="mt-2 text-xs text-emerald-600">
                                {locale === "fr" ? "Déclaration validée." : "Statement validated."}
                            </p>
                        )}
                    </div>
                )}

                <div className={`relative ${honorLocked ? "cursor-not-allowed" : ""}`}>
                    {honorLocked && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-xs font-medium text-gray-700 bg-white/70 backdrop-blur-[1px] opacity-0 hover:opacity-100 transition-opacity">
                            {locale === "fr"
                                ? "Recopiez la déclaration sur l'honneur pour commencer."
                                : "Copy the honor statement to begin."}
                        </div>
                    )}
                    <div className={honorLocked ? "opacity-60" : ""}>
                        {sortedSections.length === 0 ? (
                            <div className="p-6 text-center border-t border-gray-200">
                                <p className="text-gray-500 italic text-sm">
                                    {locale === "fr" ? "Cet examen est vide pour le moment." : "This exam is empty for now."}
                                </p>
                            </div>
                        ) : (
                            (() => {
                                let globalQuestionIndex = 0
                                return sortedSections.map((section, sectionIndex) => {
                                    const sectionQuestions = sortByOrder(section.questions)
                                    const prevSection = sectionIndex > 0 ? sortedSections[sectionIndex - 1] : null
                                    const startsAfterPart = Boolean(section.isDefault && prevSection && !prevSection.isDefault)
                                    const sectionIntroContent = Array.isArray(section.introContent)
                                        ? section.introContent
                                        : parseContent(section.introContent || "")
                                    const hasSectionIntro = !section.isDefault && segmentsToPlainText(sectionIntroContent).trim().length > 0

                                    const isDefaultWithoutLabel = section.isDefault && !section.customLabel && !section.title

                                    const sectionTotalPoints = sectionQuestions.reduce((sectionSum, question) => {
                                        let questionPoints = 0
                                        if (question.type === "MCQ") {
                                            questionPoints = typeof question.maxPoints === "number"
                                                ? question.maxPoints
                                                : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)
                                        } else {
                                            questionPoints = question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)
                                        }
                                        return sectionSum + questionPoints
                                    }, 0)

                                    return (
                                        <div key={section.id}>
                                            {!isDefaultWithoutLabel && (
                                                <div className="p-4 border-t border-gray-200 bg-gray-50">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {section.customLabel && (
                                                                <span className="text-base font-semibold text-gray-900">
                                                                    {section.customLabel}
                                                                </span>
                                                            )}
                                                            {section.title && (
                                                                <span className="text-base font-medium text-gray-900">
                                                                    {section.title}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {sectionTotalPoints > 0 && (
                                                            <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                {sectionTotalPoints} {sectionTotalPoints === 1 ? (locale === "fr" ? "point" : "point") : (locale === "fr" ? "points" : "points")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {hasSectionIntro && (
                                                <div className="p-4 border-t border-gray-200">
                                                    <MathRenderer text={sectionIntroContent} className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                </div>
                                            )}

                                            {sectionQuestions.length === 0 ? (
                                                !isDefaultWithoutLabel && (
                                                    <div className="p-4 border-t border-gray-200">
                                                        <p className="text-gray-500 italic text-sm text-center">
                                                            {locale === "fr" ? "Aucune question dans cette partie." : "No questions in this section."}
                                                        </p>
                                                    </div>
                                                )
                                            ) : (
                                                sectionQuestions.map((question, questionIndex) => {
                                                    globalQuestionIndex += 1
                                                    const questionLabel = question.customLabel || `${globalQuestionIndex}.`
                                                    const hasContent = segmentsToPlainText(question.content || []).trim().length > 0
                                                    const questionText = hasContent
                                                        ? question.content
                                                        : parseContent(locale === "fr" ? "Question sans texte" : "Question without text")

                                            const answerTemplate = question.answerTemplate || []
                                            const hasAnswerTemplate = segmentsToPlainText(answerTemplate).trim().length > 0
                                            const answerTemplateLocked = question.answerTemplateLocked === true
                                            const shouldShowAnswerBox = hasAnswerTemplate || !answerTemplateLocked

                                            const totalPoints = question.type === "MCQ"
                                                ? (typeof question.maxPoints === "number"
                                                    ? question.maxPoints
                                                    : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0))
                                                : question.segments.reduce((sum, segment) => sum + (segment.maxPoints || 0), 0)

                                            const questionDividerClass =
                                                questionIndex === 0 && startsAfterPart
                                                    ? "border-t-2 border-gray-300"
                                                    : "border-t border-gray-200"

                                            if (question.type === "MCQ") {
                                                const orderedOptions = sortByOrder(question.segments)
                                                const displayOptions = question.shuffleOptions
                                                    ? seededShuffle(orderedOptions, hashString(`${attempt.id}:${question.id}`))
                                                    : orderedOptions
                                                const optionStatuses = displayOptions.map(option => savingStatus[option.id]).filter(Boolean)
                                                const mcqStatus = optionStatuses.includes("error")
                                                    ? "error"
                                                    : optionStatuses.includes("saving")
                                                        ? "saving"
                                                        : optionStatuses.includes("saved")
                                                            ? "saved"
                                                            : null

                                                return (
                                                    <div key={question.id} className={`p-4 ${questionDividerClass}`}>
                                                        <div className="mb-3 space-y-1">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <span className="text-base font-semibold text-gray-900">
                                                                    {questionLabel}
                                                                </span>
                                                                {totalPoints > 0 && (
                                                                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                        {totalPoints} {totalPoints === 1 ? (locale === "fr" ? "point" : "point") : (locale === "fr" ? "points" : "points")}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <MathRenderer text={questionText} className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                        </div>

                                                        <div className="mt-3 space-y-2">
                                                            {displayOptions.map((option, optionIndex) => {
                                                                const optionLetter = String.fromCharCode(65 + optionIndex)
                                                                const selectedValue = answers[option.id]
                                                                const isChecked = selectedValue === "true" || selectedValue === "1"
                                                                return (
                                                                    <label key={option.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded-md">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={isChecked}
                                                                            disabled={answerEditingLocked}
                                                                            onChange={(event) => handleAnswerChange(question.id, option.id, event.target.checked ? "true" : "")}
                                                                            className="mt-1 w-4 h-4 text-brand-900 border-gray-300 rounded focus:ring-brand-900"
                                                                        />
                                                                        <span className="text-base text-gray-900 flex-1">
                                                                            <span className="font-semibold mr-2">{optionLetter}.</span>
                                                                            <MathRenderer
                                                                                text={option.instruction || `${locale === "fr" ? "Option" : "Option"} ${optionIndex + 1}`}
                                                                                className="inline text-base text-gray-900 whitespace-pre-wrap leading-relaxed"
                                                                                tableScale="fit"
                                                                            />
                                                                        </span>
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>

                                                        {mcqStatus && (
                                                            <div className="mt-2 h-5 flex justify-end">
                                                                {mcqStatus === "saving" && (
                                                                    <span className="text-xs text-gray-500 italic">{dict.questions.saving}</span>
                                                                )}
                                                                {mcqStatus === "saved" && (
                                                                    <span className="text-xs text-green-600">{dict.questions.saved}</span>
                                                                )}
                                                                {mcqStatus === "error" && (
                                                                    <span className="text-xs text-red-600">{dict.questions.errorSaving}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            }

                                            const tools = normalizeStudentTools(question.studentTools)
                                            const mathEnabled = tools.math?.enabled !== false
                                            const tableEnabled = tools.table?.enabled !== false
                                            const graphEnabled = tools.graph?.enabled !== false
                                            const mathQuickSymbols = resolveMathQuickSymbols(tools.math?.symbolSet)
                                            const tableConfig = {
                                                maxRows: tools.table?.maxRows ?? null,
                                                maxCols: tools.table?.maxCols ?? null,
                                                allowMath: mathEnabled && tools.table?.allowMath !== false,
                                            }
                                            const graphConfig = {
                                                allowPoints: tools.graph?.allowPoints,
                                                allowLines: tools.graph?.allowLines,
                                                allowCurves: tools.graph?.allowCurves,
                                                allowFunctions: tools.graph?.allowFunctions,
                                                allowAreas: tools.graph?.allowAreas,
                                                allowText: tools.graph?.allowText,
                                            }

                                            return (
                                                <div key={question.id} className={`p-4 ${questionDividerClass}`}>
                                                    <div className="mb-3 space-y-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <span className="text-base font-semibold text-gray-900">
                                                                {questionLabel}
                                                            </span>
                                                            {totalPoints > 0 && (
                                                                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                                                                    {totalPoints} {totalPoints === 1 ? (locale === "fr" ? "point" : "point") : (locale === "fr" ? "points" : "points")}
                                                                </span>
                                                            )}
                                                        </div>
                                                                    <MathRenderer text={questionText} className="text-base text-gray-900 whitespace-pre-wrap leading-relaxed" tableScale="fit" />
                                                    </div>

                                                    {sortByOrder(question.segments).map((segment, segmentIndex) => (
                                                        <div key={segment.id} className="mt-4">
                                                            {segment.instruction && (
                                                                <div className="mb-2">
                                                                    <MathRenderer text={segment.instruction} className="block text-sm font-medium text-gray-700" />
                                                                </div>
                                                            )}
                                                            {shouldShowAnswerBox && (
                                                                <div className="rounded-md border border-gray-300 bg-gray-50">
                                                                    <div className="px-3 py-2">
                                                                        <StringMathField
                                                                            value={answers[segment.id] || ""}
                                                                            onChange={(value) => handleAnswerChange(question.id, segment.id, value)}
                                                                            disabled={answerEditingLocked}
                                                                            className="text-base text-gray-900"
                                                                            placeholder={dict.questions.answerPlaceholder}
                                                                            minRows={6}
                                                                            showMathButton={mathEnabled}
                                                                            showTableButton={tableEnabled}
                                                                            showGraphButton={graphEnabled}
                                                                            toolbarSize="md"
                                                                            mathQuickSymbols={mathQuickSymbols}
                                                                            tableConfig={tableConfig}
                                                                            graphConfig={graphConfig}
                                                                            locale={locale}
                                                                            toolbarRightSlot={(
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const message = locale === "fr"
                                                                                            ? "Confirmer la réinitialisation de la réponse ?"
                                                                                            : "Confirm resetting the answer?"
                                                                                        if (!window.confirm(message)) {
                                                                                            return
                                                                                        }
                                                                                        handleAnswerChange(
                                                                                            question.id,
                                                                                            segment.id,
                                                                                            hasAnswerTemplate && segmentIndex === 0 ? serializeContent(answerTemplate) : ""
                                                                                        )
                                                                                    }}
                                                                                    disabled={answerEditingLocked}
                                                                                    className="text-sm font-semibold px-3 py-1 rounded border border-brand-200 bg-brand-50 text-brand-900 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                >
                                                                                    {locale === "fr" ? "Réinitialiser" : "Reset"}
                                                                                </button>
                                                                            )}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="mt-1 h-5 flex justify-end">
                                                                {savingStatus[segment.id] === "saving" && (
                                                                    <span className="text-xs text-gray-500 italic">{dict.questions.saving}</span>
                                                                )}
                                                                {savingStatus[segment.id] === "saved" && (
                                                                    <span className="text-xs text-green-600">{dict.questions.saved}</span>
                                                                )}
                                                                {savingStatus[segment.id] === "error" && (
                                                                    <span className="text-xs text-red-600">{dict.questions.errorSaving}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                                })
                                            )}
                                        </div>
                                    )
                                })
                            })()
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

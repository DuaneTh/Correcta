"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

// Types based on what page.tsx provides
type Segment = {
    id: string
    questionId: string
    instruction: string
    maxPoints: number
}

type Question = {
    id: string
    content: string
    type: "TEXT" | "MCQ" | "CODE"
    order: number
    segments: Segment[]
}

type Section = {
    id: string
    title: string
    order: number
    questions: Question[]
}

type AnswerSegment = {
    segmentId: string
    content: string
}

type ExamData = {
    id: string
    title: string
    durationMinutes: number
    sections: Section[]
}

type AttemptData = {
    id: string
    status: string
    startedAt: string
    submittedAt: string | null
    deadlineAt: string
    answers: {
        segments: AnswerSegment[]
    }[]
}

interface ExamRoomClientProps {
    attempt: AttemptData
    exam: ExamData
}

export default function ExamRoomClient({ attempt, exam }: ExamRoomClientProps) {
    const router = useRouter()
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [savingStatus, setSavingStatus] = useState<Record<string, "saved" | "saving" | "error" | null>>({})
    const [timeLeft, setTimeLeft] = useState<number | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const saveTimeoutRefs = useRef<Record<string, NodeJS.Timeout>>({})

    // Initialize answers from attempt data
    useEffect(() => {
        const initialAnswers: Record<string, string> = {}
        attempt.answers.forEach(ans => {
            ans.segments.forEach(seg => {
                initialAnswers[seg.segmentId] = seg.content
            })
        })
        setAnswers(initialAnswers)
    }, [attempt])

    // Timer logic
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
    }, [attempt.deadlineAt])

    const handleAutoSubmit = async () => {
        if (isSubmitting) return

        setIsSubmitting(true)
        try {
            await fetch(`/api/attempts/${attempt.id}/submit`, {
                method: "POST"
            })
            window.location.href = "/student/exams"
        } catch (error) {
            console.error("Auto-submit error:", error)
            window.location.href = "/student/exams"
        }
    }

    const handleAnswerChange = (questionId: string, segmentId: string, content: string) => {
        setAnswers(prev => ({ ...prev, [segmentId]: content }))
        setSavingStatus(prev => ({ ...prev, [segmentId]: "saving" }))

        // Clear existing timeout
        if (saveTimeoutRefs.current[segmentId]) {
            clearTimeout(saveTimeoutRefs.current[segmentId])
        }

        // Set new timeout (debounce 1s)
        saveTimeoutRefs.current[segmentId] = setTimeout(async () => {
            try {
                const res = await fetch(`/api/attempts/${attempt.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
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
    }

    const handleSubmit = async () => {
        console.log("[DEBUG] handleSubmit called")

        if (!window.confirm("Êtes-vous sûr de vouloir soumettre votre copie ? Vous ne pourrez plus la modifier.")) {
            console.log("[DEBUG] User cancelled submission")
            return
        }

        console.log("[DEBUG] User confirmed, starting submission...")
        setIsSubmitting(true)

        try {
            console.log(`[DEBUG] Calling POST /api/attempts/${attempt.id}/submit`)
            const res = await fetch(`/api/attempts/${attempt.id}/submit`, {
                method: "POST"
            })

            console.log("[DEBUG] Response status:", res.status)

            if (res.ok) {
                console.log("[DEBUG] Submission successful, redirecting...")
                window.location.href = "/student/exams"
            } else {
                const data = await res.json()
                console.log("[DEBUG] Submission failed:", data)
                alert(data.error || "Erreur lors de la soumission. Veuillez réessayer.")
                setIsSubmitting(false)
            }
        } catch (error) {
            console.error("[DEBUG] Submission error:", error)
            alert("Erreur réseau lors de la soumission.")
            setIsSubmitting(false)
        }
    }

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
    }

    if (attempt.status !== 'IN_PROGRESS') {
        return (
            <div className="max-w-4xl mx-auto py-12 text-center">
                <h1 className="text-2xl font-bold mb-4">Examen terminé</h1>
                <p className="text-gray-600">Cet examen a déjà été soumis.</p>
                <button
                    onClick={() => router.push("/student/exams")}
                    className="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    Retour à la liste
                </button>
            </div>
        )
    }

    const timeExpired = timeLeft !== null && timeLeft <= 0

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 pb-24">
            {/* Header / Timer */}
            <div className="sticky top-0 bg-white z-10 py-4 border-b mb-8 flex justify-between items-center shadow-sm">
                <div>
                    <h1 className="text-xl font-bold">{exam.title}</h1>
                    <p className="text-sm text-gray-500">
                        Temps restant : {timeLeft !== null ? formatTime(timeLeft) : "..."}
                    </p>
                </div>
                {!timeExpired && (
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Envoi..." : "Soumettre l'examen"}
                    </button>
                )}
            </div>

            {/* Time Expired Message */}
            {timeExpired && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 font-medium">⏱️ Temps écoulé, envoi de votre copie...</p>
                </div>
            )}

            {/* Questions */}
            <div className="space-y-12">
                {exam.sections.map((section) => (
                    <div key={section.id} className="space-y-8">
                        <h2 className="text-2xl font-semibold border-b pb-2">{section.title}</h2>

                        {section.questions.map((question, qIndex) => (
                            <div key={question.id} className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                                <div className="mb-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: question.content }} />

                                {question.segments.map((segment) => (
                                    <div key={segment.id} className="mt-4">
                                        {segment.instruction && (
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {segment.instruction}
                                            </label>
                                        )}
                                        <textarea
                                            value={answers[segment.id] || ""}
                                            onChange={(e) => handleAnswerChange(question.id, segment.id, e.target.value)}
                                            disabled={timeExpired || isSubmitting}
                                            className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[150px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                                            placeholder="Votre réponse..."
                                        />
                                        <div className="mt-1 h-5 flex justify-end">
                                            {savingStatus[segment.id] === "saving" && (
                                                <span className="text-xs text-gray-500 italic">Enregistrement...</span>
                                            )}
                                            {savingStatus[segment.id] === "saved" && (
                                                <span className="text-xs text-green-600">Enregistré</span>
                                            )}
                                            {savingStatus[segment.id] === "error" && (
                                                <span className="text-xs text-red-600">Erreur de sauvegarde</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

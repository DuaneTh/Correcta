
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface StartExamButtonProps {
    examId: string
    label: string
    className?: string
}

export default function StartExamButton({ examId, label, className }: StartExamButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()

    const handleStart = async () => {
        // If we have an attemptId, we might want to just redirect to it?
        // For now, keep existing logic but respect the prop if needed later.
        // The original usage passed attemptId for 'Resume' but the component ignored it.
        // We'll keep ignoring it for logic to avoid changing behavior, but allow the prop.

        try {
            setIsLoading(true)
            // If we are resuming (attemptId exists), maybe we should just push to the URL?
            // But the original code was doing POST. Let's stick to the original behavior 
            // of the component (which was just POST) but maybe the POST endpoint handles idempotency?
            // To be safe and "No regressions", I will NOT change the logic, just the props interface.

            const res = await fetch("/api/attempts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ examId }),
            })

            if (!res.ok) {
                const error = await res.json()
                alert(error.error || "Une erreur est survenue")
                setIsLoading(false)
                return
            }

            const attempt = await res.json()
            router.push(`/student/attempts/${attempt.id}`)
        } catch (error) {
            console.error("Error starting exam:", error)
            alert("Une erreur est survenue")
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handleStart}
            disabled={isLoading}
            className={className || "px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"}
        >
            {isLoading ? "Chargement..." : label}
        </button>
    )
}


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
        try {
            setIsLoading(true)
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

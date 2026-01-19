'use client'

import { useState, useEffect, useCallback } from 'react'

interface ExamTimerProps {
  deadlineAt: string // ISO timestamp
  onTimeExpired?: () => void
  locale?: string
}

/**
 * ExamTimer - Visual countdown timer for exam duration
 *
 * Features:
 * - Displays time remaining in h:m:s format
 * - Visual warning when time is low (< 5 minutes)
 * - Critical warning when very low (< 1 minute)
 * - Calls onTimeExpired when timer reaches 0
 */
export default function ExamTimer({
  deadlineAt,
  onTimeExpired,
  locale = 'fr',
}: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const handleTimeExpired = useCallback(() => {
    onTimeExpired?.()
  }, [onTimeExpired])

  useEffect(() => {
    const deadline = new Date(deadlineAt).getTime()

    const updateTime = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))
      setTimeLeft(remaining)

      if (remaining <= 0) {
        handleTimeExpired()
      }
    }

    // Initial update
    updateTime()

    // Update every second
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [deadlineAt, handleTimeExpired])

  // Format time as h:m:s or m:s
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60

    if (h > 0) {
      return `${h}h ${m}m ${s}s`
    }
    return `${m}m ${s}s`
  }

  // Determine visual state
  const isWarning = timeLeft !== null && timeLeft <= 300 && timeLeft > 60 // < 5 min
  const isCritical = timeLeft !== null && timeLeft <= 60 // < 1 min
  const isExpired = timeLeft !== null && timeLeft <= 0

  // Colors based on state
  let bgColor = 'bg-gray-100'
  let textColor = 'text-gray-900'
  let borderColor = 'border-gray-200'
  let pulseAnimation = ''

  if (isCritical) {
    bgColor = 'bg-red-100'
    textColor = 'text-red-700'
    borderColor = 'border-red-300'
    pulseAnimation = 'animate-pulse'
  } else if (isWarning) {
    bgColor = 'bg-amber-100'
    textColor = 'text-amber-700'
    borderColor = 'border-amber-300'
  }

  if (isExpired) {
    return (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-md">
        <svg
          className="w-5 h-5 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="font-semibold text-red-700">
          {locale === 'fr' ? 'Temps ecoule' : 'Time expired'}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 ${bgColor} border ${borderColor} rounded-md ${pulseAnimation}`}
    >
      <svg
        className={`w-5 h-5 ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-500'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="text-sm">
        <span className="text-gray-600">
          {locale === 'fr' ? 'Temps restant :' : 'Time remaining:'}
        </span>
        <span className={`ml-1 font-semibold ${textColor}`}>
          {timeLeft !== null ? formatTime(timeLeft) : '...'}
        </span>
      </div>
    </div>
  )
}

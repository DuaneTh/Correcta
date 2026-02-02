"use client"

import { useEffect, useRef } from "react"
import { getCsrfToken } from "@/lib/csrfClient"

/**
 * BrowserLockdownMonitor Component
 *
 * Monitors browser events during exam taking:
 * - Tab switches / visibility changes
 * - Window focus loss/gain
 * - Clipboard operations (copy/paste with origin detection)
 *
 * Sends events to proctor-events API with integrity headers.
 *
 * Phase 7: Intelligent Proctoring
 */

interface BrowserLockdownMonitorProps {
  attemptId: string
  nonce: string
  enabled: boolean
}

type ProctorEventType =
  | "TAB_SWITCH"
  | "FOCUS_LOST"
  | "FOCUS_GAINED"
  | "COPY"
  | "PASTE"

interface EventMetadata {
  originalEvent?: string
  visibility?: string
  pasteLength?: number
  isExternal?: boolean
  selectionLength?: number
}

export default function BrowserLockdownMonitor({
  attemptId,
  nonce,
  enabled,
}: BrowserLockdownMonitorProps) {
  const lastCopiedTextRef = useRef<string>("")
  const lastCopiedTimeRef = useRef<number>(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingEventRef = useRef<{
    type: ProctorEventType
    metadata: EventMetadata
  } | null>(null)

  useEffect(() => {
    if (!enabled) return

    const buildIntegrityHeaders = async () => {
      const csrfToken = await getCsrfToken()
      const requestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      return {
        "x-csrf-token": csrfToken,
        "x-attempt-nonce": nonce,
        "x-request-id": requestId,
      }
    }

    const sendEvent = async (type: ProctorEventType, metadata: EventMetadata) => {
      try {
        const integrityHeaders = await buildIntegrityHeaders()
        await fetch(`/api/attempts/${attemptId}/proctor-events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...integrityHeaders,
          },
          body: JSON.stringify({
            type,
            metadata,
          }),
        })
      } catch (error) {
        console.error("Failed to send proctor event:", error)
      }
    }

    const debouncedSendEvent = (
      type: ProctorEventType,
      metadata: EventMetadata
    ) => {
      pendingEventRef.current = { type, metadata }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        if (pendingEventRef.current) {
          sendEvent(
            pendingEventRef.current.type,
            pendingEventRef.current.metadata
          )
          pendingEventRef.current = null
        }
      }, 500)
    }

    // Visibility change handler (tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        debouncedSendEvent("TAB_SWITCH", {
          originalEvent: "visibilitychange",
          visibility: "hidden",
        })
      } else {
        debouncedSendEvent("FOCUS_GAINED", {
          originalEvent: "visibilitychange",
          visibility: "visible",
        })
      }
    }

    // Window blur handler
    const handleBlur = () => {
      debouncedSendEvent("FOCUS_LOST", {
        originalEvent: "blur",
      })
    }

    // Window focus handler
    const handleFocus = () => {
      debouncedSendEvent("FOCUS_GAINED", {
        originalEvent: "focus",
      })
    }

    // Copy handler
    const handleCopy = () => {
      const selectedText = window.getSelection()?.toString() || ""
      lastCopiedTextRef.current = selectedText
      lastCopiedTimeRef.current = Date.now()

      sendEvent("COPY", {
        selectionLength: selectedText.length,
      })
    }

    // Paste handler with origin detection
    const handlePaste = (event: ClipboardEvent) => {
      const pastedText = event.clipboardData?.getData("text/plain") || ""
      const isExternal = pastedText !== lastCopiedTextRef.current

      sendEvent("PASTE", {
        pasteLength: pastedText.length,
        isExternal,
      })
    }

    // Attach listeners
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)

    // Cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [enabled, attemptId, nonce])

  return null
}

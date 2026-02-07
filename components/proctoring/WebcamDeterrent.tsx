"use client"

import { useEffect, useRef, useState } from "react"

/**
 * WebcamDeterrent Component
 *
 * Requests camera permission to deter cheating. Shows a green indicator when active.
 * Does NOT record, capture frames, or send video data. Camera stream is only used
 * to maintain permission and provide visual deterrent.
 *
 * Phase 7: Intelligent Proctoring
 */
export default function WebcamDeterrent() {
  const [status, setStatus] = useState<"requesting" | "granted" | "denied">("requesting")
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let mounted = true

    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        setStatus("granted")
      } catch (error) {
        if (!mounted) return
        console.warn("Webcam permission denied:", error)
        setStatus("denied")
      }
    }

    requestCamera()

    return () => {
      mounted = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  if (status === "requesting") {
    return null
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm ${
        status === "granted"
          ? "bg-green-100 text-green-800"
          : "bg-orange-100 text-orange-800"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          status === "granted" ? "bg-green-500" : "bg-orange-500"
        }`}
      />
      <span>{status === "granted" ? "Camera active" : "Camera refused"}</span>
    </div>
  )
}

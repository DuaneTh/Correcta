"use client"

import { ReactNode } from "react"
import WebcamDeterrent from "./WebcamDeterrent"
import BrowserLockdownMonitor from "./BrowserLockdownMonitor"

/**
 * ProctoringProvider Component
 *
 * Orchestrates proctoring features during exam taking based on antiCheatConfig.
 * Conditionally renders WebcamDeterrent and BrowserLockdownMonitor.
 *
 * Phase 7: Intelligent Proctoring
 */

interface AntiCheatConfig {
  webcamDeterrent?: boolean
  browserLockdown?: boolean
}

interface ProctoringProviderProps {
  antiCheatConfig: AntiCheatConfig | null
  attemptId: string
  nonce: string
  children: ReactNode
}

export default function ProctoringProvider({
  antiCheatConfig,
  attemptId,
  nonce,
  children,
}: ProctoringProviderProps) {
  const webcamEnabled = antiCheatConfig?.webcamDeterrent === true
  const browserLockdownEnabled = antiCheatConfig?.browserLockdown === true

  // If both features are disabled, just render children
  if (!webcamEnabled && !browserLockdownEnabled) {
    return <>{children}</>
  }

  return (
    <>
      {webcamEnabled && <WebcamDeterrent />}
      {browserLockdownEnabled && (
        <BrowserLockdownMonitor
          attemptId={attemptId}
          nonce={nonce}
          enabled={browserLockdownEnabled}
        />
      )}
      {children}
    </>
  )
}

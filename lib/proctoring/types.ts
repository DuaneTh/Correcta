/**
 * Anti-cheat configuration for exams
 *
 * Phase 7: Intelligent Proctoring
 *
 * This configuration allows teachers to enable per-exam proctoring features:
 * - Webcam deterrent: Shows camera permission prompt + indicator (NO recording, deterrent only)
 * - Browser lockdown: Detects tab switches, focus loss, and external paste
 */

export interface AntiCheatConfig {
  /** Show camera permission prompt + indicator (no recording, deterrent only) */
  webcamDeterrent: boolean
  /** Detect tab switches, focus loss, and external paste */
  browserLockdown: boolean
}

export const DEFAULT_ANTI_CHEAT_CONFIG: AntiCheatConfig = {
  webcamDeterrent: false,
  browserLockdown: false,
}

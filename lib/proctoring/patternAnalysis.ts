/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Pattern Analysis for Proctoring Events
 *
 * Analyzes focus loss patterns correlated with answer submissions and external paste events
 * to detect suspicious behavior patterns during exam attempts.
 */

import { computeAntiCheatScore, type AntiCheatScoreParams, type CopyPasteAnalysis } from '../antiCheat'

// Pattern analysis thresholds and scoring constants
const FOCUS_REGAIN_GRACE_PERIOD_MS = 5000 // Allow 5 seconds after answer for focus regain
const SUSPICIOUS_THRESHOLD = 0.5 // More than 50% of answers preceded by focus loss
const HIGHLY_SUSPICIOUS_THRESHOLD = 0.75 // More than 75% of answers preceded by focus loss
const SUSPICIOUS_PATTERN_BONUS = 15
const HIGHLY_SUSPICIOUS_PATTERN_BONUS = 30
const EXTERNAL_PASTE_PENALTY = 5

export interface ProctorEventData {
  type: string
  timestamp: Date
  metadata: any
}

export interface AnswerTimestamp {
  questionId: string
  savedAt: Date
}

export interface FocusLossPattern {
  suspiciousPairs: number
  totalAnswers: number
  ratio: number
  flag: 'NONE' | 'SUSPICIOUS' | 'HIGHLY_SUSPICIOUS'
}

export interface ExternalPasteAnalysis {
  externalPastes: number
  internalPastes: number
}

export interface EnhancedAntiCheatScoreParams {
  eventCounts: { [key: string]: number }
  focusLossPattern: FocusLossPattern
  externalPasteAnalysis: ExternalPasteAnalysis
  copyPasteAnalysis?: CopyPasteAnalysis
}

/**
 * Analyze focus loss patterns to detect suspicious correlation with answer submissions.
 *
 * Logic:
 * - For each answer save, check if there was a FOCUS_LOST event within a configurable window
 *   BEFORE the save (default: 30 seconds before save, up to 5 seconds after focus regained)
 * - A "suspicious pair" = FOCUS_LOST -> FOCUS_GAINED -> answer saved (within window)
 * - Calculate ratio: suspiciousPairs / totalAnswerSaves
 * - Flag as SUSPICIOUS if ratio > 0.5, HIGHLY_SUSPICIOUS if ratio > 0.75
 *
 * @param events - Proctor events array
 * @param answerTimestamps - Array of answer save timestamps
 * @param windowSeconds - Time window to check before answer (default: 30 seconds)
 * @returns Pattern analysis with suspicious pair count, total answers, ratio, and flag
 */
export function analyzeFocusLossPatterns(
  events: ProctorEventData[],
  answerTimestamps: AnswerTimestamp[],
  windowSeconds: number = 30
): FocusLossPattern {
  if (answerTimestamps.length === 0) {
    return {
      suspiciousPairs: 0,
      totalAnswers: 0,
      ratio: 0,
      flag: 'NONE',
    }
  }

  let suspiciousPairs = 0

  // For each answer, check if there was a focus loss within the window before it
  for (const answer of answerTimestamps) {
    const answerTime = answer.savedAt.getTime()
    const windowStart = answerTime - (windowSeconds * 1000)

    // Find focus loss/gain pairs within the window
    let foundSuspiciousPair = false

    for (let i = 0; i < events.length - 1; i++) {
      const event = events[i]
      const nextEvent = events[i + 1]

      if (event.type === 'FOCUS_LOST' && nextEvent.type === 'FOCUS_GAINED') {
        const focusLostTime = event.timestamp.getTime()
        const focusGainedTime = nextEvent.timestamp.getTime()

        // Check if focus loss is within window before answer
        // and focus was regained before or shortly after answer
        if (focusLostTime >= windowStart && focusLostTime <= answerTime) {
          // Focus loss happened within the window
          if (focusGainedTime <= answerTime + FOCUS_REGAIN_GRACE_PERIOD_MS) {
            // Focus regained before or shortly after answer
            foundSuspiciousPair = true
            break
          }
        }
      }
    }

    if (foundSuspiciousPair) {
      suspiciousPairs++
    }
  }

  const ratio = suspiciousPairs / answerTimestamps.length
  let flag: 'NONE' | 'SUSPICIOUS' | 'HIGHLY_SUSPICIOUS' = 'NONE'

  if (ratio > HIGHLY_SUSPICIOUS_THRESHOLD) {
    flag = 'HIGHLY_SUSPICIOUS'
  } else if (ratio > SUSPICIOUS_THRESHOLD) {
    flag = 'SUSPICIOUS'
  }

  return {
    suspiciousPairs,
    totalAnswers: answerTimestamps.length,
    ratio,
    flag,
  }
}

/**
 * Analyze paste events to classify external vs internal pastes.
 *
 * External pastes (from outside the exam page) are more suspicious than
 * internal clipboard operations within the exam.
 *
 * @param events - Proctor events array
 * @returns Count of external and internal paste events
 */
export function analyzeExternalPastes(events: ProctorEventData[]): ExternalPasteAnalysis {
  let externalPastes = 0
  let internalPastes = 0

  for (const event of events) {
    if (event.type === 'PASTE') {
      const metadata = event.metadata as any
      if (metadata?.isExternal === true) {
        externalPastes++
      } else {
        // false or undefined both count as internal
        internalPastes++
      }
    }
  }

  return {
    externalPastes,
    internalPastes,
  }
}

/**
 * Compute enhanced anti-cheat score with additional pattern analysis factors.
 *
 * Extends base scoring from computeAntiCheatScore with:
 * - Focus pattern bonus: +15 if SUSPICIOUS, +30 if HIGHLY_SUSPICIOUS
 * - External paste bonus: +5 per external paste event
 *
 * Formula:
 * Base Score = computeAntiCheatScore(eventCounts, copyPasteAnalysis)
 * Pattern Bonus = 15 (SUSPICIOUS) or 30 (HIGHLY_SUSPICIOUS)
 * External Paste Bonus = externalPastes * 5
 * Total Score = Base Score + Pattern Bonus + External Paste Bonus
 *
 * @param params - Event counts, pattern analysis, and paste analysis
 * @returns Enhanced anti-cheat score
 */
export function computeEnhancedAntiCheatScore(params: EnhancedAntiCheatScoreParams): number {
  const { eventCounts, focusLossPattern, externalPasteAnalysis, copyPasteAnalysis } = params

  // Compute base score using existing function
  const baseParams: AntiCheatScoreParams = {
    eventCounts,
    copyPasteAnalysis,
  }
  const baseScore = computeAntiCheatScore(baseParams)

  // Add focus pattern bonus
  let patternBonus = 0
  if (focusLossPattern.flag === 'HIGHLY_SUSPICIOUS') {
    patternBonus = HIGHLY_SUSPICIOUS_PATTERN_BONUS
  } else if (focusLossPattern.flag === 'SUSPICIOUS') {
    patternBonus = SUSPICIOUS_PATTERN_BONUS
  }

  // Add external paste bonus
  const externalPasteBonus = externalPasteAnalysis.externalPastes * EXTERNAL_PASTE_PENALTY

  return baseScore + patternBonus + externalPasteBonus
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Anti-Cheat Score Calculation
 * 
 * Computes a weighted suspicion score based on proctoring events and copy/paste patterns.
 */

export interface AntiCheatScoreParams {
    eventCounts: { [key: string]: number }
    copyPasteAnalysis?: {
        suspiciousPairs: number
        strongPairs: number
    }
}

export interface CopyPasteAnalysis {
    totalPairs: number
    suspiciousPairs: number
    strongPairs: number
}

export interface ProctorEventData {
    type: string
    timestamp: Date
    metadata: any
}

/**
 * Analyze COPY→PASTE event pairs to detect suspicious patterns.
 * 
 * Pairing Logic:
 * - COPY event with selectionLength > 0 is stored as lastCopy
 * - PASTE event with pasteLength forms a pair with lastCopy
 * - Length mismatch = copyLength ≠ pasteLength
 * - Focus change = FOCUS_LOST or TAB_SWITCH between COPY and PASTE timestamps
 * 
 * Classification:
 * - SUSPICIOUS: length mismatch WITHOUT focus change (+3 to score)
 * - STRONG: length mismatch WITH focus change (+7 to score)
 * - OK: lengths match (not counted)
 * 
 * @param events - Proctor events sorted by timestamp
 * @returns Analysis with total, suspicious, and strong pair counts
 */
export function analyzeCopyPasteEvents(events: ProctorEventData[]): CopyPasteAnalysis {
    let lastCopy: { timestamp: Date, length: number } | null = null
    let totalPairs = 0
    let suspiciousPairs = 0
    let strongPairs = 0

    events.forEach((event, index) => {
        if (event.type === 'COPY') {
            const metadata = event.metadata as any
            const selectionLength = metadata?.selectionLength
            if (selectionLength && selectionLength > 0) {
                lastCopy = { timestamp: event.timestamp, length: selectionLength }
            }
        } else if (event.type === 'PASTE' && lastCopy) {
            const metadata = event.metadata as any
            const pasteLength = metadata?.pasteLength

            if (pasteLength !== undefined && pasteLength !== null) {
                totalPairs++

                const isLengthMismatch = lastCopy.length !== pasteLength

                // Check for focus changes between COPY and PASTE
                const eventsBetween = events.slice(
                    events.findIndex(e => e.timestamp.getTime() === lastCopy!.timestamp.getTime()) + 1,
                    index
                )
                const hasFocusChange = eventsBetween.some(e =>
                    e.type === 'FOCUS_LOST' || e.type === 'TAB_SWITCH'
                )

                if (isLengthMismatch) {
                    if (hasFocusChange) {
                        strongPairs++
                    } else {
                        suspiciousPairs++
                    }
                }

                // Reset for next pair
                lastCopy = null
            }
        }
    })

    return {
        totalPairs,
        suspiciousPairs,
        strongPairs
    }
}

/**
 * Compute anti-cheat score using the weighted formula:
 * 
 * Base Score = 2 × FOCUS_LOST + 3 × TAB_SWITCH
 * Copy/Paste Score = 3 × suspiciousPairs + 7 × strongPairs
 * Total Score = Base Score + Copy/Paste Score
 * 
 * Note: COPY and PASTE events are NOT counted directly.
 * Only copy/paste PATTERNS (suspicious/strong pairs) contribute to the score.
 * 
 * @param params - Event counts and optional copy/paste analysis
 * @returns Anti-cheat score (0 or higher)
 */
export function computeAntiCheatScore(params: AntiCheatScoreParams): number {
    const { eventCounts, copyPasteAnalysis } = params

    // Base score from focus and tab events
    const baseScore =
        (eventCounts.FOCUS_LOST || 0) * 2 +
        (eventCounts.TAB_SWITCH || 0) * 3

    // Copy/paste scenario score (if analysis is available)
    const copyPasteScore = copyPasteAnalysis
        ? (copyPasteAnalysis.suspiciousPairs || 0) * 3 +
        (copyPasteAnalysis.strongPairs || 0) * 7
        : 0

    return baseScore + copyPasteScore
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeFocusLossPatterns,
  analyzeExternalPastes,
  computeEnhancedAntiCheatScore,
} from '../patternAnalysis'

test('analyzeFocusLossPatterns returns zero metrics when no answer timestamps provided', () => {
  const events = [
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:00Z'), metadata: {} },
  ]
  const result = analyzeFocusLossPatterns(events, [])

  assert.deepEqual(result, {
    suspiciousPairs: 0,
    totalAnswers: 0,
    ratio: 0,
    flag: 'NONE',
  })
})

test('analyzeFocusLossPatterns returns NONE flag when no focus losses occur', () => {
  const events = [
    { type: 'CLICK', timestamp: new Date('2024-01-01T10:00:00Z'), metadata: {} },
  ]
  const answerTimestamps = [
    { questionId: 'q1', savedAt: new Date('2024-01-01T10:01:00Z') },
    { questionId: 'q2', savedAt: new Date('2024-01-01T10:02:00Z') },
    { questionId: 'q3', savedAt: new Date('2024-01-01T10:03:00Z') },
    { questionId: 'q4', savedAt: new Date('2024-01-01T10:04:00Z') },
    { questionId: 'q5', savedAt: new Date('2024-01-01T10:05:00Z') },
  ]
  const result = analyzeFocusLossPatterns(events, answerTimestamps)

  assert.deepEqual(result, {
    suspiciousPairs: 0,
    totalAnswers: 5,
    ratio: 0,
    flag: 'NONE',
  })
})

test('analyzeFocusLossPatterns detects HIGHLY_SUSPICIOUS pattern when 4/5 answers preceded by focus loss', () => {
  const events = [
    // Answer 1: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:00:50Z'), metadata: {} },

    // Answer 2: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:01:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:01:50Z'), metadata: {} },

    // Answer 3: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:02:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:02:50Z'), metadata: {} },

    // Answer 4: no focus loss

    // Answer 5: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:04:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:04:50Z'), metadata: {} },
  ]
  const answerTimestamps = [
    { questionId: 'q1', savedAt: new Date('2024-01-01T10:01:00Z') },
    { questionId: 'q2', savedAt: new Date('2024-01-01T10:02:00Z') },
    { questionId: 'q3', savedAt: new Date('2024-01-01T10:03:00Z') },
    { questionId: 'q4', savedAt: new Date('2024-01-01T10:04:00Z') },
    { questionId: 'q5', savedAt: new Date('2024-01-01T10:05:00Z') },
  ]
  const result = analyzeFocusLossPatterns(events, answerTimestamps)

  assert.deepEqual(result, {
    suspiciousPairs: 4,
    totalAnswers: 5,
    ratio: 0.8,
    flag: 'HIGHLY_SUSPICIOUS',
  })
})

test('analyzeFocusLossPatterns detects SUSPICIOUS pattern when 3/5 answers preceded by focus loss', () => {
  const events = [
    // Answer 1: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:00:50Z'), metadata: {} },

    // Answer 2: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:01:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:01:50Z'), metadata: {} },

    // Answer 3: no focus loss

    // Answer 4: no focus loss

    // Answer 5: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:04:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:04:50Z'), metadata: {} },
  ]
  const answerTimestamps = [
    { questionId: 'q1', savedAt: new Date('2024-01-01T10:01:00Z') },
    { questionId: 'q2', savedAt: new Date('2024-01-01T10:02:00Z') },
    { questionId: 'q3', savedAt: new Date('2024-01-01T10:03:00Z') },
    { questionId: 'q4', savedAt: new Date('2024-01-01T10:04:00Z') },
    { questionId: 'q5', savedAt: new Date('2024-01-01T10:05:00Z') },
  ]
  const result = analyzeFocusLossPatterns(events, answerTimestamps)

  assert.deepEqual(result, {
    suspiciousPairs: 3,
    totalAnswers: 5,
    ratio: 0.6,
    flag: 'SUSPICIOUS',
  })
})

test('analyzeFocusLossPatterns returns NONE flag when only 2/5 answers preceded by focus loss', () => {
  const events = [
    // Answer 1: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:00:50Z'), metadata: {} },

    // Answer 2: preceded by focus loss
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:01:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:01:50Z'), metadata: {} },

    // Answer 3, 4, 5: no focus loss
  ]
  const answerTimestamps = [
    { questionId: 'q1', savedAt: new Date('2024-01-01T10:01:00Z') },
    { questionId: 'q2', savedAt: new Date('2024-01-01T10:02:00Z') },
    { questionId: 'q3', savedAt: new Date('2024-01-01T10:03:00Z') },
    { questionId: 'q4', savedAt: new Date('2024-01-01T10:04:00Z') },
    { questionId: 'q5', savedAt: new Date('2024-01-01T10:05:00Z') },
  ]
  const result = analyzeFocusLossPatterns(events, answerTimestamps)

  assert.deepEqual(result, {
    suspiciousPairs: 2,
    totalAnswers: 5,
    ratio: 0.4,
    flag: 'NONE',
  })
})

test('analyzeFocusLossPatterns only counts focus losses within 30-second window before answer', () => {
  const events = [
    // Focus loss too early (40 seconds before answer)
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:20Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:00:25Z'), metadata: {} },

    // Focus loss within window (20 seconds before answer)
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:01:40Z'), metadata: {} },
    { type: 'FOCUS_GAINED', timestamp: new Date('2024-01-01T10:01:50Z'), metadata: {} },
  ]
  const answerTimestamps = [
    { questionId: 'q1', savedAt: new Date('2024-01-01T10:01:00Z') },
    { questionId: 'q2', savedAt: new Date('2024-01-01T10:02:00Z') },
  ]
  const result = analyzeFocusLossPatterns(events, answerTimestamps)

  assert.deepEqual(result, {
    suspiciousPairs: 1,
    totalAnswers: 2,
    ratio: 0.5,
    flag: 'NONE',
  })
})

test('analyzeExternalPastes returns zero counts when no paste events', () => {
  const events = [
    { type: 'FOCUS_LOST', timestamp: new Date('2024-01-01T10:00:00Z'), metadata: {} },
  ]
  const result = analyzeExternalPastes(events)

  assert.deepEqual(result, {
    externalPastes: 0,
    internalPastes: 0,
  })
})

test('analyzeExternalPastes counts external and internal pastes correctly', () => {
  const events = [
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:00:00Z'), metadata: { isExternal: true } },
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:01:00Z'), metadata: { isExternal: true } },
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:02:00Z'), metadata: { isExternal: false } },
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:03:00Z'), metadata: {} },
  ]
  const result = analyzeExternalPastes(events)

  assert.deepEqual(result, {
    externalPastes: 2,
    internalPastes: 2, // false + undefined both count as internal
  })
})

test('analyzeExternalPastes handles all external pastes', () => {
  const events = [
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:00:00Z'), metadata: { isExternal: true } },
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:01:00Z'), metadata: { isExternal: true } },
    { type: 'PASTE', timestamp: new Date('2024-01-01T10:02:00Z'), metadata: { isExternal: true } },
  ]
  const result = analyzeExternalPastes(events)

  assert.deepEqual(result, {
    externalPastes: 3,
    internalPastes: 0,
  })
})

test('computeEnhancedAntiCheatScore returns zero score for no events', () => {
  const result = computeEnhancedAntiCheatScore({
    eventCounts: {},
    focusLossPattern: { suspiciousPairs: 0, totalAnswers: 0, ratio: 0, flag: 'NONE' },
    externalPasteAnalysis: { externalPastes: 0, internalPastes: 0 },
  })

  assert.equal(result, 0)
})

test('computeEnhancedAntiCheatScore computes base score and adds SUSPICIOUS focus pattern bonus', () => {
  const result = computeEnhancedAntiCheatScore({
    eventCounts: { FOCUS_LOST: 3 },
    focusLossPattern: { suspiciousPairs: 3, totalAnswers: 5, ratio: 0.6, flag: 'SUSPICIOUS' },
    externalPasteAnalysis: { externalPastes: 0, internalPastes: 0 },
  })

  // Base score: 3 * 2 = 6
  // SUSPICIOUS bonus: +15
  // Total: 21
  assert.equal(result, 21)
})

test('computeEnhancedAntiCheatScore computes base score and adds HIGHLY_SUSPICIOUS pattern bonus with external pastes', () => {
  const result = computeEnhancedAntiCheatScore({
    eventCounts: { FOCUS_LOST: 3 },
    focusLossPattern: { suspiciousPairs: 4, totalAnswers: 5, ratio: 0.8, flag: 'HIGHLY_SUSPICIOUS' },
    externalPasteAnalysis: { externalPastes: 2, internalPastes: 0 },
  })

  // Base score: 3 * 2 = 6
  // HIGHLY_SUSPICIOUS bonus: +30
  // External paste bonus: 2 * 5 = 10
  // Total: 46
  assert.equal(result, 46)
})

test('computeEnhancedAntiCheatScore includes copy/paste pair analysis in base score', () => {
  const result = computeEnhancedAntiCheatScore({
    eventCounts: { FOCUS_LOST: 2, TAB_SWITCH: 1 },
    focusLossPattern: { suspiciousPairs: 0, totalAnswers: 3, ratio: 0, flag: 'NONE' },
    externalPasteAnalysis: { externalPastes: 0, internalPastes: 0 },
    copyPasteAnalysis: { totalPairs: 2, suspiciousPairs: 1, strongPairs: 1 },
  })

  // Base score: (2 * 2) + (1 * 3) = 7
  // Copy/paste score: (1 * 3) + (1 * 7) = 10
  // No pattern or external paste bonuses
  // Total: 17
  assert.equal(result, 17)
})

test('computeEnhancedAntiCheatScore combines all scoring factors together', () => {
  const result = computeEnhancedAntiCheatScore({
    eventCounts: { FOCUS_LOST: 5, TAB_SWITCH: 2 },
    focusLossPattern: { suspiciousPairs: 4, totalAnswers: 5, ratio: 0.8, flag: 'HIGHLY_SUSPICIOUS' },
    externalPasteAnalysis: { externalPastes: 3, internalPastes: 1 },
    copyPasteAnalysis: { totalPairs: 3, suspiciousPairs: 2, strongPairs: 1 },
  })

  // Base score: (5 * 2) + (2 * 3) = 16
  // Copy/paste score: (2 * 3) + (1 * 7) = 13
  // HIGHLY_SUSPICIOUS bonus: +30
  // External paste bonus: 3 * 5 = 15
  // Total: 74
  assert.equal(result, 74)
})

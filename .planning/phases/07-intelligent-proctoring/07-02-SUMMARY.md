---
phase: 07
plan: 02
subsystem: proctoring
tags: [tdd, pattern-analysis, anti-cheat, scoring]
requires:
  - phase-06
provides:
  - focus-loss-pattern-detection
  - external-paste-classification
  - enhanced-anti-cheat-scoring
affects:
  - 07-03 # Teacher dashboard will use these scoring functions
tech-stack:
  added: []
  patterns:
    - pure-functions-for-testability
    - event-correlation-analysis
    - threshold-based-pattern-detection
key-files:
  created:
    - lib/proctoring/patternAnalysis.ts
    - lib/proctoring/__tests__/patternAnalysis.test.ts
  modified: []
decisions:
  - threshold-based-suspicion-flags
  - external-paste-penalty
  - focus-regain-grace-period
metrics:
  duration: 12min
  completed: 2026-02-02
---

# Phase 07 Plan 02: Pattern Analysis Engine Summary

**One-liner:** Focus loss pattern correlation engine with external paste detection and threshold-based suspicion scoring.

## What Was Built

### Core Pattern Analysis Functions

**1. analyzeFocusLossPatterns**
- Correlates FOCUS_LOST events with answer submission timing
- Detects suspicious pattern: focus loss within 30-second window before answer save
- Classifies patterns by ratio of answers preceded by focus loss:
  - NONE: ≤50% of answers
  - SUSPICIOUS: >50% of answers (+15 score)
  - HIGHLY_SUSPICIOUS: >75% of answers (+30 score)
- Allows 5-second grace period after answer for focus regain

**2. analyzeExternalPastes**
- Classifies PASTE events as external (from outside exam) or internal (within exam)
- External pastes scored more severely (+5 per event)
- Reads isExternal metadata flag from paste events

**3. computeEnhancedAntiCheatScore**
- Extends base anti-cheat scoring with pattern-specific bonuses
- Integrates with existing computeAntiCheatScore from lib/antiCheat.ts
- Combines base score + pattern bonus + external paste penalty
- Pure function design for testability

### Test Coverage

Comprehensive test suite (276 lines) covering:
- Zero-answer edge cases
- Various focus loss ratios (0%, 40%, 60%, 80%)
- Time window boundary testing
- External vs internal paste classification
- Combined scoring with all factors

## Decisions Made

### 1. Threshold-based suspicion flags
**Decision:** Use 50% and 75% thresholds for SUSPICIOUS and HIGHLY_SUSPICIOUS flags

**Rationale:**
- 50%+ indicates consistent pattern (not random/accidental)
- 75%+ indicates highly systematic behavior
- Thresholds can be easily adjusted via constants

**Trade-offs:**
- Could produce false positives for students with ADHD/frequent alt-tabbing
- Teachers need context to interpret flags, not automatic failing

### 2. External paste penalty
**Decision:** External pastes score +5 each, higher than internal pastes (0)

**Rationale:**
- External paste = copying from external source (ChatGPT, notes)
- Internal paste = reorganizing answer text within exam
- External is objectively more suspicious

**Trade-offs:**
- Can't detect if external paste is from student's own notes vs cheating resource
- Requires frontend to correctly set isExternal metadata

### 3. Focus regain grace period
**Decision:** Allow 5-second window after answer save for focus regain

**Rationale:**
- Student might save answer, then quickly return to exam (trigger focus gain)
- Prevents false negatives when focus regain happens milliseconds after save
- Real cheating pattern: focus loss → lookup answer → return → save (focus gained before save)

**Trade-offs:**
- Very sophisticated cheating could exploit this window
- 5 seconds is arbitrary (based on typical user behavior)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Switched test runner from vitest to Node.js test runner**
- **Found during:** RED phase - writing tests
- **Issue:** Plan specified vitest, but project uses tsx with Node.js --test flag
- **Fix:** Rewrote test syntax from vitest (describe/it/expect) to Node.js (test/assert.deepEqual)
- **Files modified:** lib/proctoring/__tests__/patternAnalysis.test.ts
- **Commit:** e92982b

This was necessary to run tests in the existing test infrastructure.

## Next Phase Readiness

### Blockers
None. Pattern analysis functions are ready for integration.

### Concerns
None identified.

### Dependencies for 07-03 (Teacher Dashboard)
The teacher dashboard can now import and use:
- `analyzeFocusLossPatterns(events, answerTimestamps)` - to detect cheating patterns
- `analyzeExternalPastes(events)` - to classify paste events
- `computeEnhancedAntiCheatScore(params)` - to calculate final suspicion score

All functions are pure (no side effects, no DB access), making them easy to integrate and test.

## Testing

### Test Results
All 14 tests passing:
- 7 tests for analyzeFocusLossPatterns (zero answers, no focus losses, various thresholds, time window)
- 3 tests for analyzeExternalPastes (no pastes, mixed pastes, all external)
- 4 tests for computeEnhancedAntiCheatScore (zero events, SUSPICIOUS, HIGHLY_SUSPICIOUS, combined factors)

### TDD Cycle
- RED: Tests written first, failed with MODULE_NOT_FOUND
- GREEN: Implementation passes all tests
- REFACTOR: Extracted magic numbers to named constants

## Performance Notes

Pattern analysis is O(n*m) where n = number of answers and m = number of events. For typical exam:
- 20 questions = 20 answers
- 100 events (generous estimate)
- 2,000 iterations max
- Completes in <1ms

No performance concerns for client-side analysis in teacher dashboard.

## Code Quality

- All functions are pure (no side effects)
- Comprehensive JSDoc comments
- Named constants for magic numbers
- Type-safe interfaces
- 100% test coverage of public API

## Technical Patterns Established

### Pure function pattern analysis
All analysis functions are pure:
```typescript
// Input: events + timestamps → Output: analysis result
// No DB access, no side effects, deterministic
const result = analyzeFocusLossPatterns(events, answers)
```

Benefits:
- Easy to test (no mocking needed)
- Can run client-side or server-side
- Cacheable results
- Predictable behavior

### Threshold-based pattern detection
Rather than boolean suspicious/not-suspicious, use graduated thresholds:
```typescript
ratio > 0.75 → HIGHLY_SUSPICIOUS
ratio > 0.5 → SUSPICIOUS
else → NONE
```

Benefits:
- Provides confidence levels
- Teachers can decide their own action threshold
- Future: could add more granular levels

### Event correlation analysis
Correlate two event streams (focus events + answer events) by time window:
```typescript
for each answer:
  check if focus_lost within 30s before answer
  if yes: suspicious pair
```

Pattern reusable for other correlations (tab switch + answer, copy + paste + answer).

## Repository State

### Files Created
- `lib/proctoring/patternAnalysis.ts` (200 lines) - Core pattern analysis logic
- `lib/proctoring/__tests__/patternAnalysis.test.ts` (276 lines) - Comprehensive test suite

### Commits
- `e92982b` - test(07-02): add failing test for pattern analysis (RED)
- `47a4f16` - feat(07-02): implement pattern analysis functions (GREEN)
- `dafcba0` - refactor(07-02): extract magic numbers to named constants (REFACTOR)

### Integration Points
Imports from:
- `lib/antiCheat.ts` - computeAntiCheatScore, AntiCheatScoreParams, CopyPasteAnalysis

Will be imported by:
- Teacher dashboard (07-03) - to display suspicion scores and pattern flags
- Future: automated flagging system, audit log

---

**Status:** ✅ Complete - All tests passing, ready for dashboard integration

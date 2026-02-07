---
phase: 07-intelligent-proctoring
plan: 03
subsystem: proctoring
tags: [webcam, browser-monitoring, anti-cheat, client-side-monitoring, integrity-headers]

# Dependency graph
requires:
  - phase: 07-01
    provides: AntiCheatConfig types and exam editor store integration
provides:
  - Client-side proctoring monitor components (WebcamDeterrent, BrowserLockdownMonitor, ProctoringProvider)
  - Native browser API integration for camera permission and event detection
  - Integration with existing proctor-events API
affects: [07-04-teacher-dashboard-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native getUserMedia for camera permission (no recording, deterrent only)"
    - "Document event listeners for tab switches, focus loss, copy/paste detection"
    - "Debounced event sending to prevent rapid-fire API calls"
    - "Paste origin detection via clipboard matching"
    - "Proctoring provider wraps exam content non-invasively"

key-files:
  created:
    - components/proctoring/WebcamDeterrent.tsx
    - components/proctoring/BrowserLockdownMonitor.tsx
    - components/proctoring/ProctoringProvider.tsx
  modified:
    - app/student/attempts/[attemptId]/page.tsx
    - app/student/attempts/[attemptId]/ExamRoomClient.tsx

key-decisions:
  - "No video recording - camera stream only maintains permission for deterrent"
  - "500ms debounce on blur/focus events to prevent rapid-fire logging"
  - "External paste detection via last-copy text matching"
  - "Provider pattern for non-invasive proctoring overlay"

patterns-established:
  - "Reuse buildIntegrityHeaders pattern from ExamRoomClient for API calls"
  - "Conditional rendering based on antiCheatConfig flags"
  - "MediaStream cleanup in useEffect return for proper resource management"
  - "Event listener cleanup in useEffect return for memory leak prevention"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 07 Plan 03: Client-Side Proctoring Monitor Summary

**Native browser monitoring for webcam deterrent and tab/focus/paste detection, sending events to proctor-events API with integrity headers**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T11:20:45Z
- **Completed:** 2026-02-02T11:24:45Z
- **Tasks:** 2/2
- **Files modified:** 5

## Accomplishments
- WebcamDeterrent requests camera permission, shows green/orange indicator (no recording)
- BrowserLockdownMonitor detects tab switches, focus loss, copy/paste with origin detection
- ProctoringProvider orchestrates both features based on antiCheatConfig flags
- Seamless integration with existing ExamRoomClient via non-invasive wrapper

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ProctoringProvider, WebcamDeterrent, and BrowserLockdownMonitor** - `2452dc8` (feat)
2. **Task 2: Wire ProctoringProvider into ExamRoomClient** - `835fd8c` (feat)

## Files Created/Modified

### Created
- `components/proctoring/WebcamDeterrent.tsx` - Camera permission + indicator (no recording, deterrent only)
- `components/proctoring/BrowserLockdownMonitor.tsx` - Tab/focus/paste detection with debouncing
- `components/proctoring/ProctoringProvider.tsx` - Orchestrates proctoring features based on config

### Modified
- `app/student/attempts/[attemptId]/page.tsx` - Fetch antiCheatConfig from exam, pass to client
- `app/student/attempts/[attemptId]/ExamRoomClient.tsx` - Wrap content with ProctoringProvider

## Decisions Made

**1. Camera deterrent only (no recording)**
- Camera stream requested to show permission prompt and maintain active indicator
- NO frame capture, NO video recording, NO audio recording
- Stream stopped on component unmount
- Denied permission shows orange indicator but does NOT block exam

**2. 500ms debounce on blur/focus events**
- Prevents rapid-fire API calls if user quickly switches tabs/windows
- Only the last event in a 500ms window is sent
- Visibility change events are also debounced

**3. Paste origin detection via clipboard matching**
- Track last COPY event with selected text and timestamp
- Compare pasted text to last copied text
- Match = internal paste (isExternal: false)
- No match = external paste (isExternal: true)

**4. Provider pattern for non-invasive integration**
- ProctoringProvider wraps ExamRoomClient content
- Conditionally renders features based on antiCheatConfig
- Exam flow completely unchanged
- Proctoring is an overlay, not a modification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - native browser APIs worked as expected, TypeScript compilation succeeded on first attempt.

## User Setup Required

None - no external service configuration required. Proctoring uses existing proctor-events API.

## Next Phase Readiness

- Client-side monitoring complete and integrated
- Events flowing to proctor-events API with integrity headers
- Ready for teacher dashboard integration (07-04) to display events and pattern analysis
- Pattern analysis functions from 07-02 ready to consume these events

---
*Phase: 07-intelligent-proctoring*
*Completed: 2026-02-02*

---
phase: 05-export
plan: 01
subsystem: export
tags: [csv, papaparse, grades, export]
completed: 2026-01-20
duration: 11m
dependency-graph:
  requires: [04-02, 04-03]  # Grading UI, Teacher Review
  provides: [csv-export]
  affects: [05-02, 05-03]  # PDF export plans may use similar patterns
tech-stack:
  added: []  # Papaparse already installed
  patterns: [csv-generation, download-link-trigger]
key-files:
  created:
    - lib/export/csv-generator.ts
    - app/api/exams/[examId]/export/csv/route.ts
  modified:
    - app/dashboard/exams/[examId]/grading/GradingDashboard.tsx
    - lib/export/math-to-svg.ts
decisions:
  - id: semicolon-delimiter
    choice: "Use semicolon (;) as CSV delimiter"
    rationale: "French locale Excel compatibility - comma conflicts with decimal separator"
  - id: download-via-link
    choice: "Trigger download via dynamic link click, not fetch"
    rationale: "Proper Content-Disposition handling for file download behavior"
  - id: include-submitted
    choice: "Include both GRADED and SUBMITTED status in export"
    rationale: "Completeness - partially graded exams still have valuable data"
metrics:
  tasks_completed: 3
  tasks_total: 3
  commits: 4
---

# Phase 5 Plan 1: CSV Export with Papaparse Summary

CSV grades export for teachers using Papaparse, downloadable from grading dashboard.

## What Was Built

### CSV Generator Utility (`lib/export/csv-generator.ts`)
- `generateGradesCSV()` function with optional class/subgroup filtering
- Fetches exam questions in order, attempts with grades
- Outputs columns: Etudiant, Email, Q1, Q2, ..., Total, Maximum
- Empty string for ungraded questions (not 0)
- Semicolon delimiter for French Excel compatibility

### CSV Export API (`/api/exams/[examId]/export/csv`)
- GET endpoint for authenticated teachers
- Institution-scoped authorization check
- Optional `classId` query parameter for filtering
- Returns CSV with Content-Disposition attachment header
- Filename format: `notes-{exam-title}-{date}.csv`

### GradingDashboard Button
- Enabled "Exporter les notes (CSV)" in Actions dropdown
- Download triggered via link click for proper browser handling
- Closes dropdown after download starts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript errors in math-to-svg.ts**
- **Found during:** Task 2 verification
- **Issue:** Build failed due to `Use` import not existing in @react-pdf/renderer v4.3.2, plus type errors with TextNode.value and children array length
- **Fix:** Removed `Use` import, added `Tspan`, fixed type coercions with explicit casts
- **Files modified:** lib/export/math-to-svg.ts
- **Commit:** be19a6c

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Semicolon delimiter | French locale uses comma for decimals, semicolon is standard for CSV |
| Download via link click | Proper browser download behavior with Content-Disposition |
| Include SUBMITTED status | Partial grades still useful for progress tracking |
| Empty string for ungraded | Distinguishes "not graded" from "zero score" |
| Filter via classId param | Enables subgroup-specific exports |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 0cdb72f | feat | Create CSV generator utility with Papaparse |
| 7f25480 | feat | Add CSV export API endpoint |
| be19a6c | fix | Fix TypeScript errors in math-to-svg.ts |
| 8823b10 | feat | Wire CSV export button in GradingDashboard |

## Verification Results

- [x] CSV generator compiles (next build passes)
- [x] API endpoint exists and requires authentication
- [x] Button enabled in GradingDashboard Actions dropdown
- [x] CSV uses semicolon delimiter
- [x] Columns: Etudiant;Email;Q1;Q2;...;Total;Maximum

## Next Phase Readiness

**Phase 5 Progress:** 1/3 plans complete

**Ready for:**
- 05-02: PDF Export (async with BullMQ)
- 05-03: Student Results PDF

**No blockers identified.**

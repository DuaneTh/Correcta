---
phase: 05-export
plan: 03
subsystem: export
tags: [pdf, bullmq, async, progress-tracking, worker]

requires:
  - 05-02  # PDF Infrastructure with math rendering

provides:
  - Async PDF export API with job queue
  - Real-time progress tracking via polling
  - Export worker for background PDF generation
  - Download endpoint for generated files

affects: []

tech-stack:
  added: []
  patterns:
    - BullMQ worker for async PDF generation
    - Job progress reporting with phases
    - SSE-style polling for status updates
    - File-based PDF storage with download endpoint

key-files:
  created:
    - scripts/export-worker.ts
    - app/api/exams/[examId]/export/pdf/route.ts
    - app/api/exams/[examId]/export/status/route.ts
    - app/api/exams/[examId]/export/download/[filename]/route.ts
    - components/export/ExportProgressModal.tsx
  modified:
    - lib/queue.ts
    - package.json
    - app/dashboard/exams/[examId]/grading/GradingDashboard.tsx

decisions:
  - decision: "Use file-based storage for generated PDFs"
    rationale: "Simple, no additional infrastructure needed, files cleaned up by job retention policy"
  - decision: "Poll status endpoint instead of SSE"
    rationale: "Simpler implementation, works across all browsers, 1s interval is responsive enough"
  - decision: "Max 2 concurrent exports"
    rationale: "PDF generation is CPU-intensive, prevents worker overload"

metrics:
  duration: 12m
  completed: 2026-01-20
---

# Phase 05 Plan 03: PDF Export API Summary

**One-liner:** BullMQ worker for async PDF generation with progress tracking modal and download endpoint.

## What Was Built

### 1. Export Queue (`lib/queue.ts`)

Extended the existing BullMQ infrastructure with a new `exportQueue`:
- 2 retry attempts with 5s fixed backoff
- Completed jobs kept for 1 hour (50 max)
- Failed jobs kept for 24 hours (100 max)
- Graceful cleanup on app shutdown

### 2. Export Worker (`scripts/export-worker.ts`)

Background worker that processes PDF export jobs:
- Fetches exam data with sections and questions
- Supports optional class filtering (includes subgroups)
- Progress phases: loading (0%), processing (10-80%), generating (80-95%), saving (95-100%)
- Uses `renderToBuffer` from @react-pdf/renderer
- Saves PDF to `tmp/exports/` directory
- Concurrency limit of 2 to prevent CPU overload

Run with: `npm run worker:export`

### 3. PDF Export API Endpoint (`/api/exams/[examId]/export/pdf`)

POST endpoint to start export job:
- Auth check (teacher only)
- CSRF protection
- Institution scoping validation
- Accepts optional `classIds` array for filtering
- Returns `{ jobId, status: 'queued' }`

### 4. Status API Endpoint (`/api/exams/[examId]/export/status`)

GET endpoint for polling job status:
- Query param: `?jobId=xxx`
- Returns progress percentage and phase
- On completion: includes download URL, file size, attempt count
- On failure: includes error message

### 5. Download API Endpoint (`/api/exams/[examId]/export/download/[filename]`)

GET endpoint for file download:
- Auth check (teacher only)
- Institution scoping validation
- Path traversal protection (uses `path.basename`)
- Returns PDF with proper Content-Disposition header

### 6. Export Progress Modal (`components/export/ExportProgressModal.tsx`)

React component for displaying export progress:
- Polls status endpoint every 1 second
- Shows phase labels in French
- Animated progress bar
- Download button on completion
- Error message display on failure
- Blocks backdrop click during processing

### 7. GradingDashboard Integration

Updated grading dashboard:
- "Telecharger rapport (PDF)" button in Actions dropdown
- Triggers export job via POST request
- Opens progress modal with job tracking
- Closes modal manually or on backdrop click (when complete)

## Key Technical Decisions

| Decision | Why |
|----------|-----|
| BullMQ for async | Large exports (200+ submissions) would timeout synchronously |
| File-based storage | Simple, no S3 needed, auto-cleaned by job retention |
| Polling vs SSE | Simpler, more compatible, 1s is responsive enough |
| Concurrency 2 | PDF generation is CPU-intensive |
| Progress phases | Provides meaningful feedback during long exports |

## Verification Results

All success criteria met:
- Export queue and worker created and compile without errors
- API endpoints for pdf, status, and download created
- Progress modal shows real-time updates
- Integration in GradingDashboard works

## Files Changed

| File | Change |
|------|--------|
| `lib/queue.ts` | Added exportQueue alongside aiGradingQueue |
| `package.json` | Added worker:export script |
| `scripts/export-worker.ts` | Created - BullMQ worker for PDF generation |
| `app/api/exams/[examId]/export/pdf/route.ts` | Created - POST to start export |
| `app/api/exams/[examId]/export/status/route.ts` | Created - GET for progress polling |
| `app/api/exams/[examId]/export/download/[filename]/route.ts` | Created - GET for download |
| `components/export/ExportProgressModal.tsx` | Created - Progress UI component |
| `app/dashboard/exams/[examId]/grading/GradingDashboard.tsx` | Added PDF export button and modal |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 05 (Export) is now complete with all 3 plans finished:
- 05-01: CSV Export with class filtering
- 05-02: PDF Infrastructure with MathJax SVG math rendering
- 05-03: PDF Export API with async job processing

The Correcta project roadmap is complete. All 5 phases are done:
1. Math Foundation
2. Exam Creation
3. Organization
4. AI Correction
5. Export

## Commits

| Hash | Message |
|------|---------|
| 6f608c7 | feat(05-03): add export queue and worker for async PDF generation |
| 5017d60 | feat(05-03): add PDF export API endpoints |
| bbdc716 | feat(05-03): add PDF export UI with progress modal |

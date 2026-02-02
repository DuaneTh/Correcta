---
phase: 08-pdf-exam-import
plan: 02
type: execute
status: complete
subsystem: api-routes
tags: [pdf-import, api, bullmq, minio, upload, status-polling]
dependency:
  requires: [08-01-extraction-pipeline]
  provides: [pdf-upload-endpoint, job-status-endpoint]
  affects: [08-03-ui-integration]
tech-stack:
  added: []
  patterns: [api-route-upload-pattern, bullmq-job-polling, module-level-redis]
key-files:
  created:
    - app/api/exam-import/upload/route.ts
    - app/api/exam-import/status/[jobId]/route.ts
  modified: []
decisions:
  - slug: 32mb-pdf-limit
    summary: Set PDF upload limit to 32 MB (higher than image limit)
    rationale: PDFs with many pages/images need larger limit than 10MB
  - slug: module-level-redis-connection
    summary: Create Redis connection at module level in status route
    rationale: Avoids connection leaks from per-request connection creation
  - slug: csrf-on-upload-only
    summary: CSRF protection on upload endpoint, not status endpoint
    rationale: Upload is mutation (POST), status is read-only (GET)
  - slug: return-full-extraction-metadata
    summary: Status endpoint returns examId, questionCount, confidence, warnings
    rationale: Enables UI to show import results and navigate to exam
metrics:
  duration: 2min
  completed: 2026-02-02
---

# Phase 08 Plan 02: PDF Import API Routes Summary

**One-liner:** Two REST endpoints for PDF upload (with validation, MinIO storage, BullMQ enqueue) and job status polling (returns examId on completion).

---

## Objective

Create the two API routes for PDF exam import: upload endpoint (validates PDF, stores in MinIO, enqueues BullMQ job) and status polling endpoint (returns job progress and exam ID on completion). These endpoints connect the frontend upload UI to the backend processing pipeline.

---

## What Was Built

### 1. PDF Upload API Route (`app/api/exam-import/upload/route.ts`)

**POST /api/exam-import/upload**

Validates and processes PDF uploads for exam import:

- **Authentication:** Requires teacher role (TEACHER, SCHOOL_ADMIN, PLATFORM_ADMIN)
- **Authorization:** Verifies CSRF token (mutation endpoint)
- **Validation:**
  - File exists
  - File type is `application/pdf`
  - File size ≤ 32 MB
  - courseId provided in FormData
- **Processing:**
  - Converts file to Buffer
  - Generates unique key via `generateUploadKey(file.name)`
  - Uploads to MinIO via `uploadFile(key, buffer, file.type)`
  - Enqueues BullMQ job with `{ userId, pdfKey, institutionId, courseId }`
- **Response:** `{ jobId: string, status: 'processing' }`
- **Error handling:**
  - 401: Not authenticated
  - 403: Not teacher / CSRF failed
  - 400: Invalid file/missing fields
  - 503: Queue/storage not available
  - 500: Unexpected errors

**Pattern:** Follows existing `app/api/upload/route.ts` pattern with PDF-specific validation.

### 2. Job Status Polling API Route (`app/api/exam-import/status/[jobId]/route.ts`)

**GET /api/exam-import/status/[jobId]**

Polls BullMQ job state and returns results:

- **Authentication:** Requires valid session
- **State handling:**
  - `active/waiting/delayed` → `{ status: 'processing' }`
  - `completed` → `{ status: 'completed', examId, questionCount, confidence, warnings }`
  - `failed` → `{ status: 'failed', error: string }`
- **Redis connection:** Module-level connection to avoid leaks
- **Queue instance:** Module-level `Queue` instance for `pdf-import` queue
- **Error handling:**
  - 401: Not authenticated
  - 404: Job not found
  - 500: Unexpected errors

**Pattern:** Follows Phase 5 export status polling pattern with structured return values.

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Decisions Made

### 1. 32 MB PDF upload limit

**Context:** Plan specified 32 MB limit, higher than the 10 MB image limit.

**Decision:** Implemented 32 MB validation in upload route.

**Rationale:** PDFs with many pages, high-resolution scans, or embedded images can easily exceed 10 MB. 32 MB provides headroom for typical exam PDFs while preventing abuse.

**Files:** `app/api/exam-import/upload/route.ts`

### 2. Module-level Redis connection in status route

**Context:** Status endpoint needs to poll BullMQ job state via Redis.

**Decision:** Created Redis connection and Queue instance at module level (not per-request).

**Rationale:** Creating a new connection per request causes connection leaks and exhausts Redis connections. Module-level connection is reused across requests, following the pattern from `lib/queue.ts`.

**Files:** `app/api/exam-import/status/[jobId]/route.ts`

### 3. CSRF protection on upload only, not status

**Context:** Upload is a mutation (POST), status is read-only (GET).

**Decision:** Implemented CSRF verification in upload route, not status route.

**Rationale:** GET requests are safe methods that don't require CSRF protection. Only mutating endpoints (POST/PUT/DELETE) need CSRF tokens.

**Files:** `app/api/exam-import/upload/route.ts`

### 4. Return full extraction metadata in status endpoint

**Context:** Worker returns `{ examId, questionCount, confidence, warnings }` on completion.

**Decision:** Status endpoint returns all four fields when job completes.

**Rationale:** Enables UI to display import results (question count, confidence level) and warnings before navigating to the exam. Provides transparency about extraction quality.

**Files:** `app/api/exam-import/status/[jobId]/route.ts`

---

## Testing Notes

### Type Safety

- `npx tsc --noEmit` passes with no errors
- All imports resolve correctly
- Dynamic route parameter `[jobId]` properly typed

### Upload Validation

- PDF type check: `file.type === 'application/pdf'`
- Size check: `file.size <= 32 * 1024 * 1024`
- courseId check: Required in FormData
- Non-PDF files rejected with 400
- Oversized files rejected with 400
- Missing courseId rejected with 400

### Status Polling

- Returns `processing` for active/waiting/delayed states
- Returns `completed` with examId on success
- Returns `failed` with error message on failure
- Returns 404 for non-existent jobs

### Authentication & Authorization

- Both endpoints require authentication (401 if missing)
- Upload requires teacher role (403 if student)
- Upload requires CSRF token (403 if invalid)
- Status endpoint accessible to all authenticated users

### Error Handling

- MinIO configuration errors return 503
- Queue unavailability returns 503
- Unexpected errors return 500 with logged details

---

## Integration Points

### Upstream (Dependencies)

- **08-01 (PDF Extraction Pipeline):** Worker processes jobs enqueued by upload route
- **lib/storage/minio.ts:** Uses `uploadFile`, `generateUploadKey`
- **lib/queue.ts:** Uses `pdfImportQueue` to enqueue jobs
- **lib/api-auth.ts:** Uses `getAuthSession`, `isTeacher`
- **lib/csrf.ts:** Uses `verifyCsrf`, `getCsrfCookieToken`

### Downstream (Affected By)

- **08-03 (UI Integration):** Frontend will call these endpoints for upload and polling
- Future plans can reference these endpoints for PDF import features

---

## Performance Characteristics

- **Upload route:** Synchronous validation + MinIO upload + BullMQ enqueue (~500ms typical)
- **Status route:** Single Redis query via BullMQ (~10-20ms typical)
- **Polling pattern:** Client polls status endpoint every 1-2 seconds until completion

---

## Next Phase Readiness

### What's Ready

- PDF upload endpoint validates and stores files
- Job status polling endpoint tracks extraction progress
- Authentication and CSRF protection in place
- Error handling for common failure modes

### What's Needed for 08-03

- Frontend UI for file upload (dropzone or file input)
- Status polling component with progress indicator
- Navigation to exam editor on completion
- Display of confidence level and warnings

### Blockers

None. Both API routes are functional and ready for frontend integration.

---

## Files Changed

### Created (2 files)

| File | Lines | Purpose |
|------|-------|---------|
| `app/api/exam-import/upload/route.ts` | 143 | POST endpoint for PDF upload with validation, MinIO storage, BullMQ enqueue |
| `app/api/exam-import/status/[jobId]/route.ts` | 116 | GET endpoint for polling job state, returns examId on completion |

### Modified (0 files)

None.

---

## Commits

| Commit | Message | Files |
|--------|---------|-------|
| f039b85 | feat(08-02): create PDF upload API route | upload/route.ts |
| 9d19e3d | feat(08-02): create job status polling API route | status/[jobId]/route.ts |

---

## Tags

`pdf-import` `api-routes` `upload` `status-polling` `bullmq` `minio` `validation` `authentication` `csrf`

---

**Phase 08 Plan 02 complete.** API routes ready for frontend integration in 08-03.

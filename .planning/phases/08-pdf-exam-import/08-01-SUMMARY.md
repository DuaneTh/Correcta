---
phase: 08-pdf-exam-import
plan: 01
subsystem: ai-extraction
tags: [openai, gpt-4o, pdf, bullmq, zod, structured-outputs, exam-import]

# Dependency graph
requires:
  - phase: 04-ai-correction
    provides: OpenAI client configuration, AI logging infrastructure, grader pattern
  - phase: 05-export
    provides: BullMQ queue pattern, MinIO presigned URL pattern
provides:
  - PDF exam extraction pipeline with GPT-4o structured outputs
  - Zod schemas for exam structure validation
  - BullMQ queue for async PDF processing
  - Worker script that creates exams from extracted data
affects: [08-02-pdf-upload-ui, 08-03-import-status-tracking, 08-04-exam-review-editing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GPT-4o native PDF vision via image_url content type"
    - "Zod schemas with French descriptions for structured extraction"
    - "Presigned MinIO URLs for AI-accessible PDFs"
    - "BullMQ job queue with concurrency limits for AI operations"
    - "ContentSegments JSON format for question storage"

key-files:
  created:
    - lib/exam-import/schemas.ts
    - lib/exam-import/extractor.ts
    - scripts/pdf-import-worker.ts
  modified:
    - lib/queue.ts
    - lib/grading/ai-logger.ts

key-decisions:
  - "GPT-4o with native PDF vision (no OCR preprocessing required)"
  - "Temperature 0.1 for consistent extraction (low but not deterministic)"
  - "Concurrency 1 for PDF import queue (API/token intensive)"
  - "Store correctionGuidelines in Question.generatedRubric field"
  - "ContentSegments JSON format for question content"
  - "TEXT type for open questions (matches QuestionType enum)"

patterns-established:
  - "PDF extraction: presigned URL → GPT-4o image_url → structured output via Zod"
  - "Worker creates exam + default section + questions + segments atomically"
  - "MCQ choices stored as QuestionSegments with isCorrect flag"
  - "TEXT questions stored with single QuestionSegment"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 8 Plan 01: PDF Extraction Pipeline Summary

**GPT-4o PDF vision with Zod structured outputs extracts exam questions, types, points, and rubrics into database via BullMQ worker**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T12:42:57Z
- **Completed:** 2026-02-02T12:45:45Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GPT-4o extractor with native PDF vision capabilities (no OCR preprocessing)
- Zod schemas capture questions, types (TEXT/MCQ), points, correction guidelines
- BullMQ pdfImportQueue with worker creates exams in database from extracted data
- Worker creates proper Exam → ExamSection → Question → QuestionSegment hierarchy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create extraction schemas and GPT-4o extractor function** - `62d6649` (feat)
   - ExamExtractionSchema and ExtractedQuestionSchema with French descriptions
   - extractExamFromPDF using GPT-4o with presigned MinIO URLs
   - Added PDF_IMPORT operation type to ai-logger

2. **Task 2: Add pdfImportQueue and create worker script** - `fd9a0f6` (feat)
   - pdfImportQueue in queue.ts with 2 attempts, 5s backoff
   - pdf-import-worker.ts processes 'import-exam' jobs
   - Worker creates exam with default section and all questions atomically

## Files Created/Modified
- `lib/exam-import/schemas.ts` - Zod schemas for exam extraction with confidence metadata
- `lib/exam-import/extractor.ts` - GPT-4o PDF extractor with image_url content type
- `scripts/pdf-import-worker.ts` - BullMQ worker that creates exams from extracted data
- `lib/queue.ts` - Added pdfImportQueue alongside existing queues
- `lib/grading/ai-logger.ts` - Added PDF_IMPORT operation type

## Decisions Made

**1. GPT-4o native PDF vision (not OCR preprocessing)**
- GPT-4o supports PDF/image analysis via image_url content type
- Eliminates need for OCR libraries (pdf-parse, Tesseract)
- Better understanding of layout, formatting, mathematical notation

**2. Temperature 0.1 for extraction (not 0)**
- Some flexibility helps with ambiguous layouts
- Lower than rubric generation (0.3) but not fully deterministic
- Reduces likelihood of hallucinating content

**3. Concurrency 1 for PDF import queue**
- PDF extraction uses significant tokens (high detail vision)
- OpenAI API rate limits apply
- Unlike grading (concurrency 5), PDF jobs are heavier

**4. Store correctionGuidelines in Question.generatedRubric**
- Reuses existing generatedRubric JSON field on Question model
- Consistent with Phase 4 AI grading pattern
- Enables AI grading to use extracted rubrics

**5. ContentSegments JSON format for Question.content**
- Matches existing pattern: JSON.stringify([{type: 'text', text: '...'}])
- Consistent with exam editor state management
- Enables rich content (future: images, code blocks)

**6. TEXT type (not OPEN_QUESTION) for open questions**
- Matches QuestionType enum in schema.prisma
- Existing system uses TEXT for non-MCQ questions
- Aligns with question editor factories

## Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 2 - Missing Critical] Added PDF_IMPORT operation type to ai-logger**
- **Found during:** Task 1 (TypeScript compilation of extractor.ts)
- **Issue:** AIOperation type only had 'GRADING', 'RUBRIC_GENERATION', 'TEST'
- **Fix:** Added 'PDF_IMPORT' to AIOperation union type
- **Files modified:** lib/grading/ai-logger.ts
- **Verification:** TypeScript compilation passed
- **Committed in:** 62d6649 (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered
None - plan executed smoothly following Phase 4 (grading) and Phase 5 (export) patterns.

## User Setup Required
None - uses existing OpenAI API key configuration from Phase 4.

## Next Phase Readiness

**Ready for:**
- 08-02: PDF upload UI (API endpoint to enqueue jobs)
- 08-03: Import status tracking (poll job status, display progress)
- 08-04: Exam review and editing (display extracted questions, allow modifications)

**Provides:**
- `extractExamFromPDF(pdfKey, userId)` - Core extraction function
- `pdfImportQueue.add('import-exam', { userId, pdfKey, institutionId, courseId })` - Job enqueue API
- Worker processes jobs and creates exams in DRAFT status

**No blockers:** Pipeline complete, ready for UI integration.

---
*Phase: 08-pdf-exam-import*
*Completed: 2026-02-02*

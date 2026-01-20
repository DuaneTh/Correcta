# Phase 4 Plan 1: GPT-4 Integration Summary

**Completed:** 2026-01-20
**Duration:** ~15 minutes
**Tasks:** 3/3

## One-Liner

GPT-4 integration with structured outputs for AI grading via OpenAI SDK, Zod schemas, rubric generation, and worker integration.

## What Was Built

### OpenAI SDK Integration
- Installed `openai` package (v6.16.0)
- Created `lib/grading/openai-client.ts` with singleton client
- Configured for `gpt-4o` model
- Added configuration check function `isOpenAIConfigured()`

### Grading Schemas (Zod)
- `GradingResponseSchema`: score, feedback, aiRationale
- `RubricSchema`: criteria array with name/points/description, totalPoints
- TypeScript types exported for type safety
- Located at `lib/grading/schemas.ts`

### French Prompts
- `GRADING_SYSTEM_PROMPT`: Instructions for neutral academic feedback
- `RUBRIC_GENERATION_PROMPT`: Instructions for generating grading criteria
- Helper functions `buildGradingUserPrompt` and `buildRubricUserPrompt`
- LaTeX support documented ($...$ delimiters)

### Rubric Generator
- `generateRubric()` function using GPT-4 with zodResponseFormat
- Temperature 0.3 for creativity in rubric generation
- Auto-normalizes points if total doesn't match maxPoints

### Grading Function
- `gradeAnswer()` function using GPT-4 with zodResponseFormat
- Temperature 0 for deterministic grading
- Auto-clamps score to [0, maxPoints] range

### API Endpoints
Created `/api/questions/[questionId]/rubric`:
- **GET**: Fetch existing rubric (teacher only)
- **POST**: Generate rubric using AI (teacher only, CSRF)
- **PUT**: Update rubric manually (teacher only, CSRF)

### Database Schema
- Added `generatedRubric Json?` field to Question model
- Applied via `prisma db push`

### Worker Integration
Updated `scripts/ai-grading-worker.ts`:
- Imports `gradeAnswer` from lib/grading/grader
- Converts question/answer segments to LaTeX strings
- Prefers `generatedRubric` from question, fallback to segment criteria
- Preserves human grade protection (skip if gradedByUserId or isOverridden)
- Detailed logging for debugging

## Key Files

| File | Purpose |
|------|---------|
| `lib/grading/openai-client.ts` | OpenAI SDK singleton |
| `lib/grading/schemas.ts` | Zod schemas for grading responses |
| `lib/grading/prompts.ts` | French system prompts |
| `lib/grading/rubric-generator.ts` | Rubric generation function |
| `lib/grading/grader.ts` | Answer grading function |
| `app/api/questions/[questionId]/rubric/route.ts` | Rubric API endpoints |
| `scripts/ai-grading-worker.ts` | BullMQ worker with GPT-4 calls |
| `prisma/schema.prisma` | Added generatedRubric field |

## Commits

| Hash | Description |
|------|-------------|
| 27bd03d | feat(04-01): add OpenAI SDK and grading schemas |
| 1bfc36e | feat(04-01): add rubric generator and grading functions |
| 9fb84df | feat(04-01): integrate GPT-4 grading in worker |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed scoreMultipleChoiceAnswer async requirement**
- **Found during:** Task 1 build verification
- **Issue:** `scoreMultipleChoiceAnswer` function in `lib/actions/exam-taking.ts` was not async, but all functions in 'use server' files must be async
- **Fix:** Made function async with Promise return type, updated all callers
- **Files modified:** `lib/actions/exam-taking.ts`, `app/api/attempts/[id]/submit/route.ts`, `scripts/test-attempt-flow.ts`, `scripts/test-mcq-scoring.ts`
- **Commit:** Part of 27bd03d

**2. [Rule 1 - Bug] Fixed OpenAI SDK API usage**
- **Found during:** Task 2 build verification
- **Issue:** Used `openai.beta.chat.completions.parse()` but correct API is `openai.chat.completions.parse()`
- **Fix:** Changed to non-beta API path
- **Files modified:** `lib/grading/grader.ts`, `lib/grading/rubric-generator.ts`
- **Commit:** Part of 1bfc36e

**3. [Rule 1 - Bug] Fixed Zod error property access**
- **Found during:** Task 2 build verification
- **Issue:** Used `parseResult.error.errors` but correct property is `parseResult.error.issues`
- **Fix:** Changed to `.issues`
- **Files modified:** `app/api/questions/[questionId]/rubric/route.ts`
- **Commit:** Part of 1bfc36e

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Temperature 0.3 for rubric generation | Allows some creativity while maintaining consistency |
| Temperature 0 for grading | Deterministic grading for fairness |
| Fallback to segment rubric criteria | Backwards compatibility with existing correction guidelines |
| Default rubric if none available | Worker shouldn't fail silently |

## Technical Notes

### OpenAI SDK Version
Using v6.16.0 which uses `openai.chat.completions.parse()` (not beta path) for structured outputs with Zod.

### Content Conversion
- Uses `segmentsToLatexString()` from `lib/content.ts`
- Converts ContentSegment arrays to string with $...$ math delimiters
- Tables converted to tab-separated values
- Graphs shown as [graph] placeholder

### Human Grade Protection
Worker skips grading if:
- `gradedByUserId !== null` (human graded)
- `isOverridden === true` (teacher override)

## Next Phase Readiness

Ready for 04-02 (Grading UI):
- Rubric generation API available at `/api/questions/[questionId]/rubric`
- Worker processes AI grading jobs with real GPT-4 calls
- All grading infrastructure in place

### Dependencies Provided
- `generateRubric()` - For UI to trigger rubric generation
- `gradeAnswer()` - For worker to grade answers
- `GradingResponse` type - For typing grading results
- `Rubric` type - For typing rubric data

---
phase: 02-exam-creation
plan: 04
subsystem: exam-taking
tags: [exam-taking, mcq-scoring, autosave, timer, student-ui]

dependency-graph:
  requires:
    - "02-01: Exam Editor Shell (exam structure, question types)"
    - "01-*: Math foundation (MathRenderer, StringMathField)"
  provides:
    - "Server actions for exam attempt lifecycle"
    - "MCQ auto-scoring on submission"
    - "QuestionRenderer component for TEXT and MCQ"
    - "ExamPlayer with timer and navigation"
    - "ExamTimer with visual countdown"
    - "Take exam page at /student/exams/[examId]/take"
  affects:
    - "Phase 4: AI Correction (TEXT grading placeholder created)"
    - "Results/grading views (Grade records now exist for MCQ)"

tech-stack:
  added: []
  patterns:
    - "Server actions for exam lifecycle operations"
    - "MCQ scoring with partial credit and all-or-nothing modes"
    - "Debounced autosave (2 second delay)"
    - "Timer-based auto-submit on expiry"

key-files:
  created:
    - lib/actions/exam-taking.ts
    - components/exam-taking/QuestionRenderer.tsx
    - components/exam-taking/ExamPlayer.tsx
    - components/exam-taking/ExamTimer.tsx
    - components/exam-taking/index.ts
    - app/student/exams/[examId]/take/page.tsx
    - app/student/exams/[examId]/take/ExamStartPage.tsx
    - scripts/test-mcq-scoring.ts
    - scripts/test-attempt-flow.ts
  modified:
    - app/api/attempts/[id]/submit/route.ts (added MCQ auto-scoring)

decisions:
  - id: MCQ-SCORING-ON-SUBMIT
    choice: "Score MCQ questions immediately on submission"
    rationale: "Provides instant feedback, no waiting for grading job"
  - id: PARTIAL-CREDIT-MODE
    choice: "Support both partial credit and all-or-nothing MCQ modes"
    rationale: "Teacher flexibility via requireAllCorrect flag on questions"
  - id: AUTO-SCORED-FLAG
    choice: "Use aiRationale='AUTO_SCORED_MCQ' to flag auto-scored grades"
    rationale: "Distinguishes from AI grading in Phase 4, reuses existing Grade model"
  - id: GRADING-TASK-PLACEHOLDER
    choice: "Create GradingTask for TEXT questions on submit"
    rationale: "Ready for Phase 4 AI grading integration"

metrics:
  duration: "12 minutes"
  completed: "2026-01-19"
---

# Phase 02 Plan 04: Student Exam Taking Summary

Student-facing exam taking interface with MCQ auto-scoring on submission.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 71865f4 | feat | Add exam-taking server actions with MCQ auto-scoring |
| 01f900a | feat | Add QuestionRenderer component for exam taking |
| de9afa2 | feat | Add exam player shell with timer and navigation |
| 1ec8a96 | feat | Integrate MCQ auto-scoring into submit API |

## What Was Built

### 1. Server Actions (`lib/actions/exam-taking.ts`)

Four server actions for exam taking operations:

- `startAttempt(examId)` - Creates or resumes exam attempt
- `saveAnswer(attemptId, questionId, segmentId, content)` - Autosaves student response
- `submitAttempt(attemptId)` - Submits with MCQ auto-scoring
- `getAttemptState(attemptId)` - Retrieves attempt details with grades

Plus helper function:
- `scoreMultipleChoiceAnswer(question, studentAnswers)` - MCQ scoring logic

### 2. MCQ Auto-Scoring

Scoring logic supports two modes:

**Partial Credit (default):**
```
score = (correct_selections - incorrect_selections) / total_correct_options * points
```
- Correct selection: +1
- Incorrect selection: -1
- Minimum score: 0

**All or Nothing (`requireAllCorrect: true`):**
- Full points only if selected options exactly match correct options
- 0 points otherwise

### 3. QuestionRenderer Component

Reusable component for rendering questions during exam taking:

- **TEXT questions**: StringMathField with math toolbar support
- **MCQ questions**: Checkbox options with optional seeded shuffling
- Saving status indicators (saving/saved/error)
- Student tools configuration (math/table/graph)
- Points display per question

### 4. ExamPlayer Component

Main exam taking interface with:

- **Question navigation sidebar**: List of questions with answered status
- **ExamTimer**: Visual countdown with warnings at 5min and 1min
- **Auto-save**: 2-second debounce on answer changes
- **Auto-submit**: Automatic submission when timer expires
- **Previous/Next buttons**: Navigate between questions

### 5. Take Exam Page

Entry point for students at `/student/exams/[examId]/take`:

- Server component checks permissions and time window
- Redirects to exam room if attempt exists and in progress
- Shows ExamStartPage cover page with exam details
- Creates attempt and redirects on "Start Exam"

### 6. Submit API Integration

Updated `/api/attempts/[id]/submit` to include MCQ auto-scoring:

- Fetches full attempt with answers and question details
- Scores MCQ answers using `scoreMultipleChoiceAnswer`
- Creates Grade records with `aiRationale: 'AUTO_SCORED_MCQ'`
- Creates GradingTask for TEXT questions (Phase 4 placeholder)

## User Flow

1. Student navigates to `/student/exams/[examId]/take`
2. Sees exam cover page with details (duration, questions, materials)
3. Clicks "Start Exam" - attempt created, redirected to exam room
4. Timer starts counting down
5. Answers questions (TEXT in StringMathField, MCQ with checkboxes)
6. Answers auto-save every 2 seconds after changes
7. Can refresh page - answers are restored
8. Submits manually or timer auto-submits at 0
9. MCQ answers immediately graded, TEXT questions queued for Phase 4
10. Redirected to exam list

## Deviations from Plan

### Integration with Existing Code

The plan specified creating new files at `components/exam-taking/`. However, the codebase already had a comprehensive exam room implementation at `app/student/attempts/[attemptId]/ExamRoomClient.tsx`.

**Decision**: Created the new components as specified AND integrated MCQ auto-scoring into the existing submit API route. This ensures both:
- New components available for future use
- Existing ExamRoomClient benefits from MCQ auto-scoring

### Files Created vs Modified

Plan expected modifications to existing files, but those files didn't exist at the specified paths. Created new files instead and integrated with existing API route.

## Technical Notes

- MCQ scoring function is exported and can be imported in both server actions and API routes
- Grade records use `aiRationale` field to distinguish auto-scored from AI-graded
- GradingTask created for TEXT questions prepares for Phase 4
- Test scripts verify scoring logic works correctly

## Verification Checklist

- [x] Server actions created for attempt lifecycle
- [x] MCQ scoring function with partial credit support
- [x] MCQ scoring function with all-or-nothing support
- [x] QuestionRenderer handles TEXT and MCQ
- [x] ExamPlayer with timer and navigation
- [x] ExamTimer with visual warnings
- [x] Take exam page with start flow
- [x] Submit API integrates auto-scoring
- [x] Grade records created for MCQ on submit
- [x] GradingTask created for TEXT on submit
- [x] All tests pass
- [x] TypeScript compiles without errors
- [x] ESLint passes

## Next Phase Readiness

Ready for Phase 4 (AI Correction). The infrastructure provides:
- GradingTask records created on submission
- TEXT answers stored in AnswerSegment
- Grade model ready for AI-generated grades
- Clear separation: MCQ auto-scored, TEXT pending AI

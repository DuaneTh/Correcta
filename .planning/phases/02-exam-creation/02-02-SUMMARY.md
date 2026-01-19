---
phase: 02-exam-creation
plan: 02
subsystem: exam-editor
tags: [question-editors, mcq, open-questions, correction-guidelines, ai-grading]

dependency-graph:
  requires:
    - "02-01: Exam editor shell, store, server actions"
  provides:
    - "QuestionEditorFactory for type-based rendering"
    - "OpenQuestionEditor with correction guidelines for AI grading"
    - "MultipleChoiceEditor with dynamic options management"
    - "MCQ-specific store actions (add/remove/toggle options)"
  affects:
    - "02-03: Will integrate math toolbar into editors"
    - "02-04: MCQ scoring logic available for student taking"
    - "04-*: Correction guidelines enable AI grading"

tech-stack:
  added: []
  patterns:
    - "Factory pattern for question type routing"
    - "Callback-based handlers for clean component API"
    - "Validation warnings for incomplete questions"

key-files:
  created:
    - components/exam-editor/question-types/QuestionEditorFactory.tsx
    - components/exam-editor/question-types/OpenQuestionEditor.tsx
    - components/exam-editor/question-types/MultipleChoiceEditor.tsx
    - components/exam-editor/question-types/index.ts
  modified:
    - components/exam-editor/store.ts (correctionGuidelines field, MCQ actions)
    - components/exam-editor/QuestionPanel.tsx (uses factory)
    - components/exam-editor/AddQuestionButton.tsx (passes correctionGuidelines)
    - lib/actions/exam-editor.ts (includes correctionGuidelines in responses)

decisions:
  - id: FACTORY-PATTERN
    choice: "QuestionEditorFactory component for type routing"
    rationale: "Clean switch-based rendering, easy to extend for CODE type"
  - id: CORRECTION-GUIDELINES-FIELD
    choice: "Store correctionGuidelines at question level"
    rationale: "Simpler than per-segment rubrics for V1, enables AI grading in Phase 4"
  - id: MCQ-STORE-ACTIONS
    choice: "Dedicated MCQ actions in Zustand store"
    rationale: "Clean API for option management, avoids complex generic segment operations"
  - id: ALL-OR-NOTHING-MODE
    choice: "requireAllCorrect toggle for MCQ scoring"
    rationale: "Supports both per-option and all-or-nothing grading modes"

metrics:
  duration: "11 minutes"
  completed: "2026-01-19"
---

# Phase 02 Plan 02: Question Type Editors Summary

Implemented specific editors for Open (TEXT) and MCQ questions, including correction guidelines for future AI grading and full MCQ option management.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 45cb8b2 | feat | Create Question Editor Factory with type routing |
| 8535f4f | feat | Implement Open Question Editor with correction guidelines |
| 4c602b2 | feat | Implement MCQ Editor with options management |

## What Was Built

### 1. QuestionEditorFactory (`components/exam-editor/question-types/QuestionEditorFactory.tsx`)

Routes to the correct editor based on question type:

```typescript
switch (question.type) {
  case 'TEXT': return <OpenQuestionEditor />
  case 'MCQ': return <MultipleChoiceEditor />
  case 'CODE': return <div>Not implemented</div>
}
```

Integrated into QuestionPanel to replace the placeholder.

### 2. OpenQuestionEditor (`components/exam-editor/question-types/OpenQuestionEditor.tsx`)

Full editor for TEXT questions with:

**Fields:**
- Question Body (textarea with empty warning)
- Answer Segments (instruction + points per segment)
- Correction Guidelines (textarea for AI grading)

**Features:**
- Content editing via ContentSegments (text type)
- Per-segment instruction and points editing
- Correction guidelines with hint: "Adding guidelines improves AI grading accuracy"
- Validation warning for empty content

**correctionGuidelines field:**
- Added to `EditorQuestion` interface
- Stored at question level (not per-segment)
- Will be used by AI grader in Phase 4
- Currently mapped to first segment's rubric.criteria for persistence

### 3. MultipleChoiceEditor (`components/exam-editor/question-types/MultipleChoiceEditor.tsx`)

Full editor for MCQ questions with:

**Question Body:**
- Same content editing as OpenQuestionEditor

**Scoring Mode:**
- Toggle: "All-or-nothing scoring"
- Per-option mode: Points per option
- All-or-nothing mode: Single maxPoints field

**Options Management:**
- Add option button
- Remove option (trash icon)
- Option text input
- Correct answer toggle (green checkmark)
- Points per option (when not all-or-nothing)
- Letter labels (A, B, C, D...)

**Validation:**
- Warning when no correct answer selected
- Warning when option text is empty
- Visual feedback: correct options highlighted green

### 4. Store Updates (`components/exam-editor/store.ts`)

**New Field:**
```typescript
interface EditorQuestion {
  // ... existing fields
  correctionGuidelines: string | null
}
```

**New MCQ Actions:**
```typescript
addMcqOption: (questionId: string) => void
removeMcqOption: (questionId: string, segmentId: string) => void
toggleMcqOptionCorrect: (questionId: string, segmentId: string) => void
```

### 5. Server Action Updates (`lib/actions/exam-editor.ts`)

- `getExamForEditor`: Returns `correctionGuidelines` (from first segment's rubric criteria)
- `addQuestion`: Returns `correctionGuidelines: null` for new questions

## User Flow

### TEXT Question:
1. Add TEXT question via sidebar
2. Question opens in panel with OpenQuestionEditor
3. Type question body in textarea
4. Edit segment instruction and points
5. Add correction guidelines for AI grading
6. State auto-updates via Zustand (isDirty = true)

### MCQ Question:
1. Add MCQ question via sidebar
2. Question opens with empty options
3. Click "Add First Option"
4. Type option text (A, B, C...)
5. Click green circle to mark correct
6. Add more options as needed
7. Toggle all-or-nothing mode if desired
8. Set points per option or total points
9. Validation warnings show if issues

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

- `correctionGuidelines` is stored client-side during editing; persistence uses existing rubric.criteria field
- MCQ options use `segments` array, where `instruction` is option text and `isCorrect` marks correct answers
- Factory uses `useQuestion` selector for reactive updates
- All handlers use `useCallback` for performance

## Verification Checklist

- [x] QuestionEditorFactory routes to correct editor
- [x] TEXT editor has body, segments, and correction guidelines
- [x] MCQ editor allows adding/removing options
- [x] MCQ editor allows marking correct answers
- [x] MCQ editor supports all-or-nothing mode
- [x] Validation warnings display for issues
- [x] State persists when switching questions
- [x] TypeScript compiles without errors

## Next Phase Readiness

Ready for 02-03 (Image Upload Integration). The editors provide:
- Clear integration points for math toolbar
- Image upload can be added to content editing
- Question body textareas ready for rich content

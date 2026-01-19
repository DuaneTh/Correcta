---
phase: 02-exam-creation
plan: 01
subsystem: exam-editor
tags: [zustand, server-actions, exam-editing, state-management, ui-shell]

dependency-graph:
  requires:
    - "01-*: Math foundation (toolbar, rendering)"
  provides:
    - "Exam editor page at /teacher/exams/[examId]/edit"
    - "Zustand store for exam state management"
    - "Server actions for CRUD operations"
    - "Question list sidebar with type indicators"
    - "Running total points display"
  affects:
    - "02-02: Question type editors"
    - "02-03: Image upload integration"
    - "02-04: Student exam taking"

tech-stack:
  added:
    - zustand@5.x
  patterns:
    - "Zustand store with typed selectors"
    - "Server actions for data mutations"
    - "Optimistic UI updates"

key-files:
  created:
    - lib/actions/exam-editor.ts
    - components/exam-editor/store.ts
    - components/exam-editor/ExamEditor.tsx
    - components/exam-editor/ExamHeader.tsx
    - components/exam-editor/ExamSidebar.tsx
    - components/exam-editor/AddQuestionButton.tsx
    - components/exam-editor/QuestionPanel.tsx
    - app/teacher/exams/[examId]/edit/page.tsx
    - scripts/test-exam-actions.ts
  modified:
    - package.json (added zustand)

decisions:
  - id: ZUSTAND-STORE
    choice: "Zustand for exam editor state management"
    rationale: "Lightweight, TypeScript-friendly, no boilerplate, easy selectors"
  - id: SERVER-ACTIONS
    choice: "Server actions instead of API routes for mutations"
    rationale: "Better DX with Next.js 15, automatic revalidation, type safety"
  - id: TOTAL-POINTS-SELECTOR
    choice: "Derived selector for total points calculation"
    rationale: "Avoids recalculation on every render, handles MCQ and TEXT differently"
  - id: TYPE-DROPDOWN
    choice: "Dropdown button for question type selection"
    rationale: "Explicit choice between TEXT and MCQ, extensible for future types"

metrics:
  duration: "9 minutes"
  completed: "2026-01-19"
---

# Phase 02 Plan 01: Exam Editor Shell Summary

Core infrastructure for exam editing: Zustand store, server actions, UI shell with question management and running total display.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 372c6d2 | feat | Add exam editor server actions (createDraftExam, getExamForEditor, updateExamMetadata, addQuestion, deleteQuestion) |
| 5205888 | feat | Add Zustand store with typed state, actions, and selectors |
| f351308 | feat | Add exam editor UI shell with question management |

## What Was Built

### 1. Server Actions (`lib/actions/exam-editor.ts`)

Five server actions for exam editor operations:

- `createDraftExam(courseId)` - Creates new DRAFT exam with default section
- `getExamForEditor(examId)` - Fetches full exam with sections, questions, segments for editing
- `updateExamMetadata(examId, data)` - Updates title, description, duration
- `addQuestion(examId, type, sectionId?)` - Creates TEXT or MCQ question with defaults
- `deleteQuestion(questionId)` - Removes question with cascade cleanup

All actions:
- Validate user authentication and permissions
- Use `getExamPermissions` for access control
- Revalidate paths after mutations
- Return typed data matching store interfaces

### 2. Zustand Store (`components/exam-editor/store.ts`)

Type-safe store with:

**State:**
- `exam: EditorExam | null` - Full exam data
- `isDirty: boolean` - Unsaved changes flag
- `isSaving: boolean` - Save in progress
- `activeQuestionId: string | null` - Selected question

**Actions:**
- `initialize(exam)` / `reset()` - Lifecycle
- `updateMetadata(data)` - Title/description changes
- `addQuestion(question, sectionId)` - Add to section
- `removeQuestion(questionId)` - Delete from state
- `updateQuestion(questionId, data)` - Modify question
- `updateSegment(questionId, segmentId, data)` - Modify segment

**Selectors:**
- `useTotalPoints()` - Calculated total (handles MCQ vs TEXT)
- `useQuestionCount()` - Question count
- `useQuestion(id)` - Get single question
- `useAllQuestions()` - Flat list with section info

### 3. UI Components

**ExamEditor.tsx** - Main layout with header, sidebar, content area
**ExamHeader.tsx:**
- Editable title (click to edit, blur to save)
- Course info display
- Stats badges: question count, total points
- Status indicator (DRAFT/PUBLISHED)
- Save button (disabled when clean, loading state)

**ExamSidebar.tsx:**
- Question list with type icons (FileText/ListChecks)
- Points display per question
- Active question highlighting
- Delete button (visible on hover)
- AddQuestionButton at bottom

**AddQuestionButton.tsx:**
- Dropdown with type options
- "Open Question (TEXT)" with description
- "Multiple Choice (MCQ)" with description
- Calls server action, updates store on success

**QuestionPanel.tsx:**
- Placeholder for question editing (02-02)
- Shows question type, points, content preview
- Segments list for TEXT questions
- Options list for MCQ questions

## User Flow

1. Navigate to `/teacher/exams/[examId]/edit`
2. Page loads exam via `getExamForEditor`
3. ExamEditor initializes Zustand store
4. Header shows "New Exam" title (editable)
5. Sidebar shows empty question list
6. Click "Add Question" -> dropdown appears
7. Select "Open Question" -> server creates question, store updates
8. Question appears in sidebar with "1 pt"
9. "Total: 1 points" badge updates in header
10. Click question in sidebar -> QuestionPanel shows details
11. Edit title -> isDirty becomes true, Save enabled
12. Click Save -> server action updates, isDirty resets

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

- Types carefully aligned between server actions and store
- Prisma's `JsonValue` cast to `StudentToolsConfig` for type safety
- Points calculation handles MCQ `requireAllCorrect` mode
- Store uses direct state updates (no immer for simplicity)

## Verification Checklist

- [x] Server actions created with all 5 functions
- [x] Zustand store with typed state and actions
- [x] ExamEditor page loads exam data
- [x] Editable title updates local state
- [x] AddQuestionButton shows type picker dropdown
- [x] TEXT question creates with 1pt segment
- [x] MCQ question creates without segments
- [x] Total points badge updates dynamically
- [x] Question list shows type icons and points
- [x] TypeScript compiles without errors

## Next Phase Readiness

Ready for 02-02 (Question Type Editors). The shell provides:
- Store infrastructure for question updates
- UI slots for question-specific editors
- Server action patterns to extend

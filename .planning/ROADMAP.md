# Roadmap: Correcta

**Created:** 2026-01-18
**Core Value:** Teachers create exams, AI corrects with personalized feedback
**Depth:** Standard (7 phases)

---

## Overview

Correcta delivers an AI-powered exam platform for the ESSEC pilot. The roadmap progresses through five phases: establishing math input/rendering foundation, refactoring exam creation UX, organizing classes and users, implementing GPT-4 auto-correction, and enabling data export. Each phase delivers verifiable capability that builds toward the complete correction workflow.

---

## Phase 1: Math Foundation

**Goal:** Students can input mathematical expressions using buttons, and math renders consistently across all web surfaces (editor, answer review, grading view).

**Dependencies:** None (foundation phase)

**Requirements:**
- MATH-01: WYSIWYG editor with symbol buttons (no visible LaTeX)
- MATH-02: Support fractions, exponents, square roots via buttons
- MATH-03: Greek symbol palette (alpha, beta, theta, pi, etc.)
- MATH-04: Integrals, sums, limits with clickable index positions
- MATH-05: Consistent KaTeX rendering in editor preview and answer review (PDF export addressed in Phase 5 EXPO-04)

**Plans:** 3 plans (2 original + 1 gap closure)

Plans:
- [x] 01-01-PLAN.md — MathToolbar component with button-based symbol insertion
- [x] 01-02-PLAN.md — Replace MathJax with KaTeX for consistent rendering
- [x] 01-03-PLAN.md — Add MathRenderer to GradingView (gap closure)

**Success Criteria:**
1. Student can type a fraction (e.g., 1/2) by clicking buttons without seeing LaTeX syntax
2. Student can insert Greek letters from a visible palette
3. Student can create an integral with upper/lower bounds by clicking placeholder positions
4. Equation entered in MathLive displays identically in answer review and teacher grading view (visual parity test for web surfaces)
5. Math editor loads in under 500ms and responds to input without lag

---

## Phase 2: Exam Creation

**Goal:** Teachers can create complete exams with multiple question types through an intuitive interface.

**Dependencies:** Phase 1 (math rendering for questions and answer previews)

**Requirements:**
- EXAM-01: Intuitive exam creation UX (refactor existing)
- EXAM-02: Open questions with configurable grading scale
- EXAM-03: MCQ with multiple options and auto-correction
- EXAM-04: Image questions (photo upload in question text)
- EXAM-05: Isolated answers per question (not whole PDF)

**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — Exam Editor shell, Zustand store, question management
- [x] 02-02-PLAN.md — Question type editors (Open with correction guidelines, MCQ)
- [x] 02-03-PLAN.md — Image upload and math toolbar integration
- [x] 02-04-PLAN.md — Student exam taking with MCQ auto-scoring

**Success Criteria:**
1. Teacher can create a 5-question exam (2 open, 2 MCQ, 1 image) in under 10 minutes
2. Teacher can set point values per question and see total points calculated
3. Student can answer each question independently and submit without uploading a PDF
4. MCQ questions auto-score on submission with correct/incorrect feedback
5. Image in question displays at appropriate size without breaking layout

---

## Phase 3: Organization

**Goal:** School admins can manage classes, subgroups, and user roles for their institution.

**Dependencies:** None (can run in parallel with Phase 2)

**Requirements:**
- ORG-01: Create classes by school admin
- ORG-02: Create subgroups within a class (TD, TP, etc.)
- ORG-03: Assign students to classes and subgroups
- ORG-04: CSV/Excel import for bulk user creation
- ORG-05: Role assignment (teacher, school admin)

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md — Hierarchical subgroups via parentId schema extension
- [x] 03-02-PLAN.md — CSV upload UI for bulk user creation
- [x] 03-03-PLAN.md — Role promotion (teacher to school admin)

**Success Criteria:**
1. School admin can create a class named "Finance 2026" with 3 subgroups (TD1, TD2, TD3)
2. School admin can assign 30 students to a class and distribute them across subgroups
3. School admin can upload a CSV with 100 users and see them created with correct roles
4. School admin can promote a teacher to school admin role
5. Students appear in correct class/subgroup when teacher creates an exam

---

## Phase 4: AI Correction

**Goal:** GPT-4 automatically grades student answers with personalized feedback, with optional teacher review.

**Dependencies:** Phase 1 (math in prompts), Phase 2 (exams and answers exist)

**Requirements:**
- CORR-01: Automatic correction via GPT-4 based on defined rubric
- CORR-02: Personalized feedback generated for each student answer
- CORR-03: Optional teacher review before publishing grades (can publish directly)
- CORR-04: Review interface to validate/modify grades and feedback
- CORR-05: Support for math answers (LaTeX) in AI prompt

**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md — OpenAI integration, Zod schemas, rubric generation
- [x] 04-02-PLAN.md — Batch grading "Grade All" with progress tracking
- [x] 04-03-PLAN.md — Teacher review UI (edit modal, re-grade button)
- [x] 04-04-PLAN.md — Publication flow and student feedback view

**Success Criteria:**
1. Teacher clicks "Grade All" and sees progress indicator for 50 student submissions
2. Each graded answer shows AI-generated feedback explaining the score
3. Teacher can choose to publish grades immediately or review first
4. Teacher can modify AI-assigned grade and feedback before publishing
5. Math expressions in student answers appear correctly in AI feedback (LaTeX round-trip)

---

## Phase 5: Export

**Goal:** Teachers can export grades and reports for institutional workflows.

**Dependencies:** Phase 1 (KaTeX in PDF), Phase 2 (exam data), Phase 4 (grades exist)

**Requirements:**
- EXPO-01: CSV export of grades (columns: student, question, grade, total)
- EXPO-02: PDF report with details (grades, feedback, answers)
- EXPO-03: Filter export by class/subgroup
- EXPO-04: Consistent math rendering in PDF (KaTeX via renderLatexToString from Phase 1)

**Plans:** 3 plans

Plans:
- [x] 05-01-PLAN.md — CSV export with Papaparse (grades table download)
- [x] 05-02-PLAN.md — PDF infrastructure (@react-pdf/renderer + MathJax SVG)
- [x] 05-03-PLAN.md — Async PDF export with progress tracking

**Success Criteria:**
1. Teacher can download CSV with all grades for an exam in under 5 seconds
2. Teacher can generate PDF report showing each student's answers, grades, and feedback
3. Teacher can filter export to only TD1 subgroup and get correct subset
4. Math expressions in PDF match exactly what was shown on screen (no rendering differences)
5. Export of 200+ submissions completes without timeout (async with progress indicator)

---

## Phase 6: UI Kit Integration

**Goal:** All application pages use a consistent UI Kit (components from feat/kourpat1), replacing raw HTML/Tailwind with typed, reusable components.

**Dependencies:** Phase 1-5 (all pages exist and are functional)

**Requirements:**
- UIKIT-01: cn() utility and base design tokens (already delivered by kourpat1)
- UIKIT-02: Migrate admin pages (school admin, platform admin) to UI Kit components
- UIKIT-03: Migrate teacher pages (courses, exams, grading) to UI Kit components
- UIKIT-04: Migrate student pages (courses, exams, results) to UI Kit components
- UIKIT-05: Consolidate modals (grading, export, confirm) using UI Kit patterns
- UIKIT-06: UI Kit showcase page at /internal/ui-kit (already delivered by kourpat1)

**Plans:** 8 plans

Plans:
- [x] 06-01-PLAN.md — Cherry-pick UI Kit components from kourpat1 branch
- [x] 06-02-PLAN.md — Migrate large admin pages (Institutions, Classes, Users)
- [x] 06-03-PLAN.md — Migrate small admin pages + platform admin + layouts
- [x] 06-04-PLAN.md — Migrate teacher pages + grading pages
- [x] 06-05-PLAN.md — Migrate student pages
- [x] 06-06-PLAN.md — Migrate large grading components (Distribution, AttemptDetail, Rubric, GradeAll)
- [x] 06-07-PLAN.md — Migrate small grading modals + export modal
- [x] 06-08-PLAN.md — Migrate CourseFormModal (1840 lines)

**Success Criteria:**
1. All pages use Button, Card, Text, Layout components instead of raw HTML
2. No raw `className` strings for common patterns (badges, cards, buttons) outside UI Kit components
3. Consistent visual language across admin, teacher, and student interfaces
4. /internal/ui-kit page showcases all available components with variants
5. TeacherCoursesClient serves as reference implementation for migration pattern

---

## Phase 7: Intelligent Proctoring

**Goal:** Browser-based exam integrity monitoring — webcam deterrent (camera on, no analysis), browser lockdown with focus loss detection, paste origin verification, suspicious pattern analysis, and teacher review dashboard.

**Dependencies:** Phase 2 (exam taking flow), Phase 6 (UI Kit for consistent UI)

**Requirements:**
- PROCT-01: Webcam deterrent mode (camera permission prompt + active indicator, no recording/analysis)
- PROCT-02: Toggleable proctoring per exam (teacher enables/disables webcam + lockdown independently)
- PROCT-03: Browser lockdown detection (tab switches, focus loss, external paste detection)
- PROCT-04: Focus loss pattern analysis (correlate focus losses with answer timing = suspicious)
- PROCT-05: Activity logging with timestamped events for teacher review
- PROCT-06: Teacher proctoring review dashboard (per-student timeline, suspicion score, event patterns)

**Plans:** 4 plans

Plans:
- [x] 07-01-PLAN.md — Proctoring config types + exam settings panel with toggles
- [x] 07-02-PLAN.md — Focus loss pattern analysis engine (TDD)
- [x] 07-03-PLAN.md — Client-side proctoring monitor (webcam deterrent + browser lockdown)
- [x] 07-04-PLAN.md — Enhanced teacher proctoring dashboard with pattern indicators

**Success Criteria:**
1. Student opening a proctored exam sees camera permission prompt and active camera indicator (deterrent only)
2. Student switching tabs triggers a logged event visible to teacher
3. Student pasting text from external source (not from within the exam page) is flagged differently from internal paste
4. Repeated focus loss before answering questions is detected as a suspicious pattern
5. Teacher can toggle webcam deterrent and browser lockdown independently per exam
6. Teacher can review a timeline of proctoring events per student with suspicion indicators

---

## Phase 8: PDF Exam Import

**Goal:** Teachers can upload an existing exam PDF, which is analyzed by AI to automatically create a structured exam with questions, point allocations, and correction guidelines — landing the teacher directly in the exam editor with pre-filled questions ready for review and modification.

**Dependencies:** Phase 2 (exam editor), Phase 4 (OpenAI integration)

**Requirements:**
- IMPORT-01: PDF upload in exam creation flow (drag-and-drop or file picker)
- IMPORT-02: AI analysis of PDF to extract questions, point values, and structure
- IMPORT-03: Automatic question type detection (open question vs MCQ)
- IMPORT-04: Auto-generated correction guidelines from extracted rubric/answer key
- IMPORT-05: Seamless landing in existing exam editor with pre-filled questions (teacher can modify freely)

**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md — Extraction schemas, GPT-4o extractor, BullMQ queue + worker
- [ ] 08-02-PLAN.md — Upload API route + job status polling endpoint
- [ ] 08-03-PLAN.md — PDF upload UI with react-dropzone + exam creation flow integration

**Success Criteria:**
1. Teacher can upload a PDF exam and see a progress indicator during AI analysis
2. AI correctly identifies and separates individual questions from the PDF
3. Point values are extracted or intelligently assigned based on PDF content
4. Teacher lands in the standard exam editor with all questions pre-created
5. Teacher can modify, reorder, delete, or add questions after import — full editor functionality preserved

---

## Progress

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 - Math Foundation | Math input and consistent web rendering | MATH-01, MATH-02, MATH-03, MATH-04, MATH-05 (web) | Complete |
| 2 - Exam Creation | Intuitive exam authoring with multiple question types | EXAM-01, EXAM-02, EXAM-03, EXAM-04, EXAM-05 | Complete |
| 3 - Organization | Class, subgroup, and user management | ORG-01, ORG-02, ORG-03, ORG-04, ORG-05 | Complete |
| 4 - AI Correction | GPT-4 auto-grading with feedback and review | CORR-01, CORR-02, CORR-03, CORR-04, CORR-05 | Complete |
| 5 - Export | CSV/PDF export with math rendering | EXPO-01, EXPO-02, EXPO-03, EXPO-04 (PDF math) | Complete |
| 6 - UI Kit Integration | Consistent UI components across all pages | UIKIT-01 through UIKIT-06 | Complete |
| 7 - Intelligent Proctoring | Webcam deterrent + browser lockdown + focus pattern analysis + review dashboard | PROCT-01 through PROCT-06 | Complete |
| 8 - PDF Exam Import | AI-powered PDF analysis to auto-create exams from existing documents | IMPORT-01 through IMPORT-05 | Planned |

---

## Execution Notes

**Parallel Execution:** Phase 3 (Organization) can run in parallel with Phase 2 (Exam Creation) since they have no dependencies on each other. This can accelerate delivery if resources allow.

**Critical Path:** Phase 1 -> Phase 2 -> Phase 4 -> Phase 5 is the critical path. Phase 3 joins the critical path before Phase 4 if teachers need class context for exam assignment.

**Research Flags (from research/SUMMARY.md):**
- Phase 2: A/B test exam builder UX (simple vs complex)
- Phase 4: Validate 80% confidence threshold for AI review gating
- Phase 5: PDF snapshot regression testing for math rendering

**Scope Clarifications:**
- MATH-05 is split across phases: web surface parity in Phase 1, PDF parity in Phase 5 (EXPO-04)
- Phase 1 creates `renderLatexToString` export for Phase 5 PDF generation
- Phase 3: Research found 80% of infrastructure exists; 3 focused extension plans instead of 5
- Phase 5: MathJax used for PDF (produces SVG), KaTeX used for web (produces HTML)
- Phase 7: Webcam is deterrent ONLY (no recording, no snapshots, no AI Vision). Uses native getUserMedia, not react-webcam. Focus loss pattern analysis is the core intelligence.
- Phase 8: Uses GPT-4o native PDF support (no pdf-parse). BullMQ async processing. react-dropzone for upload UI. All other infrastructure already exists.

---

*Roadmap created: 2026-01-18*
*Coverage: 24/24 v1 requirements mapped + 6 UIKIT requirements + 6 PROCT requirements + 5 IMPORT requirements*

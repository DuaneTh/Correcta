# Roadmap: Correcta

**Created:** 2026-01-18
**Core Value:** Teachers create exams, AI corrects with personalized feedback
**Depth:** Standard (5 phases)

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

**Success Criteria:**
1. Teacher can download CSV with all grades for an exam in under 5 seconds
2. Teacher can generate PDF report showing each student's answers, grades, and feedback
3. Teacher can filter export to only TD1 subgroup and get correct subset
4. Math expressions in PDF match exactly what was shown on screen (no rendering differences)
5. Export of 200+ submissions completes without timeout (async with progress indicator)

---

## Progress

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 - Math Foundation | Math input and consistent web rendering | MATH-01, MATH-02, MATH-03, MATH-04, MATH-05 (web) | Complete |
| 2 - Exam Creation | Intuitive exam authoring with multiple question types | EXAM-01, EXAM-02, EXAM-03, EXAM-04, EXAM-05 | Pending |
| 3 - Organization | Class, subgroup, and user management | ORG-01, ORG-02, ORG-03, ORG-04, ORG-05 | Pending |
| 4 - AI Correction | GPT-4 auto-grading with feedback and review | CORR-01, CORR-02, CORR-03, CORR-04, CORR-05 | Pending |
| 5 - Export | CSV/PDF export with math rendering | EXPO-01, EXPO-02, EXPO-03, EXPO-04 (PDF math) | Pending |

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

---

*Roadmap created: 2026-01-18*
*Coverage: 24/24 v1 requirements mapped*

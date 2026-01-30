---
status: testing
phase: 02-exam-creation
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-01-19T15:30:00Z
updated: 2026-01-19T15:30:00Z
---

## Current Test

number: 1
name: Navigate to Exam Editor
expected: |
  Navigate to /teacher/exams/[examId]/edit (any existing exam or create new).
  Page loads showing exam title, empty or populated question list in sidebar.
awaiting: user response

## Tests

### 1. Navigate to Exam Editor
expected: Navigate to /teacher/exams/[examId]/edit. Page loads showing exam title and question list sidebar.
result: issue
reported: "la création des questions est une usine à gaz, je n'aime pas le gros bloc implémenté pour insérer des formules mathématiques, je ne veux pas qu'il apparaisse par défaut mais soit en cliquant sur un bouton soit juste en faisant glisser la souris dessus, aussi une fois dans l'éditeur katex la création des formules ne fonctionne pas bien, par exemple quand j'insère une fraction j'ai du mal à séléctionner au dessus ou en dessous de la fraction pour en modifier la valeur et je voudrais par exemple être capable de naviguer avec les flêches directionnelles"
severity: major

### 2. Add Open Question
expected: Click "Add Question" button, select "Open Question". New question appears in sidebar with type icon (text file) and "1 pt".
result: [pending]

### 3. Add MCQ Question
expected: Click "Add Question" button, select "Multiple Choice". New question appears in sidebar with type icon (checklist) and "0 pts" (no options yet).
result: [pending]

### 4. Running Total Points
expected: After adding questions, header shows total points badge (e.g., "Total: 2 points") that updates when questions are added/removed.
result: [pending]

### 5. Edit Open Question Body
expected: Click an open question in sidebar. Editor panel shows textarea for question body. Type content and see it update.
result: [pending]

### 6. Add Correction Guidelines
expected: In open question editor, find "Correction Guidelines" textarea. Add text like "Answer should mention X, Y, Z". Field saves with question.
result: [pending]

### 7. MCQ Add Options
expected: Click an MCQ question. Click "Add Option" button. Option row appears with text input and correct answer toggle. Can add multiple options (A, B, C...).
result: [pending]

### 8. MCQ Mark Correct Answer
expected: Click the checkmark/toggle button on an option to mark it as correct. Option shows visual feedback (green highlight or filled checkmark).
result: [pending]

### 9. Insert Math Symbol
expected: In question editor, click a math symbol in toolbar (e.g., fraction). Symbol code appears in textarea at cursor position (e.g., "$\frac{}{}$").
result: [pending]

### 10. Upload Image
expected: Click "Add Image" button. Drag or click to upload an image. After upload completes, markdown appears in textarea (![image](url)) and preview shows the image.
result: [pending]

### 11. Preview Renders Math and Images
expected: Toggle Preview on. Math symbols render as formatted equations (fractions, Greek letters). Images display at appropriate size.
result: [pending]

### 12. Student Take Exam - Start
expected: As student, navigate to /student/exams/[examId]/take. See cover page with exam info. Click "Start Exam". Timer begins counting down.
result: [pending]

### 13. Student Answer TEXT Question
expected: Navigate to a TEXT question. Input field appears (may have math toolbar). Type answer. See saving indicator.
result: [pending]

### 14. Student Answer MCQ Question
expected: Navigate to an MCQ question. Options display as checkboxes. Select option(s). See saving indicator.
result: [pending]

### 15. Autosave Works
expected: Answer a question, wait 2-3 seconds. Refresh page. Answer is still there (was autosaved).
result: [pending]

### 16. Submit Exam
expected: Click "Submit Exam" button (or let timer expire). Exam is submitted. MCQ answers are immediately scored.
result: [pending]

## Summary

total: 16
passed: 0
issues: 0
pending: 16
skipped: 0

## Gaps

[none yet]

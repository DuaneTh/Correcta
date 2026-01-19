# Phase 2: Exam Creation - Context

**Gathered:** 2026-01-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Teachers can create complete exams with multiple question types (open questions, MCQ, image questions) through an intuitive interface. This phase covers exam authoring only - grading, results viewing, and grade harmonization are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Builder Layout
- Single page with sections (not wizard/steps)
- Numbered vertical list of questions with drag-and-drop reordering
- Optional sections/parts to group questions (teacher can add if they want)
- Metadata at top: title, description, time limit, target class/group
- Honor declaration option: optional phrase students must retype manually (no copy-paste allowed)

### Question Editor
- "Add question" button that opens type picker (Open, MCQ, Image)
- Inline editing directly in question cards (not modal)
- Teacher chooses which formatting options students have access to (per-exam setting)
- MCQ options: add/remove buttons per option, flexible number of options

### Point System
- MCQ: points per correct answer, option for negative points, option for "all correct required" vs partial credit
- Open questions: teacher writes correction guidelines (notice de correction) for AI to interpret, or leave standard questions to AI discretion
- Auto-calculate and display running total as questions are added
- No passing threshold in exam creation (handled in results/grading phase later)

### Image Handling
- Images appear inline in question text (student answers below image like paper exam)
- Upload via click or drag-and-drop (both methods)
- Auto-fit sizing only (no manual resize)
- Optional caption below image

### Claude's Discretion
- Exact drag-and-drop implementation
- Question card styling and spacing
- Error states and validation messages
- Auto-save behavior

</decisions>

<specifics>
## Specific Ideas

- Honor declaration must prevent copy-paste - students must type it character by character
- Questions should feel like a paper exam layout - image above, answer area below
- Correction guidelines for open questions should be free-form text that AI interprets

</specifics>

<deferred>
## Deferred Ideas

- Passing threshold setting - belongs in results/grading phase
- Grade harmonization - separate phase
- Question preview as student sees it - could be added but not core to creation

</deferred>

---

*Phase: 02-exam-creation*
*Context gathered: 2026-01-19*

# Phase 4: AI Correction - Context

**Gathered:** 2026-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

GPT-4 automatically grades student answers with personalized feedback, with optional teacher review before publication. Teachers trigger grading manually, can review/edit results, and publish grades to students as a batch.

</domain>

<decisions>
## Implementation Decisions

### Grading Flow
- **Trigger:** Manual — teacher clicks "Grade All" when ready
- **Pre-grading step:** Generate a "notice de correction" (grading rubric) from the question + teacher guidelines before grading any answers
- **Notice review:** Teacher can optionally edit the generated rubric before launching corrections
- **Uniform grading:** Same rubric injected for every student answer to ensure fairness across all copies
- **Progress UI:** When on grading screen: progress bar + list of in-progress/completed/pending corrections. Outside: simple status indicator (graded/in progress/not started)
- **Cancellation:** Cancel button available — keeps already graded answers
- **Error handling:** Retry 2-3 times on failure, then skip and continue with remaining answers

### Feedback Generation
- **Tone:** Neutral academic — "La réponse est partiellement correcte. Points manquants : ..."
- **Structure:** Free-form — AI structures as appropriate for context
- **Length:** Proportional — short if correct, detailed if errors to explain
- **Rubric reference:** Implicit — uses criteria without explicitly citing them
- **Math in feedback:** AI can include LaTeX formulas that will be rendered

### Teacher Review UX
- **Review requirement:** Optional — teacher can publish directly or review first
- **Publication:** Manual only, never automatic
- **Publication scope:** Entire class at once ("Publier toutes les notes")
- **Edit interface:** Modal for editing note/feedback
- **Re-grade option:** Button to re-trigger AI correction on a specific copy

### Math Handling
- **Input to AI:** Both structured text (LaTeX/data) AND visual capture for complex content (tables, formulas)
- **Visual capture approach:** Claude's discretion — screenshot or generated PDF
- **AI output:** Can include LaTeX in feedback, will be rendered with KaTeX

### Student View
- **Results access:** Students can view their corrected copies with answers, grades, and feedback in the app

</decisions>

<specifics>
## Specific Ideas

- "Même si une nouvelle instance d'IA est lancée pour chaque copie, la correction est la même pour tous" — equity through shared rubric
- Visual context for AI to see exactly what students saw (especially for tables/graphs)
- PDF export of feedback is Phase 5 (Export), but student viewing in-app is this phase

</specifics>

<deferred>
## Deferred Ideas

- PDF export of student feedback — Phase 5 (Export)
- Confidence threshold for auto-flagging low-confidence grades — v2 (CORR-06)

</deferred>

---

*Phase: 04-ai-correction*
*Context gathered: 2026-01-20*

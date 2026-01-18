# Feature Landscape: AI Exam Platform

**Domain:** Automated assessment and grading for educational institutions
**Researched:** 2026-01-18

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Exam creation with questions | Core product requirement; instructors must author assessments | Medium | Multiple question types (short answer, essay, multiple choice) |
| Point assignment per question | Standard assessment practice; required for grading | Low | Flexible point scales (1-100+) |
| Time limits and proctoring controls | Essential for exam integrity; prevents cheating | Medium | Per-exam and per-section time controls |
| Student exam-taking interface | Primary user workflow; must be intuitive and reliable | High | Responsive design, auto-save, review/submit flow |
| Basic grading and results display | Fundamental requirement; no grading = incomplete product | Medium | Score calculation, student-visible results |
| Student result viewing | Users expect to see their performance | Low | Score, attempt review, feedback per question |
| Instructor exam management | Teachers need to view, edit, duplicate, archive exams | Low | Dashboard showing all exams with metadata |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI auto-correction with feedback | Dramatically reduces grading time; personalizes student learning | High | Context-aware feedback, partial credit, rubric alignment |
| WYSIWYG math editor (no LaTeX) | Removes technical barriers for non-technical instructors and students | High | Equation rendering, symbol palettes, intuitive UI |
| Class and subgroup management | Enables flexible exam distribution and granular analytics | Medium | Student rosters, custom groups, group-level analytics |
| CSV/PDF export of results | Integrates with existing institutional workflows | Low | Bulk export, customizable columns, archive capability |
| Attempt analytics and insights | Data-driven improvement; shows which questions confuse students | Medium | Time-per-question, skip patterns, confidence indicators |
| Plagiarism/similarity detection | Increases exam integrity for essay questions | High | Requires ML model training; institution-specific baseline |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full PDF/image upload of exams | Breaks answer isolation; prevents AI analysis of responses; creates storage/processing burden | Use form-based question creation; allow image attachments only for specific question types (diagrams, formulas) |
| Direct LaTeX input for students/instructors | Creates high friction; requires technical knowledge; difficult to parse for AI | Use WYSIWYG math editor with LaTeX rendering on backend only |
| Real-time collaborative exam editing | Adds massive complexity; creates sync conflicts; breaks audit trail | Lock exams during student attempts; version control for drafts |
| Unlimited question branching/logic | Quickly becomes unmaintainable; creates grading nightmare | Simple linear flow; optional question groups with show/hide rules only |
| Peer review/grading workflows | Out of scope; requires significant moderation tooling; dilutes AI focus | Focus on instructor + AI grading; peer review as future feature |

## Feature Dependencies

```
Exam Taking Interface
  ├─ Exam Creation (must exist to take)
  ├─ Time Limits (controls exam duration)
  └─ Question Types (defines interaction patterns)

Student Results
  ├─ Basic Grading (requires scores)
  ├─ AI Auto-correction (optional but high-value for open-ended questions)
  └─ Exam Taking Interface (source of answers)

Class/Subgroup Management
  ├─ Student Management (requires roster)
  └─ Exam Distribution (target for sending exams)

Analytics & Export
  ├─ Student Results (requires data to analyze)
  ├─ CSV Export (batch data extraction)
  └─ Class Management (segments data by group)
```

## MVP Recommendation

For MVP, prioritize:

1. **Exam Creation** - Build form-based question creation (text, multiple choice, short answer). Support point assignment and time limits.
2. **Student Exam-Taking Interface** - Clean, responsive UI with auto-save, review/confirm before submit.
3. **Basic Grading** - Automatic scoring for multiple choice; manual scoring UI for open-ended questions.
4. **WYSIWYG Math Editor** - Differentiate early; removes friction for STEM instructors (target audience).

Defer to post-MVP:

- **AI Auto-correction with Feedback** - Too complex for MVP; launch with basic scoring first, add AI after initial user feedback on question types.
- **Class/Subgroup Management** - MVP supports single-class rosters; add multi-group support in Phase 2.
- **CSV/PDF Export** - Valuable but non-blocking; add in Phase 2.
- **Plagiarism Detection** - Advanced feature; defer to Phase 3+.
- **Analytics Dashboard** - Can start with basic reporting; enhance analytics as data accumulates.

## Reasoning for Phasing

**Why WYSIWYG in MVP?** Differentiation and instructor adoption. Removing LaTeX friction early signals product polish and removes a major barrier for non-technical users.

**Why defer AI grading?** Requires:
1. Question type classification
2. Rubric training
3. Response analysis pipeline
4. Feedback generation

Better to launch with solid manual + automated scoring, then integrate AI. Customers need confidence in basic grading first.

**Why not PDF upload?** Prevents future AI enhancement. Form-based questions enable rich feedback, analytics, and plagiarism detection. PDFs become write-only, dead ends.

## Sources

- Standard exam platform features (Canvas, Moodle, Google Forms)
- STEM education research on math notation barriers
- Assessment best practices (question banks, rubrics, attempt analytics)

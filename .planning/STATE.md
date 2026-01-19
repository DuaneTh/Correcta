# State: Correcta

**Last Updated:** 2026-01-19

---

## Project Reference

**Core Value:** Teachers create exams, AI corrects with personalized feedback

**Current Focus:** ESSEC pilot - improve existing codebase to production quality

**Key Constraints:**
- Stack: Next.js App Router, React, Prisma, PostgreSQL (existing)
- AI: OpenAI GPT-4 for correction
- UX: Buttons only for math input, no visible LaTeX
- Timeline: ESSEC pilot in weeks

---

## Current Position

**Phase:** 2 of 5 (Exam Creation)
**Plan:** 4 of 4 complete
**Status:** Phase complete

**Progress:**
```
Phase 1: Math Foundation     [==========] 3/3 plans complete
Phase 2: Exam Creation       [==========] 4/4 plans complete
Phase 3: Organization        [          ] Not started
Phase 4: AI Correction       [          ] Not started
Phase 5: Export              [          ] Not started
```

**Overall:** 7/7 plans complete for Phases 1-2

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans completed | 7 | 01-01, 01-02, 01-03, 02-01, 02-02, 02-03, 02-04 |
| Success rate | 100% | 7/7 plans succeeded |
| Avg duration | 10 min | (8 + 12 + 5 + 9 + 11 + 8 + 12) / 7 |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| MathLive for input | Already installed, WYSIWYG, good LaTeX export | 1 |
| KaTeX for rendering | Fast (10x vs MathJax), synchronous, consistent fonts | 1 |
| BullMQ for AI jobs | Already installed, async prevents timeout | 4 |
| @react-pdf/renderer | Lightweight, no Chromium needed | 5 |
| Categorized symbols with MathLive placeholders | Enables tab-navigation in templates | 1 |
| Callback-based toolbar integration | Allows toolbar to insert into active MathLive field | 1 |
| renderLatexToString export | Enables PDF export without re-implementing | 1 |
| Synchronous math rendering | No loading states, simpler code, faster UX | 1 |
| Per-segment rendering in GradingView | Preserves answer structure, cleaner than join | 1 |
| Zustand for exam editor state | Lightweight, TypeScript-friendly, easy selectors | 2 |
| Server actions for mutations | Better DX with Next.js 15, automatic revalidation | 2 |
| Type dropdown for questions | Explicit TEXT/MCQ choice, extensible | 2 |
| QuestionEditorFactory pattern | Type-based routing, easy to extend for CODE | 2 |
| correctionGuidelines at question level | Simpler than per-segment for V1, enables AI grading | 2 |
| MCQ-specific store actions | Clean API for option management | 2 |
| All-or-nothing MCQ mode | Supports both per-option and total points scoring | 2 |
| MCQ auto-scoring on submit | Instant feedback, no waiting for grading job | 2 |
| Partial credit MCQ mode | (correct - incorrect) / total * points formula | 2 |
| AUTO_SCORED_MCQ flag | aiRationale field distinguishes from AI grading | 2 |
| GradingTask for TEXT | Placeholder ready for Phase 4 AI grading | 2 |
| Proxy upload through Next.js API | Avoids CORS/presigned URL complexity with local MinIO | 2 |
| Markdown image syntax ![alt](url) | Standard, portable between storage backends | 2 |
| $...$ math delimiters in textarea | Works with MathRenderer, familiar LaTeX syntax | 2 |

### Technical Patterns

- **Math interchange:** Store all answers as LaTeX strings in DB
- **Async grading:** Queue jobs via BullMQ, never call OpenAI in request handlers
- **Export pattern:** Async job queue for large exports, stream to client
- **MathLive placeholders:** Use #@ for cursor position, #0 for tab navigation
- **Math rendering:** KaTeX synchronous, no CDN dependency, bundled via npm
- **Content display:** Always wrap content in MathRenderer for math support
- **Exam editor state:** Zustand store with typed selectors, optimistic updates
- **Server actions:** For data mutations with permission checks and revalidation
- **Question editors:** Factory pattern routes to type-specific components
- **MCQ options:** Use segments array where instruction is text, isCorrect is flag
- **MCQ scoring:** scoreMultipleChoiceAnswer function, supports partial/all-or-nothing
- **Autosave:** 2-second debounce on answer changes
- **Timer auto-submit:** Auto-submits when timer reaches 0
- **Image storage:** MinIO with public bucket, proxy upload via API route
- **Rich text editing:** RichTextEditor combines MathToolbar + ImageUpload + Preview
- **Content rendering:** QuestionPreview parses markdown images + $...$ math

### Known Issues

(None yet - will accumulate during execution)

### TODOs

- [x] Complete 01-01: Math Symbol Toolbar
- [x] Complete 01-02: Math Rendering with KaTeX
- [x] Complete 01-03: GradingView MathRenderer Integration (gap closure)
- [x] Plan Phase 2: Exam Creation (4 plans created and verified)
- [x] Complete 02-01: Exam Editor Shell
- [x] Complete 02-02: Question Type Editors
- [x] Complete 02-03: Image Upload Integration
- [x] Complete 02-04: Student Exam Taking
- [ ] Plan Phase 3: Organization
- [ ] Plan Phase 4: AI Correction
- [ ] Plan Phase 5: Export

### Blockers

(None currently)

---

## Session Continuity

### Resumption Prompt

```
Continuing Correcta project.
Phase 1 (Math Foundation) COMPLETE.
Phase 2 (Exam Creation) COMPLETE:
- 02-01: COMPLETE - Exam Editor shell, store, question management, running total
- 02-02: COMPLETE - Question type editors (Open with correction guidelines, MCQ)
- 02-03: COMPLETE - Image upload and math toolbar integration
- 02-04: COMPLETE - Student exam taking with MCQ auto-scoring

Next action: Plan Phase 3 (Organization) or execute existing plans
```

### Context Files

- `.planning/PROJECT.md` - Core value, constraints
- `.planning/REQUIREMENTS.md` - All v1 requirements with traceability
- `.planning/ROADMAP.md` - Phase structure and success criteria
- `.planning/research/SUMMARY.md` - Technical decisions and pitfalls
- `.planning/phases/01-math-foundation/01-01-SUMMARY.md` - Math Toolbar summary
- `.planning/phases/01-math-foundation/01-02-SUMMARY.md` - KaTeX Rendering summary
- `.planning/phases/01-math-foundation/01-03-SUMMARY.md` - GradingView gap closure summary
- `.planning/phases/02-exam-creation/02-01-SUMMARY.md` - Exam Editor Shell summary
- `.planning/phases/02-exam-creation/02-02-SUMMARY.md` - Question Type Editors summary
- `.planning/phases/02-exam-creation/02-03-SUMMARY.md` - Image Upload Integration summary
- `.planning/phases/02-exam-creation/02-04-SUMMARY.md` - Student Exam Taking summary

---

*State initialized: 2026-01-18*
*Last execution: 2026-01-19 - Completed 02-03-PLAN.md (Image Upload Integration)*

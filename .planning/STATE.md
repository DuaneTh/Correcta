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

**Phase:** 1 of 5 (Math Foundation)
**Plan:** 1 of 2 complete
**Status:** In progress

**Progress:**
```
Phase 1: Math Foundation     [=         ] 1/2 plans complete
Phase 2: Exam Creation       [          ] Not started
Phase 3: Organization        [          ] Not started
Phase 4: AI Correction       [          ] Not started
Phase 5: Export              [          ] Not started
```

**Overall:** 1/? plans complete

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans completed | 1 | 01-01 Math Toolbar |
| Success rate | 100% | 1/1 plans succeeded |
| Avg duration | 8 min | First plan baseline |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| MathLive for input | Already installed, WYSIWYG, good LaTeX export | 1 |
| KaTeX for rendering | Fast, consistent across web/PDF, installed | 1 |
| BullMQ for AI jobs | Already installed, async prevents timeout | 4 |
| @react-pdf/renderer | Lightweight, no Chromium needed | 5 |
| Categorized symbols with MathLive placeholders | Enables tab-navigation in templates | 1 |
| Callback-based toolbar integration | Allows toolbar to insert into active MathLive field | 1 |

### Technical Patterns

- **Math interchange:** Store all answers as LaTeX strings in DB
- **Async grading:** Queue jobs via BullMQ, never call OpenAI in request handlers
- **Export pattern:** Async job queue for large exports, stream to client
- **MathLive placeholders:** Use #@ for cursor position, #0 for tab navigation

### Known Issues

(None yet - will accumulate during execution)

### TODOs

- [x] Complete 01-01: Math Symbol Toolbar
- [ ] Complete 01-02: Math Rendering with KaTeX

### Blockers

(None currently)

---

## Session Continuity

### Resumption Prompt

```
Continuing Correcta project. Phase 1 in progress.
Plan 01-01 (Math Toolbar) completed successfully.
Next action: Execute Plan 01-02 (Math Rendering) with /gsd:execute-phase 1 or plan next phase component.
```

### Context Files

- `.planning/PROJECT.md` - Core value, constraints
- `.planning/REQUIREMENTS.md` - All v1 requirements with traceability
- `.planning/ROADMAP.md` - Phase structure and success criteria
- `.planning/research/SUMMARY.md` - Technical decisions and pitfalls
- `.planning/phases/01-math-foundation/01-01-SUMMARY.md` - Math Toolbar summary

---

*State initialized: 2026-01-18*
*Last execution: 2026-01-19 - Completed 01-01-PLAN.md*

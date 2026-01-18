# State: Correcta

**Last Updated:** 2026-01-18

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

**Phase:** Not started
**Plan:** None active
**Status:** Roadmap created, awaiting phase planning

**Progress:**
```
Phase 1: Math Foundation     [ ] Not started
Phase 2: Exam Creation       [ ] Not started
Phase 3: Organization        [ ] Not started
Phase 4: AI Correction       [ ] Not started
Phase 5: Export              [ ] Not started
```

**Overall:** 0/24 requirements complete (0%)

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans completed | 0 | - |
| Success rate | - | No plans executed yet |
| Avg iterations | - | No plans executed yet |

---

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| MathLive for input | Already installed, WYSIWYG, good LaTeX export | 1 |
| KaTeX for rendering | Fast, consistent across web/PDF, installed | 1 |
| BullMQ for AI jobs | Already installed, async prevents timeout | 4 |
| @react-pdf/renderer | Lightweight, no Chromium needed | 5 |

### Technical Patterns

- **Math interchange:** Store all answers as LaTeX strings in DB
- **Async grading:** Queue jobs via BullMQ, never call OpenAI in request handlers
- **Export pattern:** Async job queue for large exports, stream to client

### Known Issues

(None yet - will accumulate during execution)

### TODOs

- [ ] Start Phase 1 planning with `/gsd:plan-phase 1`

### Blockers

(None currently)

---

## Session Continuity

### Resumption Prompt

```
Continuing Correcta project. Currently at roadmap stage, no phase started.
Next action: Plan Phase 1 (Math Foundation) with /gsd:plan-phase 1
```

### Context Files

- `.planning/PROJECT.md` - Core value, constraints
- `.planning/REQUIREMENTS.md` - All v1 requirements with traceability
- `.planning/ROADMAP.md` - Phase structure and success criteria
- `.planning/research/SUMMARY.md` - Technical decisions and pitfalls

---

*State initialized: 2026-01-18*

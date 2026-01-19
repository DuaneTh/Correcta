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

**Phase:** 1 of 5 (Math Foundation) COMPLETE
**Plan:** 2 of 2 complete
**Status:** Phase complete

**Progress:**
```
Phase 1: Math Foundation     [==========] 2/2 plans complete
Phase 2: Exam Creation       [          ] Not started
Phase 3: Organization        [          ] Not started
Phase 4: AI Correction       [          ] Not started
Phase 5: Export              [          ] Not started
```

**Overall:** 2/? plans complete

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans completed | 2 | 01-01 Math Toolbar, 01-02 KaTeX Rendering |
| Success rate | 100% | 2/2 plans succeeded |
| Avg duration | 10 min | (8 + 12) / 2 |

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

### Technical Patterns

- **Math interchange:** Store all answers as LaTeX strings in DB
- **Async grading:** Queue jobs via BullMQ, never call OpenAI in request handlers
- **Export pattern:** Async job queue for large exports, stream to client
- **MathLive placeholders:** Use #@ for cursor position, #0 for tab navigation
- **Math rendering:** KaTeX synchronous, no CDN dependency, bundled via npm

### Known Issues

(None yet - will accumulate during execution)

### TODOs

- [x] Complete 01-01: Math Symbol Toolbar
- [x] Complete 01-02: Math Rendering with KaTeX
- [ ] Begin Phase 2: Exam Creation

### Blockers

(None currently)

---

## Session Continuity

### Resumption Prompt

```
Continuing Correcta project. Phase 1 (Math Foundation) COMPLETE.
Both plans (Math Toolbar, KaTeX Rendering) executed successfully.
Next action: Begin Phase 2 (Exam Creation) with /gsd:plan-phase 2.
```

### Context Files

- `.planning/PROJECT.md` - Core value, constraints
- `.planning/REQUIREMENTS.md` - All v1 requirements with traceability
- `.planning/ROADMAP.md` - Phase structure and success criteria
- `.planning/research/SUMMARY.md` - Technical decisions and pitfalls
- `.planning/phases/01-math-foundation/01-01-SUMMARY.md` - Math Toolbar summary
- `.planning/phases/01-math-foundation/01-02-SUMMARY.md` - KaTeX Rendering summary

---

*State initialized: 2026-01-18*
*Last execution: 2026-01-19 - Completed 01-02-PLAN.md (Phase 1 complete)*

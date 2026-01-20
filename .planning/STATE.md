# State: Correcta

**Last Updated:** 2026-01-20

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

**Phase:** 4 of 5 (AI Correction)
**Plan:** 4 of 4 complete
**Status:** Phase complete

**Progress:**
```
Phase 1: Math Foundation     [==========] 3/3 plans complete
Phase 2: Exam Creation       [==========] 4/4 plans complete
Phase 3: Organization        [==========] 3/3 plans complete
Phase 4: AI Correction       [==========] 4/4 plans complete
Phase 5: Export              [          ] Not started
```

**Overall:** 14/15 plans complete

---

## Performance Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Plans completed | 14 | 01-01 through 04-04 |
| Success rate | 100% | 14/14 plans succeeded |
| Avg duration | 10 min | Consistent execution time |

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
| Single-level subgroup hierarchy | Max 1 level (parent->children) covers typical use cases | 3 |
| Nullable parentId for subgroups | Non-breaking change, existing sections remain valid | 3 |
| Papaparse for CSV parsing | Client-side parsing allows preview before submit | 3 |
| Client-side CSV validation | Reduces server load, provides instant feedback | 3 |
| Promotion only (no demotion) | Demotion requires platform admin intervention | 3 |
| Teachers-only promotion target | Students should never be promoted to admin | 3 |
| Temperature 0.3 for rubric generation | Allows some creativity while maintaining consistency | 4 |
| Temperature 0 for grading | Deterministic grading for fairness | 4 |
| Fallback to segment rubric criteria | Backwards compatibility with existing correction guidelines | 4 |
| OpenAI SDK v6 with chat.completions.parse | Structured outputs with Zod validation | 4 |
| Collapsible context in edit modal | Reduces modal height, keeps focus on editing | 4 |
| Score color coding in grading | Quick visual feedback on grade quality | 4 |
| Clear override flags on re-grade | Ensures AI can update without human-protection | 4 |
| Publish checkbox default unchecked | Review-first is safer, prevents accidental publish | 4 |
| Confirmation modal for publish | Extra safeguard before students see grades | 4 |
| Color-coded scores and borders | Quick visual feedback on grade quality in student view | 4 |
| Default feedback messages | Better UX when AI doesn't provide explicit feedback | 4 |

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
- **CSV upload:** Papaparse for parsing, preview table with validation, bulk API
- **Role promotion:** Server action with institution-scoped authorization, optimistic UI
- **Section hierarchy:** Self-referencing parentId on Class, max 1 level deep
- **Hierarchical display:** Group children under parents with indentation and badges
- **AI grading:** OpenAI SDK with zodResponseFormat for structured outputs
- **Rubric storage:** generatedRubric JSON field on Question model
- **Content to string:** segmentsToLatexString converts segments to AI-readable format
- **Grade source detection:** gradedByUserId === null && !isOverridden for AI grades
- **Visual badges:** AI (blue), Human-modified (orange) badges in grading UI
- **Re-grade flow:** Clear override flags, enqueue with forceRegrade flag
- **Publication flow:** Confirmation modal, optional immediate publish after grading
- **Grading statistics:** Copies corrigees sur Y, modifications manuelles, score moyen
- **Grading filters:** Toutes les copies, Non corrigees, Corrigees, Modifiees
- **Student results:** AI badge, color-coded scores, default feedback messages

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
- [x] Complete 03-01: Class/Section Management
- [x] Complete 03-02: CSV Upload UI
- [x] Complete 03-03: Role Promotion
- [x] Complete 04-01: GPT-4 Integration
- [x] Complete 04-02: Grading UI
- [x] Complete 04-03: Teacher Review Interface
- [x] Complete 04-04: Publication Flow and Dashboard Polish
- [ ] Plan Phase 5: Export

### Blockers

(None currently)

---

## Session Continuity

### Resumption Prompt

```
Continuing Correcta project.
Phase 1 (Math Foundation) COMPLETE.
Phase 2 (Exam Creation) COMPLETE.
Phase 3 (Organization) COMPLETE.
Phase 4 (AI Correction) COMPLETE:
- 04-01: COMPLETE - GPT-4 Integration with structured outputs
- 04-02: COMPLETE - Grading UI with batch grading and rubric review
- 04-03: COMPLETE - Teacher Review Interface with edit modal and re-grade
- 04-04: COMPLETE - Publication Flow and Dashboard Polish

Next action: Plan Phase 5 (Export)
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
- `.planning/phases/03-organization/03-01-SUMMARY.md` - Hierarchical Subgroups summary
- `.planning/phases/03-organization/03-02-SUMMARY.md` - CSV Upload UI summary
- `.planning/phases/03-organization/03-03-SUMMARY.md` - Role Promotion summary
- `.planning/phases/04-ai-correction/04-01-SUMMARY.md` - GPT-4 Integration summary
- `.planning/phases/04-ai-correction/04-02-SUMMARY.md` - Grading UI summary
- `.planning/phases/04-ai-correction/04-03-SUMMARY.md` - Teacher Review Interface summary
- `.planning/phases/04-ai-correction/04-04-SUMMARY.md` - Publication Flow and Dashboard Polish summary

---

*State initialized: 2026-01-18*
*Last execution: 2026-01-20 - Completed 04-04-PLAN.md (Publication Flow and Dashboard Polish)*

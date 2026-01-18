# Research Synthesis: AI Exam Platform (Correcta)

**Date:** 2026-01-18
**Confidence:** HIGH (across all research domains)

---

## Executive Summary

Correcta is positioned as a full-featured AI-powered exam platform targeting educational institutions. The research validates a clear technical approach: use MathLive for WYSIWYG math editing on the frontend, KaTeX for unified rendering across all surfaces, OpenAI GPT-4 via BullMQ queue for async grading with structured prompts, and @react-pdf/renderer for exports. The core stack is already installed and modern (Next.js 16, React 19, Prisma 7, PostgreSQL 8).

The critical differentiator is the math editor—removing LaTeX barriers for non-technical instructors and students significantly accelerates adoption compared to competitors. However, success depends on three hard problems: (1) maintaining consistent math rendering across web/PDF/feedback surfaces, (2) preventing AI hallucinations in grading through strict rubric structures and confidence gating, and (3) handling OpenAI rate limits and export timeouts at scale.

Build order is straightforward: establish the math capture foundation, then exam creation UX, then AI grading via queue, then export/reporting. Each phase has clear dependencies and delivers measurable value. Anti-patterns are well-documented; the biggest architectural risk is synchronous processing (math rendering inconsistency, AI grading blocking, export timeouts). All three are preventable with proper design choices.

---

## Key Findings

### From STACK.md: Recommended Technology

**Core (Installed):**
- **Next.js 16.1.1** — Full-stack React framework with API routes and server components; ideal for exam platform
- **PostgreSQL 8.16.3 + Prisma 7.2.0** — Type-safe ORM, reliable relational schema for exam/answer/grade data
- **BullMQ 5.64.1 + Redis 5.8.2** — Enterprise-grade job queue for async AI grading; prevents API timeouts

**New Additions (High Confidence):**

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Math Input | **MathLive 0.108.2** | Complete WYSIWYG editing with 800+ LaTeX commands, accessibility, native export to LaTeX/MathML. Installed. |
| Math Output | **KaTeX 0.16.9** | 10x faster than MathJax (80KB vs 600KB), synchronous rendering, unified across web/PDF/feedback. |
| AI Grading | **OpenAI GPT-4** | 2025 research: 80%+ inter-rater agreement with human examiners; use `response_format: { type: "json_schema" }` for consistency. Cost ~$0.01-0.05 per exam. |
| PDF Export | **@react-pdf/renderer 3.0.0** | Lightweight (no Chromium), fast (< 2s for single report), works in Next.js API routes. Reserve Puppeteer for complex layouts. |
| CSV Import | **PapaParse 5.4.0** | RFC 4180-compliant, handles edge cases, multi-threading via Web Workers, fastest parser. |

**Critical Architecture Decisions:**
1. **LaTeX as interchange format** — Store all answers as LaTeX strings in DB (portable, AI-processable, version-controllable)
2. **KaTeX everywhere** — Use same renderer for editor, web display, PDF, and feedback; prevents rendering inconsistency
3. **Async grading pipeline** — Queue jobs via BullMQ; never call OpenAI directly in request handlers
4. **Server-side PDF generation** — Generate on backend, stream to client; avoid browser memory limits

**Performance Targets:**
- MathLive render: <50ms (client-side feedback)
- KaTeX render: <100ms (static output)
- GPT-4 grade: 5-15s async (user doesn't wait)
- PDF generation: <2s (single exam report)

---

### From FEATURES.md: Table Stakes vs. Differentiators

**Table Stakes (Expected, MVP-critical):**
1. Exam creation with multiple question types
2. Point assignment per question
3. Time limits and proctoring controls
4. Student exam-taking interface with auto-save
5. Basic grading and results display
6. Student result viewing and feedback

**Differentiators (Not expected, but win customers):**
1. **AI auto-correction with feedback** — Reduces grading time dramatically; context-aware feedback with partial credit (HIGH complexity)
2. **WYSIWYG math editor** — Removes LaTeX friction; signals product polish and accessibility (HIGH complexity but installed)
3. Class/subgroup management and granular analytics
4. CSV/PDF export with customizable columns
5. Plagiarism detection (deferred to Phase 3+)

**Anti-Features (Explicitly DO NOT build):**
- PDF/image upload of exams (breaks AI analysis, storage burden)
- Direct LaTeX input (high friction, parsing nightmare)
- Real-time collaborative exam editing (sync conflicts, audit trail hell)
- Unlimited question branching/logic (unmaintainable, grading nightmare)
- Peer review/grading workflows (out of scope, mod burden)

**MVP Scope Recommendation:**
- Exam creation (form-based, text + multiple choice + short answer)
- Student exam-taking with auto-save and review flow
- Basic grading (auto-score MC, manual UI for open-ended)
- **WYSIWYG math editor** (differentiator; remove friction early)
- Defer AI auto-correction until Phase 2 (requires rubric training, response analysis, confidence gating)
- Defer class management, CSV/PDF export, analytics to Phase 2+

---

### From ARCHITECTURE.md: Patterns and Component Boundaries

**Recommended Three-Tier Architecture:**

```
Frontend (React) → Backend (Node.js API + BullMQ) → Database (PostgreSQL) + External APIs (OpenAI)
```

**Key Component Responsibilities:**

| Component | Responsibility | Critical Patterns |
|-----------|---|---|
| **MathLive Editor** | Math input capture, real-time LaTeX validation, export to string | Store raw LaTeX in DB, no image rendering |
| **Answer Capture Service** | Receives LaTeX, stores with student/question foreign keys | Submit immediately; never block on grading |
| **Exam Service** | CRUD for exams, question management, metadata | Version control exams, enable admin lock during submissions |
| **AI Correction Job (BullMQ)** | Dequeues job, calls GPT-4 with rubric + answer, stores grade | Enforce rubric-based prompts, add confidence field, gate low-confidence grades |
| **Job Queue** | Manage async jobs, retry with exponential backoff, track status | Retry 3-6 attempts; log all failures for debugging |
| **Export Service** | PDF/CSV generation on backend, stream to client | Async job queue for large exams; never sync on > 150 submissions |
| **Grade Store** | Persist grades, feedback, reasoning, job metadata, timestamps | Audit trail required; log all mutations |

**Data Flow Overview:**
1. Student submits math answer via MathLive → LaTeX captured and sent to `/api/answers`
2. Backend stores LaTeX string in `answers` table
3. Teacher clicks "Grade All" → creates BullMQ jobs for each answer
4. Worker picks up job → calls GPT-4 with structured prompt → stores grade/feedback/confidence
5. Frontend polls `/api/grades/:examId` or uses WebSocket for real-time updates
6. Teacher requests PDF export → backend queues async job → returns when ready

**Critical Pattern: Async Grading with BullMQ**
```typescript
// Enqueue
await correctionQueue.add("grade_exam", { examId }, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 }
});

// Worker
correctionQueue.process(async (job) => {
  const answers = await getAnswers(job.data.examId);
  for (const answer of answers) {
    const { score, feedback, confidence } = await gradeWithGPT4(answer.latex);
    if (confidence < 85) return answer to manual queue; // Flag for review
    await updateAnswer(answer.id, { score, feedback, confidence });
  }
});
```

**Build Order (with dependencies):**
1. **Phase 1: Math Foundation** — MathLive integration, LaTeX capture, DB storage
2. **Phase 2: Exam Creation & Taking** — Question CRUD, student interface, auto-save
3. **Phase 3: AI Grading Pipeline** — BullMQ setup, GPT-4 integration, confidence gating, teacher review UI
4. **Phase 4: Export & Analytics** — PDF/CSV async export, basic dashboard

---

### From PITFALLS.md: Critical Risks and Prevention

**Critical Pitfalls (Cause system failure or major rewrites):**

1. **Math Rendering Inconsistency Across Surfaces**
   - **Risk:** Equations render correctly in editor but display differently in PDF/feedback/student view. Leads to grading disputes and unfairness complaints.
   - **Prevention:** Use KaTeX as single renderer everywhere (editor, web, PDF, feedback). Test end-to-end before MVP launch.
   - **Detection:** QA test reveals > 2% variance between surfaces; students report "equation looks different on my screen."

2. **AI Hallucinations in Grading**
   - **Risk:** GPT-4 awards points for wrong reasoning, cites non-existent principles, makes contradictory decisions. Students appeal successfully.
   - **Prevention:**
     - Use strict rubric-based prompts: "Award 2 pts if answer contains [phrase]" not "Is this correct?"
     - Add confidence field; flag low-confidence grades (< 80%) for human review
     - Enforce teacher approval before final grade application (not auto-apply)
     - Research shows even GPT-4 only 70% accurate within 10% of human grading
   - **Detection:** Appeals spike; students cite AI reasoning that contradicts rubric; QA finds AI awards points for incorrect solutions.

3. **Export Timeout on Large Exams**
   - **Risk:** Synchronous PDF generation for 200+ questions or 500+ submissions times out (504 error). Teachers lose work.
   - **Prevention:**
     - Design async from day one: POST → returns job ID; GET → returns status + download link
     - Use BullMQ worker for background processing
     - Add progress indicator ("Processing 45 of 200...")
     - Never sync on > 150 submissions
   - **Detection:** Export failures on large exams; user feedback "Export took too long"; server logs show 504 errors.

4. **OpenAI Rate Limiting Blocking Mass Grading**
   - **Risk:** 429 Too Many Requests on submission 102+ of 500-student exam. Grading job fails partway; incomplete results.
   - **Prevention:**
     - Queue-based grading with 6-attempt retry; exponential backoff (1s → 2s → 4s → 8s)
     - Monitor rate limit headers before calling API; pause queue if remaining < 10
     - Use OpenAI Batch API for non-urgent grading (overnight jobs; 50% cheaper; no rate limits)
     - Token optimization: truncate long answers, compact prompts, use gpt-3.5-turbo for simple grades
   - **Detection:** Grading fails on submission 80+; "429" errors in logs; user reports "Worked for first 50 students, then stopped."

5. **Complex Exam Builder UX Causing User Abandonment**
   - **Risk:** 15 input fields per question, nested modals, hidden settings. Teachers abandon builder, switch to Google Forms or paper.
   - **Prevention:**
     - Simple defaults: question type auto-selected, points default to 1, rubric optional
     - Progressive disclosure: show 3 essential fields first, "More options" expands
     - Two modes: "Quick Question" (2 fields) vs. "Detailed Rubric" (15 fields)
     - Test adoption: simple builder > 60% completion vs. complex builder 30%
   - **Detection:** > 30% of started exams never completed; average builder session < 5 minutes; support tickets "How do I add a question?"

**Moderate Pitfalls (Cause delays and technical debt):**
- Weak rubric specification → inconsistent grading (prevent with objective criteria and sample answers)
- No audit trail → unfair grade changes undetectable (log all mutations with user, timestamp, reason)
- PDF export question order doesn't match original (store explicit sequence field, sort by order not ID)
- Offline PDF access broken (embed all assets, pre-render math to SVG, base64 encode images)

**Phase-Specific Warnings:**

| Phase | Pitfall | Mitigation |
|-------|---------|-----------|
| MVP Exam Builder | Complex UX | 3-field simple mode; defer advanced options |
| MVP Math Rendering | Choose wrong renderer | Test KaTeX end-to-end before launch |
| Phase 2 AI Grading | Accept hallucinations | Require teacher review, confidence threshold, rubric-based prompts |
| Phase 3 Export | Synchronous processing | Design async from start; use queue not direct handlers |
| Scale to 1000+ | Rate limit wall | Implement queue + retry day one, not as afterthought |

---

## Implications for Roadmap

### Suggested Phase Structure

**Phase 1: Math Foundation (Weeks 1-2)**
- Integrate MathLive for student math input
- Capture LaTeX strings and store in DB
- Implement KaTeX renderer for display
- *Delivers:* Students can type math; teachers see raw LaTeX
- *Pitfalls to avoid:* Choose KaTeX now; no renderer switching later
- *Research needed:* None (STACK and ARCHITECTURE fully documented)

**Phase 2: Exam Authoring & Taking (Weeks 3-4)**
- Question CRUD UI (text, multiple choice, short answer)
- Student exam-taking interface with auto-save
- Review/confirm before submit
- Basic auto-scoring for MC; manual scoring UI for open-ended
- *Delivers:* End-to-end exam workflow (create → take → view results)
- *Features:* Table stakes (exam creation, time limits, student results)
- *Pitfalls to avoid:* Keep exam builder simple (3 fields max); progressive disclosure for advanced options
- *Research needed:* None (FEATURES fully documented)

**Phase 3: AI Grading Pipeline (Weeks 5-7)**
- BullMQ + Redis setup
- OpenAI GPT-4 integration with structured prompts (JSON schema)
- Confidence scoring and low-confidence gating (< 80% requires human review)
- Teacher "Grade All" button and status tracking
- Teacher manual review/override UI
- Grade audit trail logging
- *Delivers:* Automated grading with human safety net; differentiator
- *Features:* AI auto-correction (HIGH value differentiator)
- *Pitfalls to avoid:* (1) Use strict rubric-based prompts, not open-ended judgment; (2) Enforce teacher review; (3) Implement rate limit retry logic with exponential backoff; (4) Test on 100+ submissions before ship
- *Research needed:* Rubric template library, confidence threshold validation (likely needs user research or A/B testing)

**Phase 4: Export & Reporting (Weeks 8-9)**
- Async PDF export job queue (BullMQ worker)
- CSV export via server-side streaming
- Basic grade analytics dashboard (time-per-question, score distribution)
- Download UI with progress indicator
- *Delivers:* Integration with institutional workflows
- *Features:* CSV/PDF export (differentiator)
- *Pitfalls to avoid:* (1) Design async from start; never sync on > 150 submissions; (2) Show progress indicator to prevent user timeout anxiety; (3) Test end-to-end PDF rendering with KaTeX (no renderer switching)
- *Research needed:* None (ARCHITECTURE documents async patterns)

**Phase 5+ (Post-MVP):**
- Class and subgroup management
- Plagiarism detection
- Advanced analytics (learning outcome correlation, item difficulty)
- Exam templates and question banks
- LMS integration (Canvas, Moodle, Blackboard API)

---

## Confidence Assessment

| Domain | Confidence | Evidence | Gaps |
|--------|------------|----------|------|
| **Stack** | HIGH | All technologies installed and current; 2025 research validates GPT-4 grading (80%+ inter-rater agreement); versions pinned; alternatives evaluated | None critical |
| **Features** | HIGH | Aligned with exam platform standards (Canvas, Moodle); anti-features well-defined; MVP scope clear; MVP recommendation prioritizes WYSIWYG editor (differentiator) | A/B test on UI complexity needed during Phase 2 |
| **Architecture** | HIGH | Three-tier pattern proven; component boundaries clear; data flow detailed; build order has explicit dependencies; async patterns for grading and export are industry standard | Rubric template library needs design work; confidence threshold needs user validation |
| **Pitfalls** | HIGH | 5 critical pitfalls identified with peer-reviewed research citations; prevention strategies actionable; phase-specific warnings provided; detection methods clear | Minor pitfalls 10-12 are low-priority; skippable for MVP |

**Critical Gaps Requiring Attention:**
1. **Rubric Template Library** (Phase 3) — Design library of rubrics for common question types (math, essay, short answer) before AI grading ship. Prevents vague criteria hallucination.
2. **Confidence Threshold Validation** (Phase 3) — During beta, validate that 80% confidence threshold actually reduces appeals. Adjust based on real data.
3. **UI Complexity Testing** (Phase 2) — A/B test simple vs. complex exam builder to confirm > 60% completion rate before scaling to production.
4. **PDF Rendering Regression Testing** (Phase 4) — Create automated test suite (snapshots) for PDF output across math complexity levels and question types.

---

## Build Order Dependencies

```
Phase 1: Math Foundation
   ├─ No dependencies
   └─ Blocks: Phase 2, 3, 4

Phase 2: Exam Authoring & Taking
   ├─ Requires: Phase 1 (MathLive, KaTeX working)
   └─ Blocks: Phase 3, 4

Phase 3: AI Grading Pipeline
   ├─ Requires: Phase 1 (LaTeX strings), Phase 2 (exams exist)
   └─ Blocks: Phase 4 (grade data for export)

Phase 4: Export & Reporting
   ├─ Requires: Phase 1 (KaTeX), Phase 2 (exam data), Phase 3 (grades)
   └─ No downstream blocks

Phase 5+: Class Management, Plagiarism, Analytics
   ├─ Requires: Phase 4 (data available)
   └─ Independent of each other
```

---

## Research Flags

**Needs Design/Validation During Planning:**
- **Phase 2:** Exam builder UI/UX (simple vs. complex field count; A/B test completion rates)
- **Phase 3:** Rubric template library design (common question types; sample answers per level)
- **Phase 3:** Confidence threshold tuning (validate 80% threshold reduces appeals in beta)
- **Phase 4:** PDF snapshot testing infrastructure (regression detection for math rendering)

**Standard Patterns (Well-Documented, Low Risk):**
- **Phase 1:** MathLive integration (full documentation in STACK, ARCHITECTURE)
- **Phase 1:** KaTeX rendering (unified configuration, no switching)
- **Phase 2:** Exam CRUD and question types (standard data model in ARCHITECTURE)
- **Phase 3:** BullMQ job queue with retry (explicit code examples in ARCHITECTURE and PITFALLS)
- **Phase 4:** Async export (async pattern proven, no novel architecture)

---

## Sources

### STACK.md
- KaTeX GitHub: https://github.com/KaTeX/KaTeX
- MathLive GitHub: https://github.com/arnog/mathlive
- OpenAI API: https://platform.openai.com/docs/guides/graders
- GPT-4 Exam Grading Research (2025): https://www.nature.com/articles/s41598-025-21572-8
- Papa Parse: https://www.papaparse.com/
- React-PDF vs Puppeteer: https://npm-compare.com/

### FEATURES.md
- Standard exam platform features (Canvas, Moodle, Google Forms)
- STEM education research on math notation barriers
- Assessment best practices (question banks, rubrics, attempt analytics)

### ARCHITECTURE.md
- MathLive documentation
- BullMQ documentation: https://docs.bullmq.io/
- OpenAI API reference: https://platform.openai.com/docs
- PostgreSQL performance tuning
- Next.js server-side data handling

### PITFALLS.md
- MIT Sloan: AI-Assisted Grading Review (2024)
- British Educational Research Journal: ChatGPT Grading Comparison
- OpenAI Cookbook: Hallucinations in educational context
- Springer: LLM-Powered Automated Assessment Survey
- OpenAI Rate Limits Documentation
- Pressbooks: LaTeX Rendering Consistency
- OSU Distance Education: AI in Auto-Grading

---

## Commit Checklist

- [x] STACK.md reviewed (technology decisions locked)
- [x] FEATURES.md reviewed (MVP and post-MVP scope defined)
- [x] ARCHITECTURE.md reviewed (build order and component design locked)
- [x] PITFALLS.md reviewed (prevention strategies documented)
- [x] SUMMARY.md written (synthesis complete)
- [ ] All research files committed to git

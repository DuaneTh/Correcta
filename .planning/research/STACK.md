# Technology Stack: AI Exam Platform

**Project:** Correcta (AI-powered exam grading platform)
**Date:** January 18, 2026
**Confidence:** HIGH

## Core Stack (Existing)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Next.js | 16.1.1 | React framework, API routes, server components | ✓ Installed |
| React | 19.2.0 | UI library | ✓ Installed |
| TypeScript | 5 | Type safety | ✓ Installed |
| Prisma | 7.2.0 | ORM, database abstraction | ✓ Installed |
| PostgreSQL | 8.16.3 | Relational database | ✓ Installed |
| BullMQ | 5.64.1 | Job queue (AI grading jobs) | ✓ Installed |
| Redis (ioredis) | 5.8.2 | Queue backend, caching | ✓ Installed |

## Recommended Additions

### Math Editor & Rendering

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **MathLive** | 0.108.2 | Math input/editing UI | ✓ Installed - Complete editing solution with 800+ LaTeX commands, mobile keyboards, native accessibility, export to LaTeX/MathML/ASCIIMath. Higher UX than KaTeX alone. |
| **KaTeX** | ^0.16.9 | Math rendering (LaTeX) | Lightweight (80KB), fast synchronous rendering. Use as output/display layer for graded responses and exam answers. |

**Architecture:** MathLive for input capture (students write math), KaTeX for output rendering (displaying graded answers, statistics).

**Why not MathJax?** Slower (~600KB), asynchronous rendering causes reflows. KaTeX is 10x faster for identical expressions.

### AI Grading

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **OpenAI SDK** | ^4.0.0 | GPT-4 API access | Standard choice for exam grading. 2025 research shows GPT-4 matches human examiners on ranking quality responses (80%+ inter-rater agreement). Use structured outputs for consistent JSON schema. |
| **json-schema-validator** | Optional | Validate GPT-4 structured responses | Ensure grading output matches schema before saving to DB. |

**Pattern:**
- One-shot prompting: Provide rubric + correct answer + student response → GPT-4 returns `{score, feedback, reasoning}`
- Use `response_format: { type: "json_schema" }` in API calls for structured grading
- Cache rubrics and correct answers in Redis with TTL for throughput

**Estimated cost:** ~$0.01-0.05 per exam graded (depends on response length)

### PDF Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@react-pdf/renderer** | ^3.0.0 | React → PDF (client/server) | Lightweight (no Chromium). Fast for small-medium documents. Works in Next.js API routes. Better than Puppeteer for report cards, score sheets. |
| **Puppeteer** | ^22.0.0 | HTML → PDF (complex layouts) | Reserve for complex multi-page exam PDFs with full styling. Higher resource cost but pixel-perfect rendering. Run as separate worker process via BullMQ if needed. |

**Recommendation:** Start with @react-pdf/renderer. Upgrade to Puppeteer if complex report layouts needed (signatures, charts, watermarks).

**DO NOT USE:** html-pdf (unmaintained), wkhtmltopdf (system dependency).

### CSV Import/Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PapaParse** | ^5.4.0 | CSV parsing (import student data) | Fastest RFC 4180-compliant parser. Handles edge cases (quoted fields, mismatches). Multi-threading via Web Workers for large files (1M+ rows). |
| **Built-in** | N/A | Simple CSV export | Use native JSON.stringify + CSV headers for exam result exports (simple format, no dependencies). |

**Pattern:**
- Import: PapaParse client-side with progress callback → validate → POST to API
- Export: Generate CSV on server (Prisma query → CSV string) → stream response as `text/csv`

## Installation Commands

```bash
# Add to existing project
npm install katex papaparse openai
npm install -D @types/papaparse

# Optional: Puppeteer (only if complex PDF layouts needed)
npm install puppeteer

# Validate GPT-4 responses (optional)
npm install json-schema-validator
```

## Architecture Decisions

### AI Grading via BullMQ

1. Student submits exam → API creates BullMQ job
2. Worker picks up job → calls GPT-4 API with rubric
3. Store `{score, feedback, usage}` in Prisma
4. Frontend polls for result or uses WebSocket

**Why queue?** Decouples API timeout from GPT-4 latency (3-15s). Allows retry on failure. Scales with multiple workers.

### Math Rendering Pipeline

```
Input:  Student types via MathLive mathfield → exports LaTeX string
Store:  Save LaTeX string to DB (compact, canonical format)
Output: Render via KaTeX in exam PDF/display (instant, no network calls)
```

**Why this pattern?** Decouples input UX (MathLive) from output rendering (KaTeX). LaTeX as interchange format is portable across platforms.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Math input | MathLive | MathQuill | MathQuill less maintained (last update 2023), no MathML export |
| Math rendering | KaTeX | MathJax | MathJax 10x slower, larger bundle (~600KB vs 80KB) |
| AI API | OpenAI GPT-4 | Anthropic Claude | Both viable; OpenAI has more grading research, more affordable for education |
| PDF (simple) | @react-pdf/renderer | html2canvas + jsPDF | html2canvas produces images (large file size), poor text searchability |
| CSV | PapaParse | csv-parser | csv-parser Node.js only; PapaParse works browser + Node, streaming support |

## Version Pinning Strategy

- **Core (Next.js, React, Prisma):** Lock major versions (`^16.0.0`) — stable, infrequent breaking changes
- **Math (KaTeX, MathLive):** Patch-level (`^0.108.2`, `^0.16.9`) — breaking changes rare but possible
- **AI (OpenAI SDK):** Minor-level (`^4.0.0`) — API stable, SDK improves compatibility
- **Utilities (PapaParse):** Loose (`^5.0.0`) — mature, minimal breaking changes

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| MathLive render | <50ms | Client-side, instant feedback |
| KaTeX render | <100ms | Static output rendering |
| GPT-4 grade | 5-15s | Async via queue, user doesn't wait |
| PDF generation | <2s | For single exam report |
| CSV import (1K rows) | <500ms | Client-side parsing |

## Security Considerations

1. **OpenAI API key:** Store in `.env.local`, never commit. Use `process.env.OPENAI_API_KEY` in API routes only.
2. **PDF generation:** Run Puppeteer in isolated worker (if used). Validate user input before rendering.
3. **CSV upload:** Validate file size (<10MB), mime type. Scan for injection patterns.
4. **MathLive:** Sanitize LaTeX output for XSS (though KaTeX sanitizes by default).

## Testing Strategy

- **MathLive:** Unit tests for LaTeX export/import (e.g., "x^2" → KaTeX render matches snapshot)
- **AI Grading:** Mock OpenAI responses, test rubric application logic
- **PDF:** Snapshot test generated PDFs for layout regression
- **CSV:** Test malformed inputs (missing columns, quotes, newlines)

## Roadmap Milestones

1. **Phase 1 (MVP):** MathLive + KaTeX for student input/display
2. **Phase 2:** OpenAI GPT-4 grading via BullMQ queue
3. **Phase 3:** @react-pdf/renderer for exam reports
4. **Phase 4 (Post-MVP):** PapaParse bulk import; Puppeteer for complex layouts

## Justification Summary

- **MathLive (already installed):** Best-in-class math editing with accessibility and multiple export formats
- **KaTeX:** Proven rendering performance for exam displays and PDFs
- **OpenAI GPT-4:** 2025 research validates reliability for academic grading; structured outputs ensure consistency
- **@react-pdf/renderer:** Fast, lightweight, no system dependencies; Puppeteer reserved for advanced layouts
- **PapaParse:** Industry standard for robust CSV handling with edge cases

## Sources

- [KaTeX GitHub](https://github.com/KaTeX/KaTeX)
- [MathLive GitHub](https://github.com/arnog/mathlive)
- [OpenAI Graders API](https://platform.openai.com/docs/guides/graders)
- [GPT-4 Exam Grading Research (2025)](https://www.nature.com/articles/s41598-025-21572-8)
- [Papa Parse Documentation](https://www.papaparse.com/)
- [React-PDF vs Puppeteer Comparison](https://npm-compare.com/html-pdf,pdfkit,pdfmake,puppeteer,react-pdf,wkhtmltopdf)

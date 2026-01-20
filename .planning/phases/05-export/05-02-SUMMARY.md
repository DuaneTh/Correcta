---
phase: 05-export
plan: 02
subsystem: export
tags: [pdf, mathjax, react-pdf, svg, math-rendering]

requires:
  - 01-math-foundation  # Math rendering patterns

provides:
  - PDF generation infrastructure with math support
  - MathJax SVG conversion for server-side rendering
  - SVG to react-pdf transformation pipeline

affects:
  - 05-03  # PDF export API endpoint

tech-stack:
  added:
    - "@react-pdf/renderer@^4.3.2"
    - "mathjax-full@^3.2.2"
    - "svg-parser@^2.0.4"
  patterns:
    - Server-side PDF generation with renderToBuffer
    - MathJax for LaTeX to SVG (not KaTeX HTML)
    - AST-based SVG to react-pdf transformation

key-files:
  created:
    - lib/export/math-to-svg.ts
    - lib/export/pdf-generator.tsx
  modified:
    - package.json
    - next.config.ts

decisions:
  - decision: "Use mathjax-full v3 (not v4)"
    rationale: "v4 is only in beta, v3 is stable and well-tested"
  - decision: "Use svg-parser for SVG to react-pdf transformation"
    rationale: "Parses SVG string to AST, enables element-by-element conversion"
  - decision: "Skip <use> elements in SVG transformation"
    rationale: "react-pdf doesn't support <use>, but MathJax SVG works without it"

metrics:
  duration: 11m
  completed: 2026-01-20
---

# Phase 05 Plan 02: PDF Infrastructure with Math Rendering Summary

**One-liner:** MathJax SVG conversion with svg-parser transformation to react-pdf Svg primitives for actual math rendering in PDFs.

## What Was Built

### 1. MathJax SVG Converter (`lib/export/math-to-svg.ts`)

- `latexToSvg(latex, display)` - Converts LaTeX to SVG string using MathJax
- `parseMathContent(content)` - Parses $...$ delimited content to text/math parts
- `extractSvgDimensions(svgString)` - Extracts width/height from MathJax SVG (ex units to px)
- `svgToReactPdf(svgString)` - Transforms SVG string to react-pdf Svg element
- `latexToReactPdf(latex, display)` - Convenience function combining both

Key implementation details:
- MathJax initialized as module-level singleton with `fontCache: 'none'` for standalone SVG
- Uses `AllPackages` for broad LaTeX support
- svg-parser converts SVG string to AST
- Recursive transformation maps SVG tags to react-pdf components (G, Path, Rect, etc.)
- Attributes converted from kebab-case to camelCase for React compatibility

### 2. PDF Document Component (`lib/export/pdf-generator.tsx`)

- `ExportDocument` - Multi-student PDF with all attempts
- `StudentReportDocument` - Single student report
- `MathSvg` - Renders actual SVG math (not placeholder text)
- `MathContent` - Parses content and renders text/math parts

Features:
- French labels (Reponse, Commentaire, etc.)
- Color-coded scores (green >70%, orange 40-70%, red <40%)
- Student info header with name, email, total score
- Per-question breakdown with answer and feedback
- `wrap={false}` keeps questions together on pages

### 3. Next.js Configuration

Added `serverExternalPackages: ['@react-pdf/renderer', 'mathjax-full']` to prevent bundling issues in API routes.

## Key Technical Decisions

| Decision | Why |
|----------|-----|
| MathJax not KaTeX for PDF | KaTeX outputs HTML+CSS which @react-pdf/renderer cannot render |
| svg-parser for transformation | Provides AST that can be recursively transformed to react-pdf elements |
| 1ex = 8px approximation | Standard typographic conversion for MathJax's ex-based dimensions |
| Skip `<use>` elements | react-pdf doesn't support SVG defs references, but math renders without them |

## Verification Results

All success criteria met:
- @react-pdf/renderer, mathjax-full, and svg-parser installed
- latexToSvg produces SVG with path elements
- svgToReactPdf transforms SVG to react-pdf Svg elements (not placeholders)
- ExportDocument generates valid PDF (verified %PDF- header)
- Math expressions like $\frac{1}{2}$ appear as actual formatted fractions

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added @react-pdf/renderer, mathjax-full, svg-parser, @types/svg-parser |
| `next.config.ts` | Added serverExternalPackages array |
| `lib/export/math-to-svg.ts` | Created - MathJax conversion + svg-parser transformation |
| `lib/export/pdf-generator.tsx` | Created - React-PDF document components |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] mathjax-full version**
- **Found during:** Task 1
- **Issue:** Plan specified mathjax-full@^4.0.0, but v4 only exists as beta releases
- **Fix:** Used stable v3.2.2 instead
- **Files modified:** package.json

**2. [Rule 1 - Bug] Duplicate variable name**
- **Found during:** Task 2
- **Issue:** Linter introduced duplicate `children` variable causing compile error
- **Fix:** Renamed inner variable to `svgChildren`
- **Files modified:** lib/export/math-to-svg.ts

## Next Phase Readiness

Plan 05-02 provides the infrastructure for 05-03 (PDF Export API). The following are ready:
- `ExportDocument` component for multi-student exports
- `StudentReportDocument` for single-student downloads
- `renderToBuffer` pattern verified working

Dependencies for 05-03:
- API endpoint to accept export request
- Data fetching for attempts with grades
- Class/subgroup filtering (uses existing enrollment hierarchy)

## Commits

| Hash | Message |
|------|---------|
| 43c7862 | chore(05-02): install PDF generation dependencies |
| ead084b | feat(05-02): add MathJax SVG converter with react-pdf transformation |
| 1f3ec23 | feat(05-02): add PDF document component with working math rendering |

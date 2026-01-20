# Phase 5: Export - Research

**Researched:** 2026-01-20
**Domain:** PDF/CSV generation, async job processing, math rendering in PDFs
**Confidence:** MEDIUM (verified stack, but PDF math rendering has complexity)

## Summary

Phase 5 implements export functionality for teachers to download grades and reports. The two core exports are:
1. **CSV Export** - Grades table with student, question, score, and total columns
2. **PDF Report** - Detailed report with student answers, grades, feedback, and math rendering

Key challenges:
- Math rendering in PDFs requires special handling (KaTeX outputs HTML, but @react-pdf/renderer does not support HTML)
- Large exports (200+ submissions) need async processing with progress tracking
- Class/subgroup filtering requires joining through Enrollment -> Class hierarchy

**Primary recommendation:** Use @react-pdf/renderer with MathJax for server-side SVG generation (not KaTeX HTML), Papa Parse unparse for CSV, and extend existing BullMQ infrastructure for async export jobs with SSE progress streaming.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | ^4.3.2 | Server-side PDF generation | Lightweight, no Chromium, React syntax |
| papaparse | ^5.5.3 | CSV generation (unparse) | Already installed, robust, no dependencies |
| bullmq | (existing) | Async job processing | Already integrated, progress tracking built-in |
| mathjax-full | ^4.0.0 | LaTeX to SVG conversion | Server-side support, produces self-contained SVG |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-pdf-html | ^2.1.0 | HTML to react-pdf components | Rich text feedback rendering (optional) |
| ioredis | (existing) | Redis connection for BullMQ | Already integrated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | puppeteer/playwright | Chromium dependency, heavier, but full HTML support |
| MathJax for PDF | KaTeX renderToString | KaTeX outputs HTML, no SVG; requires browser-like environment |
| SSE for progress | WebSocket | SSE simpler for one-way updates, no ws server needed |

**Installation:**
```bash
npm install @react-pdf/renderer mathjax-full
# Optional: npm install react-pdf-html
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
  export/
    csv-generator.ts      # CSV generation with Papa.unparse
    pdf-generator.ts      # PDF document component
    math-to-svg.ts        # MathJax server-side LaTeX->SVG
    export-worker.ts      # BullMQ worker for export jobs
scripts/
  export-worker.ts        # Export worker entry point (like ai-grading-worker.ts)
app/
  api/
    exams/[examId]/
      export/
        csv/route.ts      # CSV export endpoint
        pdf/route.ts      # PDF export endpoint
        status/route.ts   # SSE progress endpoint
```

### Pattern 1: Server-Side PDF Generation with renderToBuffer

**What:** Generate PDF on server, return as downloadable file
**When to use:** Small exports (<50 submissions) - synchronous response
**Example:**
```typescript
// Source: https://react-pdf.org/advanced
import { renderToBuffer } from '@react-pdf/renderer'
import { ExportDocument } from '@/lib/export/pdf-generator'

export async function GET(req: NextRequest) {
  const pdfBuffer = await renderToBuffer(<ExportDocument data={exportData} />)

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="grades-${examId}.pdf"`
    }
  })
}
```

### Pattern 2: Async Export with BullMQ + SSE Progress

**What:** Queue export job, stream progress via SSE, provide download link when complete
**When to use:** Large exports (50+ submissions) - prevent timeout
**Example:**
```typescript
// Enqueue job
export async function POST(req: NextRequest) {
  const job = await exportQueue.add('pdf-export', {
    examId,
    classIds: filterClassIds,
    type: 'pdf'
  })
  return NextResponse.json({ jobId: job.id })
}

// Worker updates progress
await job.updateProgress({ current: 50, total: 200, phase: 'Generating PDFs' })

// SSE endpoint streams progress
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      queueEvents.on('progress', ({ jobId, data }) => {
        if (jobId === targetJobId) {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`)
        }
      })
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}
```

### Pattern 3: Math Rendering for PDF (MathJax SVG)

**What:** Convert LaTeX to SVG string on server, embed as react-pdf Svg component
**When to use:** Any math content in PDF exports
**Example:**
```typescript
// Source: https://docs.mathjax.org/en/latest/server/components.html
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { SVG } from 'mathjax-full/js/output/svg.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const tex = new TeX({ packages: ['base', 'ams'] })
const svg = new SVG({ fontCache: 'none' })
const html = mathjax.document('', { InputJax: tex, OutputJax: svg })

export function latexToSvg(latex: string): string {
  const node = html.convert(latex, { display: false })
  return adaptor.innerHTML(node)
}
```

### Pattern 4: CSV Generation with Papaparse

**What:** Generate CSV from structured data
**When to use:** Grade exports
**Example:**
```typescript
// Source: https://www.papaparse.com/docs
import Papa from 'papaparse'

const rows = attempts.map(attempt => ({
  'Etudiant': attempt.student.name,
  'Email': attempt.student.email,
  ...questionScores, // Q1, Q2, etc.
  'Total': totalScore,
  'Maximum': maxPoints
}))

const csv = Papa.unparse(rows, {
  header: true,
  delimiter: ';' // French locale uses semicolon
})
```

### Anti-Patterns to Avoid
- **Rendering KaTeX HTML in @react-pdf/renderer:** KaTeX produces HTML+CSS which @react-pdf/renderer cannot render. Use MathJax SVG output instead.
- **Synchronous large exports:** Never process 200+ submissions in a single request - use job queue.
- **Storing PDF in Redis:** Store generated files in file system or object storage (MinIO already set up), only store path in job result.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV escaping | Manual string concatenation | Papa.unparse | Handles quotes, newlines, special chars |
| PDF layout | Manual coordinate math | @react-pdf/renderer StyleSheet | Flexbox layout, familiar API |
| LaTeX to image | Canvas rendering pipeline | MathJax SVG output | Self-contained, scalable |
| Progress streaming | Polling endpoint | SSE with BullMQ events | Real-time, efficient, built-in |
| Large file handling | Memory buffering | Streaming with renderToStream | Memory efficient for large PDFs |

**Key insight:** The temptation is to use KaTeX (already integrated) for PDF math, but KaTeX outputs HTML which requires a browser environment. MathJax can produce self-contained SVG strings directly suitable for @react-pdf/renderer.

## Common Pitfalls

### Pitfall 1: KaTeX HTML in PDF
**What goes wrong:** Trying to use existing `renderLatexToString` function for PDF export
**Why it happens:** KaTeX renders to HTML+CSS, not SVG. @react-pdf/renderer cannot render arbitrary HTML.
**How to avoid:** Use MathJax for PDF math rendering (produces SVG), keep KaTeX for web display
**Warning signs:** "dangerouslySetInnerHTML is not supported" or blank math in PDFs

### Pitfall 2: Next.js 15 App Router + renderToBuffer
**What goes wrong:** `renderToBuffer` may fail in App Router API routes with "React error #31"
**Why it happens:** React server component bundling conflicts
**How to avoid:**
1. Add to next.config.js: `serverComponentsExternalPackages: ['@react-pdf/renderer']`
2. Use dynamic imports in route handlers
3. Consider running PDF generation in separate worker process
**Warning signs:** Errors during build or runtime about React/Component constructors

### Pitfall 3: Export Timeout for Large Datasets
**What goes wrong:** API route times out processing 200+ submissions
**Why it happens:** Vercel/serverless has 10-30 second limits, PDF generation is slow
**How to avoid:** Always use async job queue for exports, return job ID immediately
**Warning signs:** 504 Gateway Timeout, incomplete downloads

### Pitfall 4: Memory Exhaustion with Large PDFs
**What goes wrong:** Server crashes generating large multi-page PDFs
**Why it happens:** Buffering entire PDF in memory before sending
**How to avoid:** Use `renderToStream` instead of `renderToBuffer` for large documents
**Warning signs:** Process killed, heap out of memory errors

### Pitfall 5: Missing Class Filter Logic
**What goes wrong:** Export includes all students instead of filtered subgroup
**Why it happens:** Not following Enrollment -> Class hierarchy properly
**How to avoid:** Filter by classId through Enrollment table, handle subgroups (children with parentId)
**Warning signs:** Export contains more students than expected

## Code Examples

Verified patterns from official sources and existing codebase:

### CSV Export Endpoint
```typescript
// app/api/exams/[examId]/export/csv/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params
  const classId = req.nextUrl.searchParams.get('classId')

  // Build where clause with optional class filter
  const whereClause: any = { examId, status: 'GRADED' }
  if (classId) {
    // Get all class IDs including subgroups
    const classIds = await getClassIdsWithChildren(classId)
    whereClause.student = {
      enrollments: {
        some: { classId: { in: classIds } }
      }
    }
  }

  const attempts = await prisma.attempt.findMany({
    where: whereClause,
    include: {
      student: { select: { name: true, email: true } },
      answers: {
        include: {
          grades: true,
          question: { select: { id: true } }
        }
      }
    }
  })

  // Transform to CSV rows
  const rows = attempts.map(attempt => {
    const row: Record<string, string | number> = {
      'Etudiant': attempt.student.name || '',
      'Email': attempt.student.email || ''
    }

    let total = 0
    attempt.answers.forEach((answer, idx) => {
      const score = answer.grades[0]?.score ?? ''
      row[`Q${idx + 1}`] = score
      if (typeof score === 'number') total += score
    })

    row['Total'] = total
    return row
  })

  const csv = Papa.unparse(rows, { header: true, delimiter: ';' })

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="notes-${examId}.csv"`
    }
  })
}

async function getClassIdsWithChildren(classId: string): Promise<string[]> {
  const classes = await prisma.class.findMany({
    where: {
      OR: [
        { id: classId },
        { parentId: classId }
      ]
    },
    select: { id: true }
  })
  return classes.map(c => c.id)
}
```

### PDF Document Component
```typescript
// lib/export/pdf-generator.tsx
import { Document, Page, Text, View, StyleSheet, Svg, Path } from '@react-pdf/renderer'
import { latexToSvg } from './math-to-svg'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  header: { fontSize: 18, marginBottom: 20, fontWeight: 'bold' },
  section: { marginBottom: 15 },
  question: { marginBottom: 10 },
  label: { fontSize: 10, color: '#666', marginBottom: 4 },
  answer: { backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4 },
  score: { color: '#4f46e5', fontWeight: 'bold' },
  feedback: { fontStyle: 'italic', color: '#374151' }
})

interface ExportDocumentProps {
  exam: { title: string }
  attempts: AttemptExportData[]
}

export function ExportDocument({ exam, attempts }: ExportDocumentProps) {
  return (
    <Document>
      {attempts.map(attempt => (
        <Page key={attempt.id} size="A4" style={styles.page}>
          <Text style={styles.header}>{exam.title}</Text>
          <View style={styles.section}>
            <Text>Etudiant: {attempt.student.name}</Text>
            <Text>Score total: {attempt.totalScore} / {attempt.maxPoints}</Text>
          </View>

          {attempt.questions.map((q, idx) => (
            <View key={q.id} style={styles.question}>
              <Text style={styles.label}>Question {idx + 1} ({q.maxPoints} pts)</Text>
              <MathContent content={q.content} />

              <View style={styles.answer}>
                <Text style={styles.label}>Reponse</Text>
                <MathContent content={q.studentAnswer} />
              </View>

              <Text style={styles.score}>
                Score: {q.score} / {q.maxPoints}
              </Text>
              {q.feedback && (
                <Text style={styles.feedback}>{q.feedback}</Text>
              )}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  )
}

// Render content with math
function MathContent({ content }: { content: string }) {
  // Parse $...$ delimited math
  const parts = parseMathContent(content)

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {parts.map((part, i) =>
        part.type === 'math' ? (
          <SvgMath key={i} latex={part.content} />
        ) : (
          <Text key={i}>{part.content}</Text>
        )
      )}
    </View>
  )
}

// SVG math component using MathJax output
function SvgMath({ latex }: { latex: string }) {
  const svgString = latexToSvg(latex)
  // Parse SVG string and render using react-pdf Svg primitives
  // This requires parsing the SVG output from MathJax
  return <Svg>{/* parsed SVG elements */}</Svg>
}
```

### Export Worker
```typescript
// scripts/export-worker.ts
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/lib/prisma'
import { ExportDocument } from '@/lib/export/pdf-generator'
import fs from 'fs/promises'
import path from 'path'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

const worker = new Worker('export', async (job: Job) => {
  const { examId, classIds, type } = job.data

  if (type === 'pdf') {
    // Fetch data
    const attempts = await fetchExportData(examId, classIds)
    const total = attempts.length

    // Generate PDF with progress updates
    for (let i = 0; i < total; i++) {
      await job.updateProgress({ current: i, total, phase: 'Processing' })
    }

    const pdfBuffer = await renderToBuffer(
      <ExportDocument exam={exam} attempts={attempts} />
    )

    // Save to temp file
    const filename = `export-${examId}-${Date.now()}.pdf`
    const filepath = path.join(process.cwd(), 'tmp', filename)
    await fs.writeFile(filepath, pdfBuffer)

    return { filepath, filename }
  }
}, { connection, concurrency: 2 })
```

### SSE Progress Endpoint
```typescript
// app/api/exams/[examId]/export/status/route.ts
import { QueueEvents } from 'bullmq'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')

  const stream = new ReadableStream({
    async start(controller) {
      const queueEvents = new QueueEvents('export', {
        connection: { host: 'localhost', port: 6379 }
      })

      queueEvents.on('progress', ({ jobId: id, data }) => {
        if (id === jobId) {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(new TextEncoder().encode(message))
        }
      })

      queueEvents.on('completed', ({ jobId: id, returnvalue }) => {
        if (id === jobId) {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ completed: true, ...returnvalue })}\n\n`)
          )
          controller.close()
        }
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Puppeteer for PDF | @react-pdf/renderer | 2023+ | No Chromium, faster, lighter |
| Polling for progress | SSE with BullMQ events | 2024 | Real-time updates, less overhead |
| KaTeX for PDF math | MathJax SVG output | N/A (different use case) | Self-contained SVG vs HTML+CSS |
| Manual CSV encoding | Papa.unparse | Established | Handles edge cases, encoding |

**Deprecated/outdated:**
- **mathjax-node:** Use mathjax-full v4 instead (newer API, better TypeScript support)
- **react-pdf (wojtekmaj):** This is for VIEWING PDFs, not generating. Use @react-pdf/renderer (diegomura).

## Open Questions

Things that couldn't be fully resolved:

1. **MathJax SVG to react-pdf Svg component mapping**
   - What we know: MathJax outputs SVG strings, react-pdf has Svg/Path components
   - What's unclear: Exact parsing/transformation needed to convert MathJax SVG output to react-pdf primitives
   - Recommendation: Build helper function, test with common LaTeX patterns during implementation

2. **Complex math rendering fidelity**
   - What we know: MathJax supports extensive LaTeX, renders to SVG
   - What's unclear: Whether all KaTeX-supported macros work identically in MathJax
   - Recommendation: Test with existing exam content, may need macro compatibility layer

3. **Temporary file storage for large exports**
   - What we know: MinIO is set up for image storage
   - What's unclear: Whether to use MinIO or filesystem for temporary export files
   - Recommendation: Start with filesystem (/tmp), migrate to MinIO if persistence needed

## Sources

### Primary (HIGH confidence)
- @react-pdf/renderer npm (v4.3.2) - Server-side API
- react-pdf.org/advanced - renderToStream/renderToBuffer documentation
- docs.bullmq.io/guide/workers - job.updateProgress() API
- docs.bullmq.io/guide/events - QueueEvents progress listening
- papaparse.com/docs - unparse() function documentation

### Secondary (MEDIUM confidence)
- docs.mathjax.org/en/latest/server/components.html - MathJax Node.js setup
- GitHub discussions on @react-pdf/renderer with Next.js App Router

### Tertiary (LOW confidence)
- Various Medium articles on PDF generation patterns
- Stack Overflow discussions on KaTeX/MathJax in PDFs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Well-established libraries, clear documentation
- CSV generation: HIGH - Papaparse is robust, already installed
- PDF generation: MEDIUM - @react-pdf/renderer well-documented, but math rendering requires custom work
- Math in PDF: MEDIUM - MathJax SVG is proven, but integration with react-pdf needs verification
- Async export: HIGH - BullMQ pattern already used in codebase

**Research date:** 2026-01-20
**Valid until:** 30 days (libraries are stable)

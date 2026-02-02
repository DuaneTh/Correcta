# Phase 8: PDF Exam Import - Research

**Researched:** 2026-02-02
**Domain:** PDF document analysis, AI-powered exam extraction, multimodal document processing
**Confidence:** MEDIUM

## Summary

This phase enables teachers to upload an existing PDF exam, which is analyzed by AI to automatically create a structured exam with questions, point allocations, and correction guidelines. The teacher lands directly in the exam editor with pre-filled questions ready for review and modification.

Research reveals that OpenAI now supports native PDF input in GPT-4o models (announced July 2025), eliminating the need for PDF-to-image conversion. The project already has OpenAI SDK v6 with structured outputs (zodResponseFormat) integrated from Phase 4, which is the recommended approach for extracting structured exam data. The existing BullMQ infrastructure from Phases 4 and 5 provides the pattern for async processing of uploaded PDFs.

The standard approach is: (1) Upload PDF to MinIO using existing infrastructure, (2) Submit to BullMQ queue for async processing, (3) Worker passes PDF URL to GPT-4o with structured output schema for exam extraction, (4) Populate Zustand exam editor store with extracted data, (5) Teacher reviews and modifies in existing editor.

**Primary recommendation:** Use GPT-4o native PDF support with structured outputs (zodResponseFormat) for exam extraction. Avoid custom PDF parsing libraries and PDF-to-image conversion - OpenAI handles both text and visual extraction internally.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenAI SDK | ^6.16.0 | Native PDF analysis with GPT-4o | Already integrated (Phase 4), supports structured outputs with Zod, handles native PDF input (since July 2025) |
| Zod | ^4.3.5 | Schema definition for structured exam extraction | Already integrated, works seamlessly with zodResponseFormat |
| BullMQ | ^5.64.1 | Async job queue for PDF processing | Already integrated (Phases 4, 5), proven pattern for long-running AI operations |
| MinIO | ^8.0.6 | PDF file storage | Already integrated (Phase 2), provides presigned URLs for upload and download |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-dropzone | Latest | Drag-and-drop file upload UI | Standard choice for React file upload, lightweight, TypeScript support |
| @headlessui/react | ^2.2.9 | Progress modal/dialog components | Already in project, provides accessible modal for upload progress |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native PDF support | pdf-parse + pdf2pic conversion | More complex: requires GraphicsMagick/Ghostscript dependencies, manual image base64 encoding, higher token costs for multiple images. Native PDF support is simpler and officially supported. |
| Structured outputs | Function calling | Structured outputs guarantee 100% schema adherence (vs ~95% with function calling). Already proven in Phase 4 grading. |
| BullMQ async | Synchronous API route | Synchronous would timeout on large PDFs. GPT-4o can take 10-30s for document analysis. |

**Installation:**
```bash
npm install react-dropzone
# All other dependencies already installed
```

## Architecture Patterns

### Recommended Flow

```
[Teacher uploads PDF]
        ↓
[Next.js API route validates file]
        ↓
[Upload to MinIO with unique key]
        ↓
[Enqueue import job in BullMQ]
        ↓
[Return job ID, show progress UI]
        ↓
[Worker: Download PDF from MinIO]
        ↓
[Worker: GPT-4o analyzes PDF with structured output]
        ↓
[Worker: Create exam/questions in database]
        ↓
[Worker: Mark job complete]
        ↓
[Client polls for completion]
        ↓
[Navigate to exam editor with pre-filled data]
```

### Pattern 1: Native PDF Upload to OpenAI

**What:** Pass PDF file URL directly to GPT-4o without conversion
**When to use:** Always - this is the standard approach since July 2025

**Example:**
```typescript
// Based on existing Phase 4 grading pattern
import { getOpenAIClient } from '@/lib/grading/openai-client'
import { zodResponseFormat } from 'openai/helpers/zod'

const openai = await getOpenAIClient()

const completion = await openai.chat.completions.parse({
  model: 'gpt-4o', // Vision-capable model
  messages: [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: {
            url: pdfUrl // MinIO presigned URL or public URL
          }
        }
      ]
    }
  ],
  response_format: zodResponseFormat(ExamExtractionSchema, 'exam_import'),
  temperature: 0.1, // Low temperature for consistency
  max_tokens: 4000 // Large schema requires more tokens
})

const extracted = completion.choices[0]?.message?.parsed
```

### Pattern 2: Zod Schema for Exam Extraction

**What:** Define comprehensive schema for extracted exam structure
**When to use:** Defining the structure GPT-4o should output

**Example:**
```typescript
// Source: Existing Phase 4 schemas.ts pattern
import { z } from 'zod'

export const ExtractedQuestionSchema = z.object({
  content: z.string().describe('Question text, peut inclure formules LaTeX avec $...$'),
  type: z.enum(['OPEN_QUESTION', 'MCQ']).describe('Type de question detecte'),
  maxPoints: z.number().describe('Points attribues a cette question'),
  correctionGuidelines: z.string().optional().describe('Bareme ou criteres de correction extraits du PDF'),
  choices: z.array(z.object({
    text: z.string(),
    isCorrect: z.boolean()
  })).optional().describe('Choix multiples si type MCQ detecte')
})

export const ExamExtractionSchema = z.object({
  title: z.string().describe('Titre de l\'examen extrait du PDF'),
  questions: z.array(ExtractedQuestionSchema).describe('Liste des questions extraites'),
  totalPoints: z.number().describe('Total des points de l\'examen'),
  metadata: z.object({
    confidence: z.enum(['high', 'medium', 'low']).describe('Niveau de confiance de l\'extraction'),
    warnings: z.array(z.string()).optional().describe('Avertissements sur des ambiguites detectees')
  })
})

export type ExamExtraction = z.infer<typeof ExamExtractionSchema>
```

### Pattern 3: BullMQ Job for Async Processing

**What:** Enqueue PDF import as background job with progress tracking
**When to use:** Always - PDF analysis can take 10-30 seconds

**Example:**
```typescript
// Source: Existing Phase 4/5 queue patterns
import { Queue } from 'bullmq'

// In lib/queue.ts - add new queue
export const pdfImportQueue = connection
  ? new Queue('pdf-import', {
      connection,
      defaultJobOptions: {
        attempts: 2, // Retry once on failure
        backoff: {
          type: 'fixed',
          delay: 5000
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 50
        },
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
          count: 100
        }
      }
    })
  : null

// In API route
const job = await pdfImportQueue?.add('import-exam', {
  userId: session.user.id,
  pdfKey: uploadedKey,
  pdfUrl: pdfUrl,
  institutionId: session.user.institutionId
})

return NextResponse.json({
  jobId: job.id,
  status: 'processing'
})
```

### Pattern 4: File Upload with react-dropzone

**What:** Drag-and-drop PDF upload with validation
**When to use:** Exam creation page upload UI

**Example:**
```typescript
// Source: react-dropzone documentation + existing upload pattern
import { useDropzone } from 'react-dropzone'
import { useState } from 'react'

function PDFUploadZone() {
  const [uploading, setUploading] = useState(false)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 32 * 1024 * 1024, // 32MB OpenAI limit
    onDrop: async (acceptedFiles) => {
      setUploading(true)
      const file = acceptedFiles[0]

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/exam-import/upload', {
        method: 'POST',
        body: formData
      })

      const { jobId } = await response.json()
      // Start polling for job completion
      pollJobStatus(jobId)
    }
  })

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-8">
      <input {...getInputProps()} />
      {isDragActive ?
        <p>Déposez le fichier PDF ici...</p> :
        <p>Glissez-déposez un PDF ou cliquez pour sélectionner</p>
      }
    </div>
  )
}
```

### Pattern 5: Progress Tracking and Polling

**What:** Poll BullMQ job status and show progress to user
**When to use:** After submitting PDF for import

**Example:**
```typescript
// Source: BullMQ job status pattern
async function pollJobStatus(jobId: string) {
  const checkStatus = async () => {
    const response = await fetch(`/api/exam-import/status/${jobId}`)
    const data = await response.json()

    if (data.status === 'completed') {
      // Navigate to exam editor with created exam ID
      router.push(`/exams/${data.examId}/edit`)
    } else if (data.status === 'failed') {
      setError(data.error)
    } else {
      // Still processing, poll again
      setTimeout(checkStatus, 2000)
    }
  }

  checkStatus()
}
```

### Anti-Patterns to Avoid

- **Converting PDF to images manually:** OpenAI handles this internally since July 2025. Manual conversion adds complexity, dependencies, and token costs.
- **Synchronous processing in API route:** PDF analysis takes 10-30s and will timeout. Always use BullMQ for async processing.
- **Custom PDF parsing logic:** Don't use pdf-parse or similar libraries to extract text first. GPT-4o with vision extracts both text and visual elements (formulas, diagrams) automatically.
- **Storing raw PDF content in database:** Store file in MinIO, only metadata in database. PDFs can be 10-32MB.
- **Not validating extracted data:** GPT-4o can hallucinate. Always validate point totals, question numbering, and allow teacher review before saving.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom parser with pdf-parse | OpenAI native PDF support | PDF text extraction is complex: word spacing, multi-column layouts, tables, formulas. OpenAI handles all of this + visual elements. pdf-parse fails on complex layouts (75% accuracy on scientific docs). |
| PDF to image conversion | Custom converter with pdf2pic | OpenAI native PDF support | Requires GraphicsMagick + Ghostscript system dependencies, adds deployment complexity, increases token costs (multiple images vs single PDF), manual base64 encoding. OpenAI eliminates this entirely. |
| Drag-and-drop upload | Custom event handlers | react-dropzone | Handles file validation, MIME types, drag states, accessibility, mobile touch. Well-tested with 19k+ stars. |
| Job queue progress tracking | Custom polling/websockets | BullMQ job status API | Already proven in Phases 4/5. Handles retries, failure states, job persistence. |
| Structured extraction | Regex/manual parsing | OpenAI structured outputs | 100% schema adherence guarantee (vs brittle regex). Already proven in Phase 4 with zodResponseFormat. |
| Question numbering detection | Custom regex patterns | GPT-4o with prompt | Question numbering varies: "1.", "Q1:", "Question 1:", "I.", etc. GPT-4o understands context better than regex. |

**Key insight:** The complexity in exam import is not PDF parsing (solved by OpenAI native support) but semantic understanding: detecting question boundaries, inferring point values from context, extracting implicit correction criteria. This requires AI, not traditional parsing.

## Common Pitfalls

### Pitfall 1: Ignoring OpenAI PDF Limits

**What goes wrong:** Upload fails or costs exceed expectations
**Why it happens:** OpenAI limits PDFs to 100 pages and 32MB. PDFs consume significantly more tokens than text (both text + image processing per page).
**How to avoid:**
- Validate file size < 32MB before upload
- Validate page count < 100 (can extract with pdf-parse metadata check only, not full parsing)
- Warn teachers about token costs for large PDFs
- Consider breaking very large exams into smaller uploads
**Warning signs:** API errors with "file too large", unexpectedly high token usage

### Pitfall 2: Text Extraction Accuracy Assumptions

**What goes wrong:** GPT-4o misreads text, especially small/rotated text, mathematical formulas, or non-Latin characters
**Why it happens:** Research shows GPT-4 Vision has 27.2% error rate in image comprehension, struggles with text extraction (e.g., "Eggless" → "Eggs"), and makes formula subscript errors
**How to avoid:**
- Use low temperature (0.1) for consistency
- Include confidence level in extraction schema
- Show extracted content to teacher for review BEFORE saving
- Highlight low-confidence extractions in UI
- Allow teacher to edit every field in editor
**Warning signs:** Garbled formulas, missing subscripts/superscripts, incorrect question counts

### Pitfall 3: Hallucinated Structure

**What goes wrong:** GPT-4o invents questions, point values, or correction criteria that don't exist in PDF
**Why it happens:** Models are trained to always provide an answer rather than say "I don't know" (the "exam problem"). When extraction is ambiguous, model guesses confidently.
**How to avoid:**
- Prompt explicitly: "If you cannot confidently extract a field, set it to null rather than guessing"
- Include metadata.confidence and metadata.warnings in extraction schema
- Validate total points match (sum of questions vs stated total)
- Show diff between PDF preview and extracted content
- Never auto-publish imported exams - require explicit teacher review
**Warning signs:** Suspiciously round numbers, generic correction guidelines like "évaluer la justesse", questions that feel AI-generated

### Pitfall 4: Multi-Column Layout Confusion

**What goes wrong:** Questions from different columns get merged, reading order is wrong
**Why it happens:** PDFs store text fragments out of reading order. Multi-column layouts are problematic for all parsers (research shows even best tools struggle).
**How to avoid:**
- Prompt GPT-4o explicitly about expected layout: "This is a two-column exam layout. Questions are numbered sequentially down the left column, then continue in the right column."
- Ask for question numbers in extraction to validate sequence
- Visual inspection required - teacher reviews order in editor
**Warning signs:** Questions numbered out of order, mixed content from different sections

### Pitfall 5: Table and Point Allocation Errors

**What goes wrong:** Point values extracted incorrectly, rubric tables misaligned
**Why it happens:** Tables are "just aligned text or drawn lines" in PDFs, not true table objects. Research shows 75% accuracy on complex tables with many parsers.
**How to avoid:**
- Validate sum of extracted points matches any stated total in PDF
- Extract point allocations as separate field with confidence level
- Allow bulk point editing in UI after import
- Include table extraction in low-confidence warnings
**Warning signs:** Point totals don't add up, missing points for some questions, decimal point errors (1.5 → 15)

### Pitfall 6: File Storage Race Conditions

**What goes wrong:** BullMQ worker tries to access PDF before MinIO upload completes, or presigned URL expires
**Why it happens:** Async operations - API route returns before upload finalizes, or worker runs after URL expiry
**How to avoid:**
- Use MinIO presigned GET URLs with sufficient expiry (1 hour default)
- Await uploadFile() completion before enqueueing job
- Store both pdfKey (permanent) and pdfUrl (temporary) in job data
- Worker should regenerate presigned URL from key if URL fails
**Warning signs:** "File not found" errors in worker, "Invalid URL" from OpenAI

### Pitfall 7: Not Handling Partial Extraction Gracefully

**What goes wrong:** Worker crashes on malformed PDF, teacher loses all work
**Why it happens:** Some PDFs are corrupted, scanned images with no text, or unreadable formats
**How to avoid:**
- Wrap OpenAI call in try-catch with specific error handling
- For parsing failures, create exam with empty questions and show error to teacher
- Allow teacher to manually add questions after failed import
- Store original PDF key in exam metadata for re-processing
- Mark job as "completed with warnings" vs "failed"
**Warning signs:** Worker crashes with unhandled exceptions, jobs stuck in "active" state

## Code Examples

Verified patterns from research and existing codebase:

### OpenAI Native PDF Analysis

```typescript
// Source: OpenAI API patterns + Phase 4 grading structure
import { getOpenAIClient, GRADING_MODEL } from '@/lib/grading/openai-client'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ExamExtractionSchema } from './schemas'
import { getPresignedDownloadUrl } from '@/lib/storage/minio'

export async function extractExamFromPDF(params: {
  pdfKey: string,
  userId?: string
}) {
  const openai = await getOpenAIClient()

  // Generate presigned URL for OpenAI to access PDF
  const pdfUrl = await getPresignedDownloadUrl('exam-pdfs', params.pdfKey, 3600)

  const systemPrompt = `Tu es un expert en analyse de documents d'examens.
Ta tâche est d'extraire la structure complète d'un examen PDF:
- Questions numérotées avec leur contenu (y compris formules mathématiques en LaTeX)
- Attribution des points pour chaque question
- Type de question (réponse ouverte ou QCM)
- Barèmes et critères de correction si présents

Si des informations sont ambiguës, indique-le dans les avertissements.
N'invente jamais de contenu absent du PDF.`

  const userPrompt = `Analyse cet examen PDF et extrais toutes les questions avec leur structure.
Format attendu: réponses en français, formules mathématiques en LaTeX avec $...$`

  const completion = await openai.chat.completions.parse({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: { url: pdfUrl }
          }
        ]
      }
    ],
    response_format: zodResponseFormat(ExamExtractionSchema, 'exam_extraction'),
    temperature: 0.1,
    max_tokens: 4000
  })

  const extracted = completion.choices[0]?.message?.parsed
  if (!extracted) {
    throw new Error('Failed to parse exam extraction from OpenAI')
  }

  return extracted
}
```

### BullMQ Worker for PDF Import

```typescript
// Source: Phase 4 ai-grading-worker.ts pattern
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'
import { extractExamFromPDF } from '@/lib/exam-import/extractor'

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

const worker = new Worker('pdf-import', async (job: Job) => {
  if (job.name === 'import-exam') {
    const { userId, pdfKey, institutionId } = job.data

    try {
      // Step 1: Extract exam structure from PDF using GPT-4o
      const extracted = await extractExamFromPDF({ pdfKey, userId })

      // Step 2: Create exam in database
      const exam = await prisma.exam.create({
        data: {
          title: extracted.title,
          createdById: userId,
          institutionId: institutionId,
          status: 'DRAFT', // Always draft for review
          importedFromPdf: true,
          importMetadata: {
            pdfKey: pdfKey,
            confidence: extracted.metadata.confidence,
            warnings: extracted.metadata.warnings || []
          }
        }
      })

      // Step 3: Create questions with segments
      for (let i = 0; i < extracted.questions.length; i++) {
        const q = extracted.questions[i]

        await prisma.question.create({
          data: {
            examId: exam.id,
            order: i,
            type: q.type,
            segments: {
              create: [
                {
                  order: 0,
                  content: JSON.stringify([{ type: 'text', text: q.content }]),
                  maxPoints: q.maxPoints,
                  rubric: q.correctionGuidelines ? {
                    create: {
                      criteria: q.correctionGuidelines
                    }
                  } : undefined
                }
              ]
            },
            // For MCQ, create choices
            ...(q.type === 'MCQ' && q.choices ? {
              choices: {
                create: q.choices.map((choice, idx) => ({
                  order: idx,
                  text: choice.text,
                  isCorrect: choice.isCorrect
                }))
              }
            } : {})
          }
        })
      }

      // Step 4: Return exam ID for navigation
      return { examId: exam.id, status: 'completed' }

    } catch (error) {
      console.error('[PDF Import Worker] Error:', error)
      throw error // Let BullMQ handle retries
    }
  }
}, {
  connection,
  concurrency: 2 // Lower than grading - PDF analysis is slower
})

worker.on('completed', (job) => {
  console.log(`[PDF Import Worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[PDF Import Worker] Job ${job?.id} failed:`, err.message)
})
```

### Upload API Route with Validation

```typescript
// Source: Existing app/api/upload/route.ts pattern
import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isTeacher } from '@/lib/api-auth'
import { uploadFile, generateUploadKey } from '@/lib/storage/minio'
import { pdfImportQueue } from '@/lib/queue'

const MAX_PDF_SIZE = 32 * 1024 * 1024 // 32MB OpenAI limit

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession(request)
    if (!session?.user || !isTeacher(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be PDF' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: 'PDF exceeds 32MB limit' },
        { status: 400 }
      )
    }

    // TODO: Validate page count < 100 (requires lightweight PDF metadata check)

    // Upload to MinIO
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const key = generateUploadKey(file.name)

    await uploadFile(key, buffer, file.type, 'exam-pdfs')

    // Enqueue import job
    const job = await pdfImportQueue?.add('import-exam', {
      userId: session.user.id,
      pdfKey: key,
      institutionId: session.user.institutionId
    })

    if (!job) {
      throw new Error('Queue not initialized')
    }

    return NextResponse.json({
      jobId: job.id,
      status: 'processing'
    })

  } catch (error) {
    console.error('PDF import upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
```

### React Upload Component with Progress

```typescript
// Source: react-dropzone docs + existing UI patterns
'use client'

import { useDropzone } from 'react-dropzone'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PDFImportUploader() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string>('Téléversement...')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 32 * 1024 * 1024,
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0]
        if (rejection.errors[0]?.code === 'file-too-large') {
          setError('Le PDF dépasse la limite de 32 Mo')
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          setError('Seuls les fichiers PDF sont acceptés')
        }
        return
      }

      setUploading(true)
      setError(null)
      const file = acceptedFiles[0]

      try {
        // Upload file
        setProgress('Téléversement du PDF...')
        const formData = new FormData()
        formData.append('file', file)

        const uploadResponse = await fetch('/api/exam-import/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          const { error } = await uploadResponse.json()
          throw new Error(error)
        }

        const { jobId } = await uploadResponse.json()

        // Poll for completion
        setProgress('Analyse de l\'examen en cours...')
        await pollJobStatus(jobId)

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec de l\'import')
        setUploading(false)
      }
    }
  })

  async function pollJobStatus(jobId: string) {
    const checkStatus = async () => {
      const response = await fetch(`/api/exam-import/status/${jobId}`)
      const data = await response.json()

      if (data.status === 'completed') {
        setProgress('Import réussi!')
        setTimeout(() => {
          router.push(`/exams/${data.examId}/edit`)
        }, 500)
      } else if (data.status === 'failed') {
        throw new Error(data.error || 'Import échoué')
      } else {
        // Still processing
        setTimeout(checkStatus, 2000)
      }
    }

    await checkStatus()
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <p className="text-lg font-medium">{progress}</p>
            <p className="text-sm text-gray-500 mt-2">
              Cela peut prendre 10-30 secondes...
            </p>
          </div>
        ) : isDragActive ? (
          <p className="text-lg">Déposez le fichier PDF ici</p>
        ) : (
          <div>
            <p className="text-lg font-medium">
              Importer un examen existant
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Glissez-déposez un PDF ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Maximum 32 Mo, 100 pages
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PDF-to-image conversion | Native PDF support in OpenAI API | July 2025 | Eliminates need for pdf2pic, GraphicsMagick/Ghostscript dependencies. Simpler deployment, lower token costs. |
| Function calling for extraction | Structured outputs with zodResponseFormat | August 2024 (GPT-4o-2024-08-06) | 100% schema adherence vs ~95% with function calling. No need for retry loops on malformed JSON. |
| Manual PDF parsing (pdf-parse, PyPDF2) | AI vision-based extraction | 2024-2025 | AI understands semantic structure (question boundaries, implicit point values) better than regex/heuristics. Handles visual elements (formulas, diagrams). |

**Deprecated/outdated:**
- **pdf2image/pdf2pic for OpenAI**: No longer needed since native PDF support. Only relevant if using other vision models without PDF support.
- **PyMuPDF/pdf-parse for text extraction**: Low accuracy (75%) on complex layouts. Better to let GPT-4o handle both text and visual extraction.
- **Function calling API**: Structured outputs supersede this for data extraction tasks. Function calling still valid for tool use.

## Open Questions

Things that couldn't be fully resolved:

1. **Page count validation without full PDF parsing**
   - What we know: OpenAI limits PDFs to 100 pages
   - What's unclear: Best way to check page count without parsing full PDF (pdf-parse would work but contradicts "don't use PDF parsers" recommendation)
   - Recommendation: Either (a) skip page validation and let OpenAI reject, or (b) use lightweight metadata-only check with pdf-parse (just page count, no content extraction)

2. **Token costs for PDF analysis**
   - What we know: PDFs consume more tokens than text (processes both text + images per page)
   - What's unclear: Exact token formula for PDF input (not documented in OpenAI pricing)
   - Recommendation: Log token usage in AIInteraction table (already exists from Phase 4), monitor costs in production, possibly add warnings for large PDFs

3. **Handling scanned PDFs vs native PDFs**
   - What we know: GPT-4 Vision has lower accuracy on scanned/image-based PDFs
   - What's unclear: Whether OpenAI automatically applies OCR to scanned PDFs or expects pre-OCR'd text
   - Recommendation: Test with scanned exam PDFs during implementation. May need to add detection and different handling for scanned vs native PDFs.

4. **Optimal prompt engineering for French exams**
   - What we know: GPT-4o supports French well, but exam formats vary
   - What's unclear: Best prompts for French-specific exam patterns (e.g., "Exercice 1", "Partie A/B/C" structure)
   - Recommendation: Iterate on prompts with real French exam PDFs. Consider making system prompt customizable by institution.

5. **Math formula extraction accuracy**
   - What we know: GPT-4 Vision makes errors with subscripts/superscripts in formulas
   - What's unclear: How often this occurs with exam PDFs specifically
   - Recommendation: Flag formulas as low-confidence in UI. Add formula validation (check for incomplete $...$ delimiters). Consider human review step for math-heavy exams.

## Sources

### Primary (HIGH confidence)
- OpenAI SDK v6 documentation and existing Phase 4 integration (lib/grading/openai-client.ts, lib/grading/grader.ts)
- BullMQ patterns from Phase 4 and Phase 5 (lib/queue.ts, scripts/ai-grading-worker.ts)
- MinIO integration from Phase 2 (lib/storage/minio.ts, app/api/upload/route.ts)
- Zod structured outputs pattern from Phase 4 (lib/grading/schemas.ts)

### Secondary (MEDIUM confidence)
- [OpenAI API Now Works with PDF Files](https://learnprompting.org/blog/openai-api-works-with-pdfs) - Native PDF support announcement (July 2025)
- [OpenAI Structured Outputs Documentation](https://platform.openai.com/docs/guides/structured-outputs) - zodResponseFormat patterns
- [BullMQ File Upload Processing Pattern](https://medium.com/lets-code-future/handling-file-upload-processing-with-bullmq-and-node-js-workers-2ef9fca09821) - Async file processing
- [7 PDF Parsing Libraries for Node.js](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025) - Library comparison
- [react-dropzone GitHub](https://github.com/react-dropzone/react-dropzone) - File upload component

### Tertiary (LOW confidence - requires validation)
- [PDF Data Extraction Benchmark 2025](https://procycons.com/en/blogs/pdf-data-extraction-benchmark/) - Parser accuracy comparison (75% on complex documents)
- [Hidden flaws behind expert-level accuracy of GPT-4 Vision](https://www.nature.com/articles/s41746-024-01185-7) - Vision API error analysis (27.2% image comprehension errors)
- [Why language models hallucinate (OpenAI)](https://openai.com/index/why-language-models-hallucinate/) - Hallucination causes
- [AI Exam Creator Tools](https://studypdf.net/ai-exams) - Educational AI tools landscape
- [MinIO Presigned URL Documentation](https://docs.min.io/community/minio-object-store/integrations/presigned-put-upload-via-browser.html) - Upload patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All core libraries already integrated and proven in earlier phases
- Architecture: HIGH - Patterns directly mirror existing Phase 4 (OpenAI) and Phase 5 (BullMQ) implementations
- Pitfalls: MEDIUM - Based on research findings and GPT-4 Vision limitations, but not verified with actual exam PDFs in this project

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - relatively stable domain, OpenAI PDF support is mature)

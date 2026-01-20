# Phase 4: AI Correction - Research

**Researched:** 2026-01-20
**Domain:** AI-powered exam grading with GPT-4, job queue orchestration, LaTeX handling
**Confidence:** HIGH

## Summary

Phase 4 implements GPT-4 automatic grading for student answers with personalized feedback. The existing codebase has substantial infrastructure already in place:

1. **BullMQ queue** (`lib/queue.ts`) with `aiGradingQueue` already configured with retry logic
2. **Worker stub** (`scripts/ai-grading-worker.ts`) that processes `grade-answer` jobs
3. **Grade model** with support for AI vs human grades (`gradedByUserId`, `aiRationale`, `isOverridden`)
4. **Grading UI** at `/dashboard/exams/[examId]/grading` with per-attempt correction view
5. **Content utilities** (`lib/content.ts`) with `segmentsToLatexString` for LaTeX conversion

The main work is replacing the stub worker with real GPT-4 integration, adding rubric pre-generation, implementing batch "Grade All" with progress tracking, and enhancing the review UI for editing grades.

**Primary recommendation:** Install OpenAI SDK, implement structured output schema for grading responses, and create a batch grading flow that uses BullMQ Flows for parent-child job coordination with real-time progress via QueueEvents.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai | ^4.73.0 | GPT-4 API access | Official SDK with structured outputs support |
| zod | ^3.23.0 | Schema validation | Required for `zodResponseFormat` with OpenAI SDK |
| bullmq | 5.64.1 | Job queue (INSTALLED) | Already configured, supports flows and progress |
| ioredis | 5.8.2 | Redis client (INSTALLED) | Already used for queue backend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| katex | 0.16.27 | LaTeX rendering (INSTALLED) | Render AI feedback with math |
| @types/katex | ^0.16.0 | TypeScript types | Type safety for KaTeX |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| OpenAI GPT-4 | Anthropic Claude | Both viable; OpenAI has more grading research and structured outputs |
| zod | JSON schema manual | zod integrates directly with OpenAI SDK's `zodResponseFormat` |
| BullMQ Flows | Custom orchestration | Flows provide built-in parent-child dependency tracking |

**Installation:**
```bash
npm install openai zod
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── queue.ts                    # EXISTING - aiGradingQueue
├── grading/
│   ├── openai-client.ts       # OpenAI SDK singleton
│   ├── schemas.ts             # Zod schemas for grading responses
│   ├── prompts.ts             # Prompt templates for rubric + grading
│   ├── rubric-generator.ts    # Generate rubric from question + guidelines
│   └── grader.ts              # Core grading logic
scripts/
├── ai-grading-worker.ts       # EXISTING - Update with real GPT-4 calls
app/
├── api/
│   ├── exams/[examId]/
│   │   ├── grade-all/
│   │   │   └── route.ts       # NEW - Batch grading endpoint
│   │   └── rubric/
│   │       └── route.ts       # NEW - Rubric generation/editing
│   └── grading-progress/
│       └── route.ts           # NEW - SSE or polling for progress
```

### Pattern 1: Structured Outputs with Zod
**What:** Define grading response schema using Zod, let OpenAI SDK enforce JSON structure
**When to use:** All GPT-4 grading calls to ensure consistent response format
**Example:**
```typescript
// Source: OpenAI SDK + Zod integration
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';

const GradingResponseSchema = z.object({
  score: z.number().min(0).describe("Points awarded, 0 to maxPoints"),
  feedback: z.string().describe("Personalized feedback for the student, neutral academic tone"),
  reasoning: z.string().describe("Internal reasoning for the score, not shown to student"),
  confidence: z.number().min(0).max(1).describe("Confidence in the grading, 0-1"),
});

type GradingResponse = z.infer<typeof GradingResponseSchema>;

const openai = new OpenAI();

async function gradeAnswer(params: {
  question: string;
  rubric: string;
  studentAnswer: string;
  maxPoints: number;
}): Promise<GradingResponse> {
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    temperature: 0, // Deterministic for grading
    messages: [
      {
        role: "system",
        content: `You are an academic grader. Grade the student's answer based on the rubric.
Output a JSON object with score, feedback, reasoning, and confidence.
- feedback: Neutral academic tone in French, explain score proportionally
- reasoning: Your internal analysis (not shown to student)
- If the answer contains LaTeX math, you may include LaTeX in your feedback using $...$ delimiters`
      },
      {
        role: "user",
        content: `Question: ${params.question}

Rubric (max ${params.maxPoints} points):
${params.rubric}

Student Answer:
${params.studentAnswer}`
      }
    ],
    response_format: zodResponseFormat(GradingResponseSchema, "grading"),
  });

  return completion.choices[0].message.parsed!;
}
```

### Pattern 2: BullMQ Flow for Batch Grading
**What:** Use parent-child job pattern where "Grade All" creates a parent job with children for each answer
**When to use:** Batch grading with progress tracking
**Example:**
```typescript
// Source: BullMQ documentation
import { FlowProducer, Queue } from 'bullmq';

const flowProducer = new FlowProducer({ connection });

async function enqueueGradeAll(examId: string, answers: Array<{ id: string; questionId: string }>) {
  const flow = await flowProducer.add({
    name: 'grade-exam-batch',
    queueName: 'ai-grading',
    data: { examId, totalCount: answers.length },
    children: answers.map(answer => ({
      name: 'grade-answer',
      queueName: 'ai-grading',
      data: { examId, answerId: answer.id, questionId: answer.questionId }
    }))
  });

  return flow.job.id; // Parent job ID for progress tracking
}
```

### Pattern 3: Progress Tracking via QueueEvents
**What:** Subscribe to job progress events for real-time UI updates
**When to use:** "Grade All" progress bar
**Example:**
```typescript
// Source: BullMQ documentation
import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('ai-grading', { connection });

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  // Notify UI of completion
});

queueEvents.on('progress', ({ jobId, data }) => {
  // data contains progress info { completed: n, total: m }
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  // Handle failure notification
});
```

### Pattern 4: Rubric Pre-Generation
**What:** Generate grading rubric before grading any answers, allow teacher to edit
**When to use:** Before "Grade All" starts
**Example:**
```typescript
const RubricSchema = z.object({
  criteria: z.array(z.object({
    name: z.string(),
    points: z.number(),
    description: z.string(),
    levels: z.array(z.object({
      points: z.number(),
      description: z.string(),
    }))
  })),
  totalPoints: z.number(),
});

async function generateRubric(params: {
  questionContent: string;
  correctionGuidelines: string | null;
  maxPoints: number;
}): Promise<z.infer<typeof RubricSchema>> {
  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Generate a grading rubric for this question.
The rubric should have clear criteria with point allocations that sum to maxPoints.
Include descriptions for full, partial, and zero credit.`
      },
      {
        role: "user",
        content: `Question: ${params.questionContent}

Teacher Guidelines: ${params.correctionGuidelines || 'None provided'}

Max Points: ${params.maxPoints}`
      }
    ],
    response_format: zodResponseFormat(RubricSchema, "rubric"),
  });

  return completion.choices[0].message.parsed!;
}
```

### Anti-Patterns to Avoid
- **Calling OpenAI in request handlers:** Always use the queue to avoid timeout (3-15s GPT-4 latency)
- **Per-answer rubric generation:** Same rubric must be used for all students (equity)
- **Storing rubric only in memory:** Persist rubric to DB before grading starts
- **Ignoring human overrides:** Never replace grades where `gradedByUserId !== null || isOverridden`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON response validation | Manual regex/parsing | Zod + zodResponseFormat | 100% schema compliance with OpenAI structured outputs |
| Batch job coordination | Custom job tracking | BullMQ Flows | Built-in parent-child dependencies, automatic completion tracking |
| Progress tracking | Polling DB repeatedly | QueueEvents | Event-driven, real-time, minimal overhead |
| LaTeX to string | Custom parser | segmentsToLatexString | Already exists in lib/content.ts, handles tables/graphs |
| Retry logic | Custom retry code | BullMQ defaultJobOptions | Already configured with exponential backoff |

**Key insight:** The existing codebase has most of the infrastructure. The main work is wiring real GPT-4 calls and adding the batch orchestration layer.

## Common Pitfalls

### Pitfall 1: GPT-4 Response Inconsistency
**What goes wrong:** AI returns scores outside valid range or malformed feedback
**Why it happens:** Without structured outputs, GPT-4 can deviate from expected format
**How to avoid:** Use `zodResponseFormat` with explicit constraints (min/max on score)
**Warning signs:** Type errors when parsing responses, scores > maxPoints

### Pitfall 2: Rubric Misinterpretation by AI
**What goes wrong:** AI interprets rubric criteria differently than human graders
**Why it happens:** Rubrics written for humans may be ambiguous to AI
**How to avoid:** Generate AI-specific rubric from teacher guidelines, review before grading
**Warning signs:** Score distribution significantly different from expected

### Pitfall 3: Race Condition in Batch Completion
**What goes wrong:** Parent job completes before all children finish
**Why it happens:** Manual completion tracking without proper synchronization
**How to avoid:** Use BullMQ Flows which handle this automatically
**Warning signs:** Exam marked as GRADED while some answers still pending

### Pitfall 4: LaTeX Round-Trip Corruption
**What goes wrong:** Math expressions corrupted when passing through AI
**Why it happens:** AI modifies LaTeX syntax or escaping
**How to avoid:** Use `$...$` delimiters consistently, validate LaTeX in response
**Warning signs:** KaTeX rendering errors in feedback display

### Pitfall 5: Overwriting Human Grades
**What goes wrong:** AI grading overwrites teacher corrections
**Why it happens:** Not checking `gradedByUserId` and `isOverridden` flags
**How to avoid:** Always filter out answers with human grades before enqueueing (ALREADY DONE in enqueue-ai route)
**Warning signs:** Teacher corrections lost after re-grading

### Pitfall 6: Cost Explosion
**What goes wrong:** Unexpected OpenAI API costs from retries or long answers
**Why it happens:** No token limits or cost monitoring
**How to avoid:** Set `max_tokens` in API call, log usage per job, set up billing alerts
**Warning signs:** Monthly bill exceeds estimates

## Code Examples

Verified patterns from official sources and existing codebase:

### Existing: Enqueue AI Grading (lib/queue.ts integration)
```typescript
// Source: app/api/attempts/[id]/grading/enqueue-ai/route.ts
// Already implemented - filters out human grades, uses addBulk
const jobs = answersToGrade.map(answer => ({
    name: 'grade-answer',
    data: {
        attemptId: attempt.id,
        answerId: answer.id,
        questionId: answer.questionId
    }
}))

if (jobs.length > 0) {
    await aiGradingQueue.addBulk(jobs)
}
```

### Existing: Grade Upsert Pattern (lib/attemptStatus.ts)
```typescript
// Source: scripts/ai-grading-worker.ts
// Pattern for upserting AI grade while preserving human grades
await prisma.grade.upsert({
    where: { answerId: answerId },
    update: {
        score: clampedScore,
        feedback: feedback,
        aiRationale: aiRationale,
        gradedByUserId: null,  // Marks as AI-graded
        isOverridden: false
    },
    create: {
        answerId: answerId,
        score: clampedScore,
        feedback: feedback,
        aiRationale: aiRationale,
        gradedByUserId: null,
        isOverridden: false
    }
})

// Then update attempt status
await recomputeAttemptStatus(attemptId)
```

### Existing: Content to LaTeX Conversion
```typescript
// Source: lib/content.ts
import { segmentsToLatexString } from '@/lib/content'

// Converts ContentSegment[] to string with $...$ delimiters for math
const answerText = segmentsToLatexString(answerSegments)
// Result: "The answer is $x^2 + 2x + 1$ which factors to $(x+1)^2$"
```

### OpenAI Grading with Structured Output
```typescript
// Source: OpenAI SDK documentation + research
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GradingResponse = z.object({
  score: z.number(),
  feedback: z.string(),
  aiRationale: z.string(),
});

async function gradeWithGPT4(
  question: string,
  rubric: string,
  studentAnswer: string,
  maxPoints: number
) {
  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o',
    temperature: 0,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `Tu es un correcteur academique. Evalue la reponse de l'etudiant selon le bareme.
- Score: 0 a ${maxPoints} points
- Feedback: Ton neutre et academique, en francais. Explique brievement ce qui est correct et ce qui manque.
- Si la reponse est correcte, le feedback peut etre court. Si incorrecte, explique les erreurs.
- Tu peux inclure des formules LaTeX dans le feedback avec $...$.
- aiRationale: Ton raisonnement interne (non visible par l'etudiant).`
      },
      {
        role: 'user',
        content: `Question:
${question}

Bareme (${maxPoints} points):
${rubric}

Reponse de l'etudiant:
${studentAnswer}`
      }
    ],
    response_format: zodResponseFormat(GradingResponse, 'grading'),
  });

  const result = completion.choices[0].message.parsed;

  // Clamp score to valid range
  return {
    ...result,
    score: Math.min(maxPoints, Math.max(0, result.score)),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| json_mode | Structured outputs with response_format | August 2024 | 100% schema compliance vs ~93% with json_mode |
| gpt-4-turbo | gpt-4o | May 2024 | 2x faster, cheaper, better vision support |
| Manual job tracking | BullMQ Flows | BullMQ 4.0 | Built-in parent-child coordination |
| chat.completions.create | beta.chat.completions.parse | SDK 4.0 | Native Zod integration for structured outputs |

**Deprecated/outdated:**
- `response_format: { type: "json_object" }`: Use `json_schema` with Zod instead
- Manual JSON parsing of GPT responses: Use `zodResponseFormat` for automatic validation
- OpenAI SDK < 4.0: Missing Zod integration

## Open Questions

Things that couldn't be fully resolved:

1. **Visual capture for complex content (tables/graphs)**
   - What we know: CONTEXT.md mentions "screenshot or generated PDF" for visual context
   - What's unclear: Best approach for capturing rendered content as image
   - Recommendation: Defer visual capture to v2; for v1, use `segmentsToLatexString` for text representation, and note that graphs will be represented as "[graph]" placeholder

2. **Optimal batch size for "Grade All"**
   - What we know: BullMQ handles concurrency well, current worker has `concurrency: 5`
   - What's unclear: Optimal concurrency for GPT-4 API rate limits
   - Recommendation: Start with 5 concurrent, monitor rate limit errors, adjust

3. **Rubric storage location**
   - What we know: Need to store generated rubric for equity (same rubric for all students)
   - What's unclear: Should it be on Question model or Exam level?
   - Recommendation: Store on Question model as new `generatedRubric` JSON field (per-question rubrics make more sense)

## Sources

### Primary (HIGH confidence)
- OpenAI Structured Outputs documentation - [platform.openai.com/docs/guides/structured-outputs](https://platform.openai.com/docs/guides/structured-outputs)
- OpenAI Node.js SDK with Zod - [github.com/openai/openai-node/blob/master/helpers.md](https://github.com/openai/openai-node/blob/master/helpers.md)
- BullMQ documentation - [docs.bullmq.io](https://docs.bullmq.io)
- Existing codebase: `lib/queue.ts`, `scripts/ai-grading-worker.ts`, `app/api/attempts/[id]/grading/enqueue-ai/route.ts`

### Secondary (MEDIUM confidence)
- GPT-4 Math Grading Research - [arxiv.org/html/2411.05231v1](https://arxiv.org/html/2411.05231v1) - Shows CR (correct answer + rubric) approach performs best
- OpenAI Prompt Engineering Guide - [platform.openai.com/docs/guides/prompt-engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- BullMQ Tutorial - [dragonflydb.io/guides/bullmq](https://www.dragonflydb.io/guides/bullmq)

### Tertiary (LOW confidence)
- Community discussions on structured outputs edge cases - needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenAI SDK with Zod is the documented pattern for structured outputs
- Architecture: HIGH - BullMQ already installed and partially configured in codebase
- Pitfalls: MEDIUM - Based on research papers and documentation, not production experience
- Prompt templates: MEDIUM - Research shows rubric + correct answer improves accuracy, but specific prompt wording needs iteration

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stack is stable, OpenAI may update models)

---

## Appendix: Existing Infrastructure Summary

### Already Implemented
1. `lib/queue.ts` - BullMQ queue with retry logic, 1hr job retention
2. `scripts/ai-grading-worker.ts` - Stub worker processing `grade-answer` jobs
3. `app/api/attempts/[id]/grading/enqueue-ai/route.ts` - Enqueue endpoint that filters human grades
4. `lib/attemptStatus.ts` - `recomputeAttemptStatus()` function for status transitions
5. `app/api/grades/route.ts` - Grade upsert with manual override support
6. `app/api/exams/[examId]/release-results/route.ts` - Publish grades to students
7. `app/dashboard/exams/[examId]/grading/` - Grading dashboard and per-attempt view
8. `lib/content.ts` - `segmentsToLatexString()` for LaTeX conversion
9. `components/exam-editor/question-types/OpenQuestionEditor.tsx` - `correctionGuidelines` field

### Database Schema (Already Exists)
- `Grade` model: `score`, `feedback`, `aiRationale`, `isOverridden`, `gradedByUserId`
- `GradingTask` model: `status`, `assignedTo`, `error`
- `Attempt` statuses: `IN_PROGRESS`, `SUBMITTED`, `GRADING_IN_PROGRESS`, `GRADED`
- `Question.correctionGuidelines`: Teacher guidelines for AI grading (added in Phase 2)

### Missing (To Be Implemented)
1. OpenAI SDK integration
2. Real grading prompt/logic
3. Rubric pre-generation API
4. "Grade All" batch endpoint with progress tracking
5. Grade/feedback editing modal in UI
6. Re-grade single answer button
7. Per-class publication flow

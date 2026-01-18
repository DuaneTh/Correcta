# Architecture Patterns

**Domain:** AI-powered exam correction and grading
**Researched:** 2026-01-18

## Recommended Architecture

Three-tier system: Client math editor → Backend job pipeline → Export layer

```
Student              Teacher              Admin
    ↓                  ↓                    ↓
┌─────────────────────────────────────────────┐
│         React Frontend (Next.js)            │
│  - MathLive editor (answer capture)         │
│  - Exam creation UI                         │
│  - Grade display                            │
└────────────────┬────────────────────────────┘
                 ↓
         ┌──────────────────┐
         │   PostgreSQL     │
         │  - Exams         │
         │  - Answers       │
         │  - Grades        │
         └────────────────┬─┘
                 ↓
┌─────────────────────────────────────────────┐
│      Backend (Node.js API)                  │
├─────────────────────────────────────────────┤
│ • Math Editor Handler                       │
│   - Receives LaTeX strings                  │
│   - Validates/stores in DB                  │
│                                             │
│ • AI Correction Pipeline (BullMQ)           │
│   - Job queue management                    │
│   - OpenAI API integration (GPT-4)          │
│   - Grade storage                           │
│                                             │
│ • Export Service                            │
│   - PDF generation (server-side)            │
│   - CSV export                              │
│   - File streaming to client                │
└─────────────────────────────────────────────┘
                 ↑
        ┌────────┴─────────┐
        ↓                  ↓
   ┌────────────┐  ┌──────────────┐
   │ OpenAI API │  │  BullMQ/Redis│
   │  (GPT-4)   │  │  (Job Queue) │
   └────────────┘  └──────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **MathLive Editor** | Client-side math rendering, LaTeX input capture, real-time validation | React state, API |
| **Exam Service** | CRUD for exams, question management, metadata | DB, Frontend |
| **Answer Capture** | Receives LaTeX strings, stores in DB with student/exam foreign keys | MathLive Editor, DB |
| **AI Correction Job** | BullMQ job handler, calls GPT-4 API, stores grades/feedback in DB | BullMQ, OpenAI API, DB |
| **Job Queue (BullMQ)** | Manages async correction jobs, retry logic, status tracking | Correction Service, Redis |
| **Export Service** | Generates PDF/CSV, coordinates grade retrieval from DB | DB, File system |
| **Grade Store** | Persists grades, feedback, correction metadata | AI Service, Export Service, Frontend |

## Data Flow

### 1. Student Answer Submission

```
MathLive Editor
    ↓
Captures math as LaTeX string
    ↓
POST /api/exams/{examId}/answers
  { studentId, questionId, latex: "\\frac{x}{2}" }
    ↓
Backend validates LaTeX
    ↓
INSERT INTO answers (student_id, question_id, latex, created_at)
    ↓
Response: { answerId, status: "received" }
```

### 2. Teacher Triggers AI Correction

```
Teacher clicks "Grade All" in UI
    ↓
POST /api/exams/{examId}/grade
    ↓
Backend fetches all answers for exam
    ↓
FOR each answer:
  - Create BullMQ job
  - Job payload: { answerId, examId, studentId, latex, rubric }
    ↓
Jobs queued in Redis
    ↓
Response: { jobCount, status: "correction_started" }
```

### 3. Async AI Correction Job

```
BullMQ Worker polls Redis
    ↓
Dequeue correction job
    ↓
Call OpenAI API (GPT-4)
  Prompt: "Grade this math answer against rubric"
  Input: LaTeX string + expected answer + rubric
    ↓
API returns: { score, feedback, reasoning }
    ↓
UPDATE answers
  SET grade = score, feedback = feedback, corrected_at = NOW()
    ↓
Job complete / retry on failure
```

### 4. Export (PDF/CSV)

```
Teacher requests export
    ↓
POST /api/exams/{examId}/export?format=pdf
    ↓
Backend queries DB:
  SELECT answers, grades, students, questions
  WHERE exam_id = ?
    ↓
If PDF:
  - Use PDFKit or similar
  - Render: question → student answer (LaTeX) → grade → feedback
  - Stream to client
    ↓
If CSV:
  - Format: StudentName, QuestionNo, Score, Feedback
  - Stream to client
    ↓
Client: download file
```

## Database Schema

```sql
-- Core
CREATE TABLE exams (
  id UUID PRIMARY KEY,
  teacher_id UUID NOT NULL,
  title VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE questions (
  id UUID PRIMARY KEY,
  exam_id UUID REFERENCES exams,
  order INT,
  text VARCHAR,
  expected_answer_latex TEXT,
  rubric JSONB,
  points INT
);

CREATE TABLE answers (
  id UUID PRIMARY KEY,
  exam_id UUID REFERENCES exams,
  student_id UUID NOT NULL,
  question_id UUID REFERENCES questions,
  latex TEXT NOT NULL,  -- MathLive output
  grade DECIMAL(5,2),   -- AI-assigned score
  feedback TEXT,        -- GPT-4 feedback
  corrected_at TIMESTAMP,
  created_at TIMESTAMP
);

-- Job tracking
CREATE TABLE correction_jobs (
  id UUID PRIMARY KEY,
  answer_id UUID REFERENCES answers,
  status VARCHAR,
  retry_count INT,
  error_message TEXT,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

## Patterns to Follow

### Pattern 1: LaTeX as Canonical Representation

**What:** Store answers as LaTeX strings, not rendered HTML or images

**Why:** Enables AI processing, portability, version control, plain-text backup

**Implementation:**
```typescript
// Frontend: Capture from MathLive
const latex = mathLiveInstance.latex; // e.g., "\frac{x}{2}"
await fetch("/api/answers", {
  method: "POST",
  body: JSON.stringify({ latex })
});

// Backend: Store directly
answers.create({ latex: "\\frac{x}{2}", studentId, questionId });
```

### Pattern 2: Async Correction with BullMQ

**What:** Use job queue for AI grading, not synchronous API calls

**Why:**
- Student submissions don't block on OpenAI latency
- Retry failures automatically
- Handle rate limits gracefully
- Teacher initiates bulk grading intentionally

**Implementation:**
```typescript
// Teacher triggers correction
await correctionQueue.add("grade_exam", { examId }, {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 }
});

// Worker processes
correctionQueue.process(async (job) => {
  const answers = await getAnswers(job.data.examId);
  for (const answer of answers) {
    const grade = await gradeWithGPT4(answer.latex);
    await updateAnswer(answer.id, grade);
  }
});
```

### Pattern 3: Server-Side PDF/CSV Generation

**What:** Generate files on backend, stream to client

**Why:**
- Avoid browser memory limits with large exams
- Consistent formatting
- Can run async if needed (e.g., email large exports)

**Implementation:**
```typescript
app.get("/exams/:examId/export", async (req, res) => {
  const grades = await getExamGrades(req.params.examId);

  if (req.query.format === "pdf") {
    const pdf = generatePDF(grades);
    res.type("application/pdf");
    res.send(pdf);
  } else if (req.query.format === "csv") {
    const csv = generateCSV(grades);
    res.type("text/csv");
    res.send(csv);
  }
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Rendering Math as Images

**What:** Converting LaTeX to PNG/SVG and storing images instead of strings

**Why bad:**
- AI can't process images (requires OCR)
- Storage bloat
- Can't re-render or edit
- Breaks version control

**Instead:** Store LaTeX strings, render client-side with MathLive

### Anti-Pattern 2: Synchronous AI Grading

**What:** Teacher clicks "grade" → waits for OpenAI response → page blocks

**Why bad:**
- OpenAI latency (5-30s per answer)
- User experience halts
- Timeouts on large exams
- No retry mechanism

**Instead:** Queue jobs with BullMQ, let teacher see "Grading in progress"

### Anti-Pattern 3: Client-Side PDF Generation

**What:** Using pdfkit or similar in browser to build export

**Why bad:**
- Crashes on large exams (browser memory)
- Inconsistent rendering across devices
- Can't include server resources (fonts, styles)

**Instead:** Generate on backend, stream file to client

### Anti-Pattern 4: Storing Grades Without Correction Metadata

**What:** Only store final score, discard AI reasoning

**Why bad:**
- Teacher can't debug incorrect grades
- No audit trail
- Can't improve rubric based on failures

**Instead:** Store score + feedback + reasoning + timestamp + job ID

## Build Order

### Phase 1: Math Editor Foundation
- [ ] MathLive integration in React
- [ ] LaTeX capture and validation
- [ ] Store answers in DB
- [ ] Dependency: None

**Outcome:** Students can answer math questions; teachers see raw LaTeX

### Phase 2: Exam Creation UX
- [ ] Question CRUD UI
- [ ] Rubric/grading criteria input
- [ ] Exam creation and publishing
- [ ] Dependency: Phase 1

**Outcome:** Teachers can create exams; students can take them

### Phase 3: AI Correction Pipeline
- [ ] BullMQ + Redis setup
- [ ] OpenAI API integration (GPT-4)
- [ ] Correction job worker
- [ ] Grade storage in DB
- [ ] "Grade all" trigger UI
- [ ] Dependency: Phases 1-2

**Outcome:** Teachers can auto-grade using AI; students see scores

### Phase 4: Export & Reporting
- [ ] PDF generation (PDFKit or similar)
- [ ] CSV export
- [ ] Download UI
- [ ] Grade analytics dashboard
- [ ] Dependency: Phase 3

**Outcome:** Teachers can export grades in multiple formats; analytics visible

## Scalability Considerations

| Concern | At 100 Students | At 10K Students | At 100K Students |
|---------|-----------------|-----------------|------------------|
| **Answer Storage** | Single Postgres instance, simple indexing on (exam_id, student_id) | Add indexes on created_at, partition by exam | Partition by date; archive old exams |
| **AI Grading Latency** | BullMQ with 1-2 workers | BullMQ with 10+ workers; implement rate limiting for OpenAI | Stagger grading; use batch API if available |
| **PDF Export** | Sync generation in 5-10s | Async job queue; email results | Async only; store PDFs in S3; expire after 24h |
| **Database Load** | Postgres connection pool (20 conns) | Increase pool (50+); add read replicas for analytics | Separate analytics DB; use materialized views |

## Sources

- MathLive documentation (client-side rendering)
- BullMQ documentation (job queue patterns)
- OpenAI API reference (GPT-4 batch vs real-time)
- PostgreSQL performance tuning
- Next.js server-side data handling

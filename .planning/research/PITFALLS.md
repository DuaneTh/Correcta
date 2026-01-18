# Domain Pitfalls: AI Exam Correction Platforms

**Domain:** AI-assisted exam grading and correction
**Researched:** 2026-01-18
**Research Confidence:** HIGH (verified against academic research and official documentation)

## Critical Pitfalls

These mistakes cause system failures, data loss, or require major architectural rewrites.

### Pitfall 1: Math Rendering Inconsistency Across Surfaces

**What goes wrong:**
Math equations render correctly in the web editor but display differently in:
- Student viewing interface
- PDF exports
- Rubric display
- Grading feedback

Students see one equation, teachers see another, PDFs show a third version. Discrepancies lead to grading disputes and student complaints about fairness.

**Why it happens:**
Using different rendering engines for different surfaces:
- Editor uses MathJax for speed
- PDF export uses LaTeX compilation
- Web display uses KaTeX
- Each has different parsing rules, whitespace handling, and syntax requirements

**Consequences:**
- Students contest grades due to visible equation differences
- Teachers grade based on PDF version, students see different display
- Complex exams with heavy math become unreliable
- Export quality issues damage platform credibility

**Prevention:**
Use KaTeX as the single rendering engine everywhere:
- Web editor: KaTeX renderer
- Web display: KaTeX renderer
- PDF export: Pre-rendered KaTeX output (not recompiled LaTeX)
- Rubric/feedback: KaTeX renderer

**Detection:**
- Rendering looks correct in editor but wrong in preview
- PDF exports show syntax errors or blank equations
- Students report "equation shows differently on my screen"
- QA test reveals > 2% math rendering variance between surfaces

**Implementation Approach:**
```typescript
// Use unified KaTeX configuration
const mathConfig = {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ],
  throwOnError: false,
  errorColor: '#cc0000'
};

// Apply everywhere: editor, display, PDF (via rendered HTML)
```

**Sources:**
- [Pressbooks Guide: LaTeX rendering PDF inconsistency](https://opentextbc.ca/pressbooks/chapter/why-wont-my-latex-render-properly-in-the-pdf-export-of-my-book-when-it-works-fine-in-the-web-book/)
- [Markdown Monster: Math equation rendering](https://markdownmonster.west-wind.com/docs/Markdown-Rendering-Extensions/Rendering-Mathematics-Equations-MathTex-MML-Latex.html)

---

### Pitfall 2: AI Hallucinations in Grading Decisions

**What goes wrong:**
LLM generates plausible but incorrect grading feedback:
- Awards points for wrong reasoning
- Cites non-existent physics principles
- Creates "correct" solutions that contradict actual answer keys
- Provides contradictory feedback on similar questions

Student appeals: "But the AI said this was right!" Administrators can't defend grades.

**Why it happens:**
LLMs are optimized to be confident, not accurate. When uncertain about grading criteria:
1. Model sees ambiguous rubric
2. Generates plausible-sounding justification
3. Confidently asserts it as fact
4. Teacher doesn't notice contradiction until appeal

Research shows even GPT-4 grades exams with only 70% accuracy within 10% of human grading, and 31% within 5%.

**Consequences:**
- Appeals and grade disputes spike
- Students successfully challenge grades based on AI errors
- Admin liability: "Your AI graded unfairly"
- Loss of teacher and student trust in platform

**Prevention:**
1. **Structured prompts with explicit rubrics:**
   - Don't ask "Is this correct?"
   - Instead: "Award 2 points if answer contains [specific phrase]. Award 1 point if..."
   - Force binary, rubric-based decisions, not open-ended judgment

2. **Confidence scoring:**
   - Add confidence field: "Confidence in this grade: 95%"
   - Flag low-confidence grades (< 80%) for human review
   - Never auto-apply grades below threshold

3. **Human review requirement:**
   - Enforce teacher review before final grade application
   - Show AI reasoning, allow override
   - Collect override patterns to improve prompts

4. **Hybrid model approach:**
   - AI handles straightforward multiple choice, true/false
   - AI assists but doesn't decide on essays, math proofs
   - All grades > 90% OR < 50% require teacher approval

**Detection:**
- Grade appeals increase significantly (> 5% of submissions)
- Appeals reveal AI made contradictory decisions
- Students cite AI reasoning that contradicts rubric
- QA finds AI awards points for incorrect solutions

**Implementation Approach:**
```typescript
interface GradingResult {
  score: number;
  maxScore: number;
  reasoning: string;
  confidence: number; // 0-100
  requiresReview: boolean; // true if confidence < threshold
  rubricItems: Array<{
    criteria: string;
    pointsAwarded: number;
    pointsMax: number;
    met: boolean;
  }>;
}

// Only auto-apply if confidence > 85% AND all rubric items unambiguous
```

**Sources:**
- [MIT Sloan: AI-Assisted Grading Review](https://mitsloanedtech.mit.edu/2024/05/09/ai-assisted-grading-a-magic-wand-or-a-pandoras-box/)
- [British Educational Research Journal: ChatGPT Grading Comparison](https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/berj.4069)
- [OpenAI Cookbook: Handling hallucinations in educational context](https://arxiv.org/abs/2510.06265)
- [Springer: LLM-Powered Automated Assessment Survey](https://link.springer.com/article/10.1007/s44163-025-00517-0)

---

### Pitfall 3: Export Timeout on Large Exams

**What goes wrong:**
Teacher clicks "Export to PDF":
- Small exams (< 30 questions): Instant
- Medium exams (50-100 questions): 5-10 seconds, completes
- Large exams (200+ questions OR 500+ submissions): **Timeout after 30 seconds**

Result: User sees loading spinner for 30s, then 504 Gateway Timeout. Export is lost. Teachers must re-export or manually compile.

**Why it happens:**
Synchronous request-response cycle:
- POST /export-pdf → process all 500 submissions → render → compile → return file
- No background processing
- Single web server handles request
- No progress tracking (user thinks it's broken at 20s)

**Consequences:**
- Users lose work and must re-export
- Frustration on deadline exams (end of semester)
- Teachers resort to manual solutions (screenshot, print)
- Support tickets on "export is broken"

**Prevention:**

1. **Async export with background job:**
   - POST /export-pdf → returns job ID immediately
   - GET /export-pdf/:jobId → returns status + download link
   - Background worker processes in queue
   - User can navigate away, returns to check status

2. **Progress indicator:**
   - Show "Processing 45 of 200 submissions..."
   - Prevents user assumption of failure
   - Realistic timeframe set expectations

3. **Streaming response (if must be sync):**
   - Stream chunks of PDF to user as generated
   - User sees early completion
   - Fewer timeouts due to chunked processing

**Detection:**
- Export failures on exams > 150 submissions
- User feedback: "Export took too long"
- Server logs: 504 errors during peak export times
- QA test: 5-minute large exam export triggers timeout

**Implementation Approach:**
```typescript
// Async export
POST /api/exams/:examId/export
{
  format: 'pdf',
  includeAnswerKey: true
}

Response: { jobId: 'job_xyz', status: 'queued' }

// Check status
GET /api/export-jobs/:jobId
Response: {
  status: 'processing', // or 'completed', 'failed'
  progress: { processed: 145, total: 200 },
  downloadUrl: null // filled when complete
}

// Background job (Node.js Bull queue, Python Celery, etc.)
// Processes: render submissions → combine into PDF → upload to storage
// Returns: download URL valid for 24 hours
```

**Sources:**
- [OpenAI Cookbook: Timeout handling](https://cookbook.openai.com/examples/how_to_handle_rate_limits)

---

### Pitfall 4: Complex Exam Builder UX Causing User Abandonment

**What goes wrong:**
Teacher visits exam builder expecting simple "Add Question" button. Instead:
- 15 input fields for single question (question type, difficulty, points, learning objective, suggested time, tags, ...)
- Nested modals for rubric configuration
- Toggle switches hidden in "Advanced Settings"
- Required fields not obvious

Result: Teachers abandon builder mid-exam, switch to Google Forms or paper, or create exams with bad structure.

**Why it happens:**
Feature creep: Every stakeholder wants their field exposed:
- Learning objectives (curriculum alignment)
- Bloom's level (pedagogy team)
- Difficulty rating (analytics)
- Estimated time (scheduling)
- Custom tags (reporting)

All become required fields → complexity explosion.

**Consequences:**
- User adoption stalls: "Too hard to use"
- Low-quality exams: Teachers skip rubric setup
- Support burden: "How do I add a question?"
- Competitors win: Simpler tools adopted instead

**Prevention:**

1. **Simple defaults:**
   - Question type: Auto-select based on content
   - Points: Default to 1, optional to change
   - Time estimate: Hidden by default
   - Rubric: "Auto-grade" selected for MC, optional for essays

2. **Progressive disclosure:**
   - Show only essential fields first
   - "More options" expands advanced settings
   - Novice path: 3 fields → Publish
   - Advanced path: 15 fields available

3. **Sensible presets:**
   - "Quick Question" mode (2 fields)
   - "Detailed Rubric" mode (with scoring matrix)
   - User selects mode at start, not per-question

**Detection:**
- > 30% of started exams never completed
- Average exam builder session < 5 minutes (too quick = too simple or too hard)
- Support tickets asking "How do I...?" for basic operations
- A/B test: Simple builder → 60% completion vs Complex builder → 30%

**Implementation Approach:**
```typescript
// Question creation: Progressive disclosure
interface SimpleQuestion {
  type: 'multiple_choice' | 'short_answer' | 'essay';
  content: string; // The actual question
  // User adds this, then hits Save
}

interface DetailedQuestion extends SimpleQuestion {
  points: number;
  rubric?: ScoringRubric;
  learningObjective?: string;
  bloomsLevel?: 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
  estimatedTime?: number;
  tags?: string[];
}

// Builder shows: content, type, points
// "Add details?" button expands to: rubric, objectives, bloom's, time, tags
```

**Sources:**
- UX best practices in educational software (Nielsen Norman Group)
- Complexity management in survey/assessment tools

---

### Pitfall 5: OpenAI API Rate Limiting Blocking Mass Grading

**What goes wrong:**
Teacher submits 500-student exam for grading:
- First 50 submissions: Graded in seconds
- Submissions 51-100: Slow but working
- Submission 101: Request succeeds
- Submission 102: **429 Too Many Requests error**
- Submissions 102-500: Queued, retried, eventual timeout

Grading job fails partway through. User sees incomplete results. Support must re-run.

**Why it happens:**
OpenAI rate limits enforced at multiple levels:
- RPM: Requests per minute (varies by tier)
- TPM: Tokens per minute (typically 90K-3.5M depending on account)
- Single large exam grading: 500 requests × 500 tokens = 250K tokens

Exceeds TPM limit at tier 1 accounts. System doesn't queue → fails fast.

**Consequences:**
- Large exams can't be graded in real-time
- Support tickets: "Grading failed halfway"
- Batch grading becomes unreliable
- Users switch to platform with better rate limiting

**Prevention:**

1. **Request queue with retry logic:**
   - Don't call OpenAI directly in request handler
   - Queue each grading task: { submissionId, rubric, answer }
   - Worker process: Dequeue, grade, retry on 429 with exponential backoff
   - Re-try delays: 1s → 2s → 4s → 8s (max 6 attempts)

2. **Batch processing for non-urgent grading:**
   - If not needed immediately: Use OpenAI Batch API
   - More cost-effective, no rate limits
   - Ideal for "grade all exams" overnight jobs

3. **Proactive rate limit monitoring:**
   - Read response headers: x-ratelimit-remaining-requests, x-ratelimit-reset-requests
   - Pause queue before hitting limit
   - Add artificial delay between requests (e.g., 100ms)

4. **Token optimization:**
   - Truncate long answers: "First 2000 tokens of answer"
   - Compact prompts: Remove verbose instructions
   - Use smaller models (gpt-3.5-turbo) for simple grading

**Detection:**
- Grading job with 100+ submissions fails on submission 80+
- Server logs: "429 Too Many Requests from OpenAI"
- User reports: "Grading worked for first 50 students, then stopped"
- QA: Submitting 200 exams triggers rate limit after ~80 completed

**Implementation Approach:**
```typescript
// Queue-based grading with retry
import Bull from 'bull';

const gradingQueue = new Bull('exam-grading');

// Enqueue grading task
gradingQueue.add({
  submissionId: 'sub_123',
  rubric: rubricData,
  answer: studentAnswer,
  attempt: 0
}, {
  attempts: 6,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: true
});

// Worker processes queue with rate limit awareness
gradingQueue.process(async (job) => {
  const { submissionId, rubric, answer, attempt } = job.data;

  try {
    // Check rate limit before calling
    const usage = await getRateLimitStatus();
    if (usage.remainingRequests < 10) {
      // Wait before retrying
      await sleep(usage.resetSeconds * 1000);
    }

    const grade = await gradeWithOpenAI(rubric, answer);
    await db.submission.update(submissionId, { grade });
    return grade;
  } catch (error) {
    if (error.status === 429) {
      // Thrown 429 → Bull auto-retries with backoff
      throw error;
    }
    // Other errors
    throw error;
  }
});
```

**Batch API Alternative (for non-real-time grading):**
```bash
# OpenAI Batch API: Submit 10,000 grading requests at once
# Process overnight, no rate limits
# Cost: ~50% cheaper than regular API
curl https://api.openai.com/v1/batches \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input_file_id": "file_xyz",
    "endpoint": "/v1/chat/completions",
    "completion_window": "24h"
  }'
```

**Sources:**
- [OpenAI API Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)
- [OpenAI Cookbook: Handling Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits)
- [OpenAI Flex Processing & Batch API](https://platform.openai.com/docs/guides/flex-processing)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or reduced reliability (not critical failures).

### Pitfall 6: Weak Rubric Specification Leading to Inconsistent Grading

**What goes wrong:**
Rubric says: "Award points if answer shows understanding of concept."
- Teacher A interprets: "Student must name 2 specific principles"
- Teacher B interprets: "Student must show they thought about it"
- AI interprets: "Mentions any relevant word gets full points"

Same answer gets 0, 5, and 10 points from different evaluators.

**Prevention:**
- Use objective scoring criteria: "Mentions X AND Y AND Z" not "shows understanding"
- Require example answers for each score level (0 pts, 5 pts, 10 pts)
- Test rubric on 10 sample submissions before using on full class
- Flag inconsistencies when same answer scores differently

### Pitfall 7: No Audit Trail for Grade Changes

**What goes wrong:**
Student grade changes from 85 to 92 after teacher re-export. No record of:
- Who changed it
- When it was changed
- Why it was changed

Student contests: "You're modifying my grade without explanation." Admin can't investigate.

**Prevention:**
- Log all grade mutations: timestamp, user, old value, new value, reason
- Show change history in teacher view
- Alert student when grade changes (optional, configurable)
- Enable admin audit review

### Pitfall 8: PDF Export Doesn't Match Original Question Order

**What goes wrong:**
Questions saved in: Q1, Q2, Q3
PDF exports as: Q3, Q1, Q2 (different order)

Students review wrong questions at home, confusion about which solutions apply.

**Prevention:**
- Store explicit question order (sequence field, not list index)
- Sort by order field before rendering, not by ID or creation date
- Test export order against original order
- Version export schema to prevent accidental reordering

### Pitfall 9: Missing Offline Exam Access

**What goes wrong:**
Teacher uses platform at school with good wifi. Takes exam PDF home on USB. Opens it next day:
- Math equations don't render (linked to external CDN)
- Images don't load (hot-linked to cloud storage)
- Styling broken (relative CSS links)

Prevention:
- Embed all assets in PDF (not just references)
- Pre-render math equations to SVG/images, not lazy-load
- Base64 encode images into PDF
- Test offline viewing before release

---

## Minor Pitfalls

Friction and annoyance, but not critical.

### Pitfall 10: Export Defaults to Wrong Format

**What goes wrong:**
Teacher clicks "Export," gets Excel. Wanted PDF. Excel has no math rendering, all equations look like "$\\int_0^1 x^2 dx$" (unrendered).

### Pitfall 11: Rubric Scores Don't Match Total Points

**What goes wrong:**
Question has 10 points max.
Rubric has 4 levels: 0, 4, 7, 9 points (intentional partial credit).
UI shows both "10 points" and "0, 4, 7, 9 possible" → confusing.

### Pitfall 12: No Feedback Preview Before Sending

**What goes wrong:**
Teacher uses AI to generate feedback to 200 students.
Feedback contains: "[STUDENT_NAME] you got question [QUESTION_NUM] wrong."
All students see: "[STUDENT_NAME] you got question undefined wrong."

Template variables not replaced, students see broken feedback.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Exam Builder MVP | Complex UX with too many fields | Start with 3-field simple mode, defer advanced options |
| Math Rendering | Choose wrong renderer early | Test KaTeX end-to-end (editor → web → PDF) before launch |
| AI Grading Integration | Hallucinations accepted as correct | Require teacher review, confidence threshold gate, rubric-based only |
| Export Feature | Synchronous processing | Design async from start, use queue, not direct request handling |
| Scaling to 1000+ submissions | Rate limit wall | Implement queue and retry from day one, not as afterthought |
| Rubric Configuration | Vague scoring criteria | Create rubric template library, enforce objective language |
| Multi-teacher Exam | Grade override conflicts | Audit trail required, single source of truth for final grade |

---

## Sources

- [MIT Sloan: AI-Assisted Grading](https://mitsloanedtech.mit.edu/2024/05/09/ai-assisted-grading-a-magic-wand-or-a-pandoras-box/)
- [British Educational Research Journal: ChatGPT Grading](https://bera-journals.onlinelibrary.wiley.com/doi/10.1002/berj.4069)
- [Springer: LLM-Powered Automated Assessment](https://link.springer.com/article/10.1007/s44163-025-00517-0)
- [ArXiv: LLM Hallucinations Survey](https://arxiv.org/abs/2510.06265)
- [OpenAI Rate Limits Guide](https://platform.openai.com/docs/guides/rate-limits)
- [OpenAI Cookbook: Handling Rate Limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits)
- [Pressbooks: LaTeX Rendering Consistency](https://opentextbc.ca/pressbooks/chapter/why-wont-my-latex-render-properly-in-the-pdf-export-of-my-book-when-it-works-fine-in-the-web-book/)
- [OSU Distance Education: AI in Auto-Grading](https://ascode.osu.edu/news/ai-and-auto-grading-higher-education-capabilities-ethics-and-evolving-role-educators)
- [Miriam Bogler: AI Assessment Mistakes](https://miriambogler.substack.com/p/7-ai-assessment-mistakes-undermining)

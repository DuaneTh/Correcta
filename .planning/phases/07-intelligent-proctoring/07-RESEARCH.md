# Phase 7: Intelligent Proctoring - Research

**Researched:** 2026-02-02
**Domain:** Browser-based exam proctoring with AI vision analysis
**Confidence:** HIGH

## Summary

Intelligent proctoring for online exams requires three core capabilities: webcam monitoring with AI analysis, browser lockdown event detection, and comprehensive activity logging. The 2026 landscape shows a mature ecosystem with established patterns for lightweight client-side monitoring combined with asynchronous server-side AI analysis.

The standard approach uses react-webcam (v7.2.0) for periodic snapshot capture (20-30 second intervals), OpenAI GPT-4o Vision API for analyzing frames (detecting multiple faces, absence, looking away), and native browser APIs (Page Visibility, Clipboard, Fullscreen) for lockdown monitoring. All events flow to a centralized logging system with BullMQ queues processing AI analysis asynchronously to avoid blocking the exam experience.

Key architectural insight: Decouple real-time monitoring (lightweight, instant) from AI analysis (intensive, asynchronous). This prevents performance degradation during exams while maintaining comprehensive security. The two-phase architecture (instant capture + retrospective analysis) balances security, cost, and user experience.

**Primary recommendation:** Use react-webcam for snapshot capture every 20-30 seconds, queue frames for GPT-4o Vision analysis via BullMQ (existing pattern), detect browser events with native APIs, and store all findings as ProctorEvent records with GDPR-compliant retention.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-webcam | 7.2.0 | Webcam access and screenshot capture | Most popular React webcam library (307k weekly downloads), simple API, TypeScript support, wraps MediaDevices API cleanly |
| OpenAI GPT-4o | API 2026 | Vision analysis of webcam frames | State-of-the-art multimodal model, 85 tokens per low-detail image ($0.0002125 per frame), detects faces/absence/behavior |
| Page Visibility API | Native | Tab switch and focus detection | Browser standard (W3C), reliable visibilitychange events, widely supported |
| Clipboard API | Native | Copy/paste event interception | Standard browser API, supports preventDefault(), secure contexts only |
| BullMQ | Existing | Background job processing for AI analysis | Already in project for grading, Redis-based, rate limiting support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Fullscreen API | Native | Fullscreen exit detection | Standard browser API for lockdown enforcement |
| GPT-4o-mini | API 2026 | Cheaper vision analysis | Cost optimization if GPT-4o too expensive ($0.0000128 per low-detail image, 16x cheaper) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-webcam | Native MediaDevices API | More control but more boilerplate, same underlying API |
| react-webcam | react-camera-pro | Mobile-focused, similar capabilities but less mature |
| GPT-4o Vision | Custom CV model | Lower cost but requires ML expertise, training data, hosting |
| Async processing | Real-time analysis | Lower latency but blocks UI, expensive, poor UX |

**Installation:**
```bash
npm install react-webcam
# BullMQ, OpenAI client already installed
# Browser APIs are native
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── exam/[examId]/take/
│   └── proctoring-context.tsx     # Client-side monitoring orchestrator
components/
├── proctoring/
│   ├── webcam-monitor.tsx         # Webcam snapshot component
│   ├── lockdown-monitor.tsx       # Browser event listeners
│   └── proctoring-status.tsx      # Visual indicator for students
lib/
├── proctoring/
│   ├── event-logger.ts            # Send events to API
│   ├── vision-analyzer.ts         # GPT-4o Vision prompts
│   └── snapshot-uploader.ts       # Base64 → MinIO via presigned URL
api/
├── proctor/
│   ├── event/route.ts             # Log ProctorEvent to DB
│   ├── snapshot/route.ts          # Generate presigned URL, queue analysis
│   └── config/route.ts            # Fetch exam proctoring settings
scripts/
└── proctoring-worker.ts           # BullMQ worker for GPT-4o analysis
app/teacher/exams/[examId]/
└── proctoring/
    ├── page.tsx                   # Review dashboard
    └── components/
        ├── event-timeline.tsx     # Chronological event list
        └── snapshot-gallery.tsx   # Flagged snapshots
```

### Pattern 1: Two-Phase Monitoring Architecture
**What:** Separate lightweight real-time monitoring from intensive AI analysis.

**When to use:** Always for proctoring systems - prevents exam disruption from slow AI calls.

**Example:**
```typescript
// Phase 1: Client captures and logs instantly
const captureSnapshot = async () => {
  const imageSrc = webcamRef.current?.getScreenshot() // Instant, base64

  // 1. Send to API immediately (non-blocking)
  await fetch('/api/proctor/snapshot', {
    method: 'POST',
    body: JSON.stringify({ attemptId, imageSrc, timestamp: Date.now() })
  })

  // 2. API route generates presigned URL, uploads to MinIO, queues BullMQ job
  // Student continues exam without waiting
}

// Phase 2: Worker analyzes asynchronously (30s-2min later)
const worker = new Worker('proctoring-analysis', async (job: Job) => {
  const { snapshotUrl, attemptId } = job.data

  // Call GPT-4o Vision (slow, expensive)
  const analysis = await analyzeWithGPT4o(snapshotUrl)

  // Store flags as ProctorEvents
  if (analysis.multipleFaces) {
    await prisma.proctorEvent.create({
      data: {
        attemptId,
        type: 'MULTIPLE_FACES',
        metadata: { confidence: analysis.confidence, snapshotUrl }
      }
    })
  }
})
```

**Why this pattern:**
- Real-time monitoring stays responsive (< 100ms to capture and send)
- AI analysis happens in background without blocking student
- Failed AI calls don't crash exam
- Can retry AI analysis with BullMQ
- Teacher reviews happen post-exam anyway

### Pattern 2: Event Stream Logging
**What:** All browser and webcam events logged to single ProctorEvent table with type discrimination.

**When to use:** For comprehensive audit trail and flexible querying.

**Example:**
```typescript
// Source: Existing Prisma schema + research patterns
enum ProctorEventType {
  // Browser lockdown
  FOCUS_LOST, FOCUS_GAINED, TAB_SWITCH, FULLSCREEN_EXIT,
  COPY, PASTE,

  // AI vision (from background worker)
  MULTIPLE_FACES, ABSENCE, NOISE_DETECTED
}

// Client-side listener
document.addEventListener('visibilitychange', () => {
  const eventType = document.hidden ? 'FOCUS_LOST' : 'FOCUS_GAINED'
  logProctorEvent(attemptId, eventType, { timestamp: Date.now() })
})

// Server stores all in one table
await prisma.proctorEvent.create({
  data: {
    attemptId,
    type: eventType,
    timestamp: new Date(),
    metadata: { ...eventDetails }
  }
})
```

### Pattern 3: Cost-Optimized Vision Analysis
**What:** Use low-detail mode for snapshots, batch rate limiting, skip redundant frames.

**When to use:** Always - GPT-4o Vision costs add up quickly at scale.

**Example:**
```typescript
// Low-detail mode: 85 tokens vs up to 1,100 tokens
// Cost: $0.0002125 per frame vs $0.00275 for high-detail
const prompt = `Analyze this exam proctoring snapshot. Detect:
1. Number of faces (should be exactly 1)
2. Student presence (face visible vs absent)
3. Gaze direction (looking at screen vs away)
Return JSON with: { multipleFaces: boolean, absent: boolean, lookingAway: boolean, confidence: 0-1 }`

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: {
        url: snapshotUrl,
        detail: 'low' // KEY: 85 tokens instead of ~765-1,105
      }}
    ]
  }]
})

// BullMQ rate limiting (built-in)
const queue = new Queue('proctoring-analysis', {
  connection,
  limiter: {
    max: 10, // 10 jobs per minute
    duration: 60000 // Spread OpenAI API load
  }
})
```

**Cost math (60-minute exam, 20-second intervals):**
- 180 snapshots per exam
- Low-detail: 180 × $0.0002125 = $0.038 per exam
- High-detail: 180 × $0.00275 = $0.495 per exam
- **Savings: 93% cost reduction**

### Pattern 4: Presigned URL Upload for Snapshots
**What:** Generate MinIO presigned PUT URLs server-side, client uploads base64 image directly.

**When to use:** For large files (images, video) - avoids proxying through Next.js server.

**Example:**
```typescript
// Source: MinIO documentation + Next.js patterns
// API route: /api/proctor/snapshot/presigned
export async function POST(req: Request) {
  const { attemptId, fileName } = await req.json()

  // Generate presigned PUT URL (60 second expiry)
  const presignedUrl = await minioClient.presignedPutObject(
    'proctoring-snapshots',
    `${attemptId}/${fileName}`,
    60
  )

  return Response.json({ presignedUrl, objectUrl: `.../${fileName}` })
}

// Client: Upload base64 as blob
const base64 = webcamRef.current?.getScreenshot()
const blob = base64ToBlob(base64)

// 1. Request presigned URL
const { presignedUrl, objectUrl } = await fetch('/api/proctor/snapshot/presigned', {
  method: 'POST',
  body: JSON.stringify({ attemptId, fileName: `${Date.now()}.jpg` })
}).then(r => r.json())

// 2. Upload directly to MinIO
await fetch(presignedUrl, {
  method: 'PUT',
  body: blob,
  headers: { 'Content-Type': 'image/jpeg' }
})

// 3. Queue analysis job with objectUrl
await fetch('/api/proctor/snapshot/analyze', {
  method: 'POST',
  body: JSON.stringify({ attemptId, snapshotUrl: objectUrl })
})
```

### Anti-Patterns to Avoid
- **Real-time AI analysis:** Blocks UI, expensive, crashes on API errors, poor student experience
- **Continuous video recording:** GDPR nightmare, massive storage cost, bandwidth intensive
- **DevTools detection as primary lockdown:** Too many false positives (sidebar toggles, undocked DevTools miss), use as soft signal only
- **High-detail vision mode by default:** 13x more tokens for minimal proctoring benefit
- **Synchronous snapshot upload:** Next.js API route proxying wastes memory and time
- **No rate limiting on AI calls:** Blows through OpenAI budget, risks rate limit errors

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webcam access | Custom getUserMedia wrapper | react-webcam | Handles permissions, errors, device switching, ref patterns, TypeScript types |
| Background job processing | Custom Redis queue | BullMQ | Retries, rate limiting, monitoring, already in project for grading |
| Vision analysis | Custom CV model | OpenAI GPT-4o Vision | State-of-the-art accuracy, no training data, no GPU hosting, flexible prompts |
| Tab switch detection | Custom focus tracking | Page Visibility API | Browser standard, handles edge cases (notifications, dialogs, mobile), reliable |
| Copy/paste detection | Custom clipboard monitoring | Clipboard API events | Secure, standard, preventDefault() support, permissions handled |
| Fullscreen detection | Custom window size checks | Fullscreen API | Reliable fullscreenchange events, no false positives |
| Image storage | Custom base64 in DB | MinIO presigned URLs | Scalable, CDN-ready, no DB bloat, existing project setup |

**Key insight:** Browser proctoring has mature APIs (Page Visibility, Clipboard, Fullscreen) that handle edge cases you'll miss. AI vision has been commoditized by GPT-4o Vision - building custom CV is massive effort for inferior results. Focus on orchestration, not low-level primitives.

## Common Pitfalls

### Pitfall 1: Mobile Browser Inconsistency with Page Visibility
**What goes wrong:** Firefox reliably fires visibilitychange on mobile, but Chrome/Safari miss events when entering App Switcher, firing only after next user action (or not at all).

**Why it happens:** Mobile browsers optimize battery by deferring events, and app switching has inconsistent lifecycle triggers across browsers.

**How to avoid:**
1. Use Page Visibility API but combine with pagehide event for broader coverage
2. Test on actual mobile devices (iOS Safari, Android Chrome) not just desktop DevTools
3. Document that mobile proctoring is less reliable than desktop
4. Consider requiring desktop browsers for high-stakes exams

**Warning signs:** Students reporting missed tab switches, inconsistent FOCUS_LOST events on mobile in logs.

### Pitfall 2: DevTools Detection False Positives
**What goes wrong:** Libraries like devtools-detect trigger on any sidebar toggle (browser bookmarks, extensions) or miss detection entirely if DevTools is undocked.

**Why it happens:** Detection relies on heuristics (window resize timing, console.log performance) that aren't specific to DevTools.

**How to avoid:**
1. Use DevTools detection only as LOW-confidence soft signal
2. Don't block exams or show warnings based on DevTools detection alone
3. Combine with other signals (multiple tab switches + DevTools open = higher suspicion)
4. Document limitations in teacher dashboard

**Warning signs:** Student complaints about false "DevTools detected" warnings, inconsistent detection in testing.

### Pitfall 3: Vision API Cost Explosion
**What goes wrong:** Using high-detail mode or analyzing every frame in real-time can cost $0.50-$1.00 per exam, making proctoring prohibitively expensive at scale.

**Why it happens:** Default image detail is often 'auto' which uses high-detail for larger images. 20-second intervals over 60 minutes = 180 frames.

**How to avoid:**
1. Always explicitly set `detail: 'low'` for webcam snapshots (85 tokens vs 1,105)
2. Use 20-30 second intervals, not faster
3. Implement smart skipping: If last 3 frames were OK, extend interval to 45-60 seconds
4. Rate limit BullMQ worker to spread API load
5. Monitor OpenAI usage dashboard, set budget alerts

**Warning signs:** OpenAI bill spikes, rate limit errors in logs, slow analysis queue processing.

### Pitfall 4: GDPR Compliance Violations
**What goes wrong:** Storing webcam images indefinitely, not getting explicit consent, not providing data deletion, transferring images outside EU without safeguards.

**Why it happens:** Proctoring captures "sensitive personal data" (biometric - faces), GDPR requires heightened protection, and developers often don't implement retention policies.

**How to avoid:**
1. Get explicit consent before webcam access with clear explanation
2. Store snapshots in EU region (MinIO bucket configuration)
3. Implement automatic deletion after exam review period (e.g., 90 days)
4. Provide student data export and deletion requests in UI
5. Document in privacy policy: what's captured, why, how long, who sees it
6. Use end-to-end encryption for image storage (MinIO supports this)
7. Conduct Data Protection Impact Assessment (DPIA) before launch

**Warning signs:** GDPR complaints, no retention policy in place, images stored indefinitely, no consent flow.

### Pitfall 5: Webcam Permission Denial Blocking Exam
**What goes wrong:** Student denies webcam permission (accidentally or intentionally), exam crashes or becomes unsubmittable.

**Why it happens:** Not handling getUserMedia() NotAllowedError, no fallback UI, exam code assumes webcam is always available.

**How to avoid:**
1. Check exam's proctoring config before requiring webcam
2. Handle permission denial gracefully with clear error message and retry button
3. For exams with optional proctoring, allow proceeding without webcam (log event)
4. For required proctoring, show instructions for enabling webcam permissions
5. Log PERMISSION_DENIED ProctorEvent for teacher visibility
6. Test on browsers with permissions blocked

**Warning signs:** Students can't submit exams, support requests about webcam errors, no error handling code.

### Pitfall 6: Snapshot Timing Drift
**What goes wrong:** setInterval() for snapshots drifts over time due to event loop delays, causing irregular intervals or missed snapshots during heavy computation.

**Why it happens:** setInterval doesn't account for callback execution time, garbage collection, or CPU load. Can drift seconds over 60-minute exam.

**How to avoid:**
1. Use recursive setTimeout with timestamp correction instead of setInterval
2. Calculate next snapshot time based on wall clock, not elapsed intervals
3. Log actual snapshot timestamps to verify intervals
4. Skip snapshot if previous upload is still in progress (don't queue up)

**Example:**
```typescript
// BAD: setInterval drifts
setInterval(captureSnapshot, 20000) // Will drift

// GOOD: Self-correcting recursive setTimeout
let nextSnapshotTime = Date.now() + 20000
const scheduleSnapshot = () => {
  const now = Date.now()
  const delay = Math.max(0, nextSnapshotTime - now)

  setTimeout(async () => {
    await captureSnapshot()
    nextSnapshotTime += 20000 // Wall clock, not relative
    scheduleSnapshot()
  }, delay)
}
```

**Warning signs:** Irregular snapshot timing in logs, missed snapshots during long questions, intervals stretching to 30-40 seconds.

## Code Examples

Verified patterns from official sources:

### react-webcam Screenshot Capture
```typescript
// Source: react-webcam npm documentation, MDN MediaDevices API
import { useRef, useState, useCallback } from 'react'
import Webcam from 'react-webcam'

const WebcamMonitor = ({ attemptId }: { attemptId: string }) => {
  const webcamRef = useRef<Webcam>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const videoConstraints: MediaStreamConstraints['video'] = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user'
  }

  const captureSnapshot = useCallback(async () => {
    const imageSrc = webcamRef.current?.getScreenshot()
    if (!imageSrc) return

    // imageSrc is base64 data URL: "data:image/jpeg;base64,..."
    await fetch('/api/proctor/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId, imageSrc, timestamp: Date.now() })
    })
  }, [attemptId])

  const handleUserMediaError = (error: string | DOMException) => {
    console.error('Webcam error:', error)
    if (error.toString().includes('NotAllowedError')) {
      setPermissionDenied(true)
    }
  }

  return (
    <div>
      <Webcam
        ref={webcamRef}
        audio={false}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        onUserMediaError={handleUserMediaError}
      />
      {permissionDenied && (
        <div>Please enable webcam permissions to continue</div>
      )}
    </div>
  )
}
```

### Page Visibility API Event Logging
```typescript
// Source: MDN Page Visibility API documentation
useEffect(() => {
  const handleVisibilityChange = () => {
    const eventType = document.hidden ? 'FOCUS_LOST' : 'FOCUS_GAINED'

    fetch('/api/proctor/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        type: eventType,
        timestamp: Date.now(),
        metadata: { visibilityState: document.visibilityState }
      })
    })
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Fallback for cases visibilitychange misses (especially mobile Safari)
  window.addEventListener('pagehide', () => {
    navigator.sendBeacon('/api/proctor/event', JSON.stringify({
      attemptId,
      type: 'FOCUS_LOST',
      timestamp: Date.now(),
      metadata: { source: 'pagehide' }
    }))
  })

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [attemptId])
```

### Clipboard Event Detection
```typescript
// Source: MDN Clipboard API documentation
useEffect(() => {
  const handleCopy = (e: ClipboardEvent) => {
    const selection = window.getSelection()?.toString() || ''

    fetch('/api/proctor/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        type: 'COPY',
        timestamp: Date.now(),
        metadata: { selectionLength: selection.length }
      })
    })

    // Optionally prevent copy for high-security exams
    // e.preventDefault()
  }

  const handlePaste = async (e: ClipboardEvent) => {
    const pastedText = e.clipboardData?.getData('text') || ''

    fetch('/api/proctor/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId,
        type: 'PASTE',
        timestamp: Date.now(),
        metadata: { pasteLength: pastedText.length }
      })
    })

    // Optionally prevent paste
    // e.preventDefault()
  }

  document.addEventListener('copy', handleCopy)
  document.addEventListener('paste', handlePaste)

  return () => {
    document.removeEventListener('copy', handleCopy)
    document.removeEventListener('paste', handlePaste)
  }
}, [attemptId])
```

### Fullscreen Exit Detection
```typescript
// Source: MDN Fullscreen API documentation
useEffect(() => {
  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      // User exited fullscreen
      fetch('/api/proctor/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          type: 'FULLSCREEN_EXIT',
          timestamp: Date.now(),
          metadata: { }
        })
      })
    }
  }

  document.addEventListener('fullscreenchange', handleFullscreenChange)

  return () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }
}, [attemptId])

// Request fullscreen on exam start
const enterFullscreen = () => {
  document.documentElement.requestFullscreen().catch(err => {
    console.error('Fullscreen request failed:', err)
  })
}
```

### BullMQ Proctoring Worker
```typescript
// Source: Existing ai-grading-worker.ts + BullMQ documentation
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null
})

const worker = new Worker('proctoring-analysis', async (job: Job) => {
  const { attemptId, snapshotUrl, timestamp } = job.data

  console.log(`[Proctoring Worker] Analyzing snapshot for attempt ${attemptId}`)

  // Call GPT-4o Vision
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this exam proctoring snapshot. Detect:
1. Number of faces (should be exactly 1)
2. Student presence (face visible vs absent)
3. Gaze direction (looking at screen vs away)

Return JSON only: { "multipleFaces": boolean, "absent": boolean, "lookingAway": boolean, "confidence": number }`
        },
        {
          type: 'image_url',
          image_url: {
            url: snapshotUrl,
            detail: 'low' // 85 tokens
          }
        }
      ]
    }],
    max_tokens: 100
  })

  const analysis = JSON.parse(response.choices[0].message.content || '{}')

  // Create ProctorEvents for detected issues
  if (analysis.multipleFaces) {
    await prisma.proctorEvent.create({
      data: {
        attemptId,
        type: 'MULTIPLE_FACES',
        timestamp: new Date(timestamp),
        metadata: {
          confidence: analysis.confidence,
          snapshotUrl,
          aiModel: 'gpt-4o'
        }
      }
    })
  }

  if (analysis.absent) {
    await prisma.proctorEvent.create({
      data: {
        attemptId,
        type: 'ABSENCE',
        timestamp: new Date(timestamp),
        metadata: {
          confidence: analysis.confidence,
          snapshotUrl,
          aiModel: 'gpt-4o'
        }
      }
    })
  }

  console.log(`[Proctoring Worker] Analysis complete for ${attemptId}`)
}, {
  connection,
  concurrency: 3, // Process 3 snapshots in parallel
  limiter: {
    max: 10, // 10 jobs per minute (rate limiting for OpenAI)
    duration: 60000
  }
})

worker.on('failed', (job, err) => {
  console.error(`[Proctoring Worker] Job ${job?.id} failed:`, err)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.close()
  await connection.quit()
})
```

### GPT-4o Vision Analysis Helper
```typescript
// Source: OpenAI documentation + proctoring best practices
import OpenAI from 'openai'

interface ProctoringAnalysis {
  multipleFaces: boolean
  absent: boolean
  lookingAway: boolean
  confidence: number
}

export async function analyzeProctorSnapshot(
  imageUrl: string
): Promise<ProctoringAnalysis> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `You are an exam proctoring AI. Analyze this webcam snapshot and detect:

1. MULTIPLE_FACES: Are there 2+ people visible? (Should be exactly 1)
2. ABSENCE: Is the student's face NOT visible? (Empty chair, turned away, out of frame)
3. LOOKING_AWAY: Is the student looking significantly away from the screen? (Not just brief glances)

Rules:
- Brief glances or thinking poses are OK, don't flag unless sustained (>3 seconds implied)
- Partial occlusion (hand on face, drinking) is OK
- Only flag clear violations

Return JSON only, no explanation:
{
  "multipleFaces": boolean,
  "absent": boolean,
  "lookingAway": boolean,
  "confidence": 0.0-1.0
}`
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail: 'low' // Cost: 85 tokens = $0.0002125
          }
        }
      ]
    }],
    max_tokens: 100,
    temperature: 0.1 // Low temperature for consistent detection
  })

  const content = response.choices[0].message.content || '{}'
  const analysis = JSON.parse(content)

  return {
    multipleFaces: analysis.multipleFaces || false,
    absent: analysis.absent || false,
    lookingAway: analysis.lookingAway || false,
    confidence: analysis.confidence || 0.5
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Continuous screen recording | Periodic snapshots (20-30s intervals) | 2023-2024 | 95% storage reduction, better privacy, same detection rate |
| Custom CV models (OpenCV, TensorFlow) | GPT-4o Vision API | 2024 | No training data needed, better accuracy, simpler code, cost $0.04/exam |
| Synchronous image analysis | Async BullMQ queue processing | Always best practice | Non-blocking UI, retries, rate limiting, scalability |
| High-detail vision mode | Low-detail mode (85 tokens) | 2025-2026 | 93% cost reduction, sufficient for face detection |
| Browser extension lockdown | Native browser APIs | 2022-2023 | No installation, cross-browser, mobile compatible |

**Deprecated/outdated:**
- **Proctorio/ProctorU browser extensions:** Privacy concerns, installation friction, Chrome Web Store restrictions tightening. Modern approach: web-only using native APIs.
- **Real-time video streaming to server:** Bandwidth intensive, expensive, privacy invasive. Current: periodic snapshots.
- **Custom face detection libraries (tracking.js, clmtrackr):** Poor accuracy, unmaintained. Current: GPT-4o Vision.
- **WebRTC for screen sharing detection:** Complex, unreliable. Current: Page Visibility + focus events.

## Open Questions

Things that couldn't be fully resolved:

1. **Mobile Safari WebRTC Stability**
   - What we know: getUserMedia works on iOS Safari 14+, but permission prompts differ, background behavior unpredictable
   - What's unclear: How reliably snapshots capture when exam tab backgrounded on iOS
   - Recommendation: Test on real iOS devices, consider warning students that desktop is preferred for proctored exams

2. **GPT-4o Vision Consistency**
   - What we know: temperature=0.1 improves consistency, low-detail mode sufficient for faces
   - What's unclear: False positive rate for "looking away" detection in production (no published benchmarks)
   - Recommendation: Start with conservative prompts ("sustained looking away"), collect teacher feedback, tune prompts iteratively

3. **GDPR Data Retention Requirements**
   - What we know: Biometric data requires heightened protection, must document retention periods
   - What's unclear: Exact retention duration for educational proctoring (varies by institution, country)
   - Recommendation: Default 90 days post-exam, make configurable, consult legal counsel for specific jurisdiction

4. **DevTools Detection Reliability**
   - What we know: Libraries have high false positive rates, undocked DevTools often undetected
   - What's unclear: Whether any reliable detection method exists in 2026 without browser extensions
   - Recommendation: Use as LOW-confidence signal only, don't base enforcement on it, document limitations

5. **Snapshot Interval Optimization**
   - What we know: Industry uses 20-30 seconds, HackerEarth uses 20-30s random intervals
   - What's unclear: Optimal balance between detection rate and cost for this specific user base
   - Recommendation: Start with 25 seconds (144 snapshots/hour = $0.03/exam), monitor effectiveness, adjust based on data

## Sources

### Primary (HIGH confidence)
- [react-webcam npm package](https://www.npmjs.com/package/react-webcam) - API documentation, version 7.2.0
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) - Browser API documentation
- [MDN Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) - Copy/paste event handling
- [MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) - Fullscreen detection
- [MDN MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - Webcam constraints
- [OpenAI API Pricing](https://platform.openai.com/docs/pricing) - GPT-4o Vision token costs
- [BullMQ Documentation](https://docs.bullmq.io) - Queue and worker patterns
- Existing codebase: `scripts/ai-grading-worker.ts`, `lib/antiCheat.ts`, `prisma/schema.prisma`

### Secondary (MEDIUM confidence)
- [HackerRank Proctoring Guide](https://www.hackerrank.com/writing/tab-proctoring-what-it-catches-and-what-it-misses) - Tab proctoring patterns (verified with MDN)
- [Codility Proctoring Documentation](https://support.codility.com/hc/en-us/articles/15584109019671-Proctoring-Ensuring-Assessment-Integrity-with-Behavioral-Events-Detection) - Event detection strategies
- [GPT-4o Vision Guide (GetStream)](https://getstream.io/blog/gpt-4o-vision-guide/) - Vision API implementation patterns
- [Building File Storage with Next.js and MinIO (Medium)](https://medium.com/@alexefimenko/building-s3-file-storage-with-next-js-4-upload-and-download-files-using-presigned-urls-a83207f48227) - Presigned URL patterns (verified with MinIO docs)
- [GDPR & Remote Proctoring (Proctor360)](https://proctor360.com/blog/gdpr-compliance-remote-proctoring-essentials) - Compliance requirements
- [OpenAI GPT-4o Pricing Guide (LaoZhang-AI)](https://blog.laozhang.ai/ai/openai-gpt-4o-api-pricing-guide/) - Cost optimization strategies

### Tertiary (LOW confidence - requires validation)
- [devtools-detect library](https://github.com/sindresorhus/devtools-detect) - DevTools detection (noted limitations: false positives)
- [Think Exam Proctoring Blog](https://thinkexam.com/blog/top-exam-proctoring-software-with-webcam-2026-how-ai-driven-webcam-monitoring-prevents-cheating/) - Snapshot interval practices (single source, not verified)
- [Exam Proctoring System Using Machine Learning (IEEE)](https://ieeexplore.ieee.org/document/11026486/) - Two-phase architecture concept (academic paper, not production-verified)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-webcam verified via npm, OpenAI pricing from official docs, Browser APIs from MDN, BullMQ pattern exists in codebase
- Architecture: HIGH - Two-phase pattern industry standard (verified multiple sources), existing BullMQ worker pattern in project, Prisma schema already supports structure
- Pitfalls: MEDIUM-HIGH - Page Visibility mobile issues documented on MDN, DevTools detection issues verified in library docs, GDPR requirements from compliance guides, cost math verified with OpenAI pricing
- Code examples: HIGH - All examples based on official documentation (react-webcam, MDN APIs, BullMQ docs, OpenAI API), adapted to existing project patterns

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - stable domain with mature APIs, OpenAI pricing may change)

**Key Research Focus:**
This is a RE-RESEARCH focused on current best practices. Special attention paid to:
- Latest react-webcam API (verified version 7.2.0, last updated 2024 but stable)
- GPT-4o Vision 2026 capabilities and pricing (low-detail mode optimization critical)
- Browser API compatibility in 2026 (Page Visibility mobile issues documented)
- Cost optimization strategies (93% savings using low-detail mode)
- GDPR compliance requirements for biometric data (heightened in 2025-2026)

**Notable Changes Since Original Research:**
- GPT-4o Vision detail modes now well-documented (low-detail = 85 tokens standard)
- Increased GDPR enforcement (€6.7B in fines since 2018, stricter in 2025-2026)
- Mobile Page Visibility API issues better documented (Firefox most reliable)
- DevTools detection libraries acknowledged as unreliable (use sparingly)
- Industry consensus on 20-30 second snapshot intervals (cost-effectiveness balance)

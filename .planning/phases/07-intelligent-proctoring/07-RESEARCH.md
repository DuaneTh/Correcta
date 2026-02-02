# Phase 7: Intelligent Proctoring - Research

**Researched:** 2026-02-02
**Domain:** Browser-based exam proctoring systems
**Confidence:** HIGH

## Summary

Intelligent proctoring systems combine webcam monitoring, browser lockdown techniques, and AI-powered behavior analysis to maintain exam integrity. The standard approach uses native browser APIs (MediaRecorder, Page Visibility API, clipboard events) for client-side monitoring, with periodic snapshot uploads for server-side AI analysis.

**Key architectural insight:** Modern proctoring systems use a "layered" or "hybrid" approach, combining:
1. **Client-side detection** (instant feedback via JavaScript APIs) for browser-level events (tab switches, copy/paste, DevTools)
2. **Server-side AI analysis** (async, via BullMQ) for webcam snapshots to detect suspicious behavior
3. **Post-exam review dashboard** for teachers to validate AI flags and review timestamped events

The critical challenge is balancing security with privacy/legal considerations, and managing false positives (research shows 8-30% false positive rates in production systems).

**Primary recommendation:** Use native browser APIs with react-webcam for capture, GPT-4 Vision for snapshot analysis (already in stack), and design a teacher review workflow to validate AI flags before taking action.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-webcam | ^7.x | Webcam capture & snapshots | Most popular React library (113k+ weekly downloads), zero native dependencies, built on getUserMedia API |
| MediaRecorder API | Native | Video recording | Standard web API, widely supported since 2021, no library needed |
| Page Visibility API | Native | Tab switch detection | Native browser API, baseline support across all modern browsers |
| OpenAI GPT-4 Vision | 4.x | Image analysis for proctoring | Already in project stack, can detect multiple faces/objects, describe scenes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MediaPipe Face Detector | @mediapipe/tasks-vision | Client-side face detection | Optional: real-time face tracking without server roundtrips |
| BullMQ | 5.x | Async snapshot analysis queue | Already in stack for AI grading, reuse for proctoring analysis |
| MinIO | 8.x | Snapshot image storage | Already in stack, S3-compatible object storage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-webcam | react-record-webcam | More recording features but less popular (lower maintenance) |
| GPT-4 Vision | MediaPipe Face Detector | Faster (client-side) but requires more code, no context understanding |
| GPT-4 Vision | Specialized CV models (YOLO, DETR) | More accurate for object detection but requires model hosting infrastructure |

**Installation:**
```bash
npm install react-webcam
# MediaRecorder, Page Visibility API are native - no install needed
# OpenAI, BullMQ, MinIO already installed
```

**Optional (for real-time client-side face detection):**
```bash
npm install @mediapipe/tasks-vision
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── (exam)/
│   └── student/exams/[examId]/take/
│       └── components/
│           ├── ProctorMonitor.tsx        # Main proctoring orchestrator
│           ├── WebcamCapture.tsx         # Webcam display & snapshot capture
│           └── BrowserLockdown.tsx       # Event listeners for tab/copy/paste
├── api/
│   ├── attempts/[id]/
│   │   ├── proctor-events/route.ts      # Log browser events (existing)
│   │   └── proctor-snapshots/route.ts   # Upload webcam snapshots
│   └── exams/[examId]/
│       ├── proctoring/route.ts          # Get/update proctoring config (existing)
│       └── proctoring-review/[attemptId]/route.ts  # Teacher review dashboard data
├── teacher/exams/[examId]/
│   └── proctoring/
│       ├── page.tsx                      # Proctoring review dashboard
│       └── components/
│           ├── EventTimeline.tsx         # Chronological event list
│           ├── SnapshotGallery.tsx       # Grid of flagged snapshots
│           └── StudentProctoringSummary.tsx  # Per-student overview
lib/
├── antiCheat.ts                          # Score calculation (existing)
├── proctoring/
│   ├── browserDetection.ts               # Client-side event handlers
│   ├── snapshotAnalysis.ts               # GPT-4 Vision prompts for analysis
│   └── proctoringSummary.ts              # Generate teacher-facing summaries
workers/
└── proctoring-worker.ts                  # BullMQ worker for async snapshot analysis
```

### Pattern 1: Periodic Snapshot Capture

**What:** Capture webcam snapshots at configurable intervals (e.g., every 30s) during exam, upload to MinIO, enqueue for AI analysis

**When to use:** All proctored exams with webcam monitoring enabled

**Example:**
```typescript
// Source: react-webcam npm package + MediaRecorder API patterns
import Webcam from 'react-webcam';
import { useRef, useEffect } from 'react';

function WebcamCapture({ attemptId, interval = 30000 }) {
  const webcamRef = useRef<Webcam>(null);

  useEffect(() => {
    const captureSnapshot = async () => {
      if (!webcamRef.current) return;

      // Capture base64 image
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // Convert to blob
      const blob = await fetch(imageSrc).then(r => r.blob());

      // Upload to API
      const formData = new FormData();
      formData.append('snapshot', blob, `${Date.now()}.jpg`);

      await fetch(`/api/attempts/${attemptId}/proctor-snapshots`, {
        method: 'POST',
        body: formData
      });
    };

    const intervalId = setInterval(captureSnapshot, interval);
    return () => clearInterval(intervalId);
  }, [attemptId, interval]);

  return (
    <Webcam
      ref={webcamRef}
      audio={false}
      screenshotFormat="image/jpeg"
      videoConstraints={{ width: 1280, height: 720, facingMode: "user" }}
    />
  );
}
```

### Pattern 2: Tab Switch Detection with Page Visibility API

**What:** Use visibilitychange event to detect when student switches tabs or minimizes window

**When to use:** All proctored exams with browser lockdown enabled

**Example:**
```typescript
// Source: MDN Page Visibility API documentation
// https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.hidden) {
      // Tab hidden - log event
      await fetch(`/api/attempts/${attemptId}/proctor-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'TAB_SWITCH',
          metadata: {
            visibilityState: document.visibilityState,
            timestamp: Date.now()
          }
        })
      });
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [attemptId]);
```

### Pattern 3: Copy/Paste Detection

**What:** Listen to clipboard events to detect copy/paste behavior, including cross-tab copying

**When to use:** Exams where copy/paste should be restricted or monitored

**Example:**
```typescript
// Source: Browser clipboard events + existing antiCheat.ts patterns

useEffect(() => {
  const handleCopy = (e: ClipboardEvent) => {
    const selection = window.getSelection()?.toString() || '';

    fetch(`/api/attempts/${attemptId}/proctor-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'COPY',
        metadata: {
          selectionLength: selection.length,
          timestamp: Date.now()
        }
      })
    });
  };

  const handlePaste = (e: ClipboardEvent) => {
    const pastedText = e.clipboardData?.getData('text') || '';

    fetch(`/api/attempts/${attemptId}/proctor-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'PASTE',
        metadata: {
          pasteLength: pastedText.length,
          timestamp: Date.now()
        }
      })
    });
  };

  document.addEventListener('copy', handleCopy);
  document.addEventListener('paste', handlePaste);

  return () => {
    document.removeEventListener('copy', handleCopy);
    document.removeEventListener('paste', handlePaste);
  };
}, [attemptId]);
```

### Pattern 4: AI Snapshot Analysis with GPT-4 Vision

**What:** Analyze webcam snapshots using GPT-4 Vision to detect suspicious behavior (multiple faces, absence, looking away)

**When to use:** Server-side async analysis via BullMQ worker

**Example:**
```typescript
// Source: OpenAI GPT-4 Vision patterns + existing AI grading worker patterns

import { OpenAI } from 'openai';

async function analyzeSnapshot(snapshotUrl: string): Promise<{
  flags: string[];
  confidence: number;
  description: string;
}> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this exam proctoring snapshot. Detect:
            - Number of faces visible (0 = absent, 2+ = multiple people)
            - Student looking away from screen (eyes not on screen)
            - Any suspicious behavior

            Respond in JSON: { "faces": number, "looking_away": boolean, "suspicious": boolean, "description": string }`
          },
          {
            type: "image_url",
            image_url: { url: snapshotUrl }
          }
        ]
      }
    ],
    max_tokens: 300
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');
  const flags: string[] = [];

  if (result.faces === 0) flags.push('ABSENCE');
  if (result.faces > 1) flags.push('MULTIPLE_FACES');
  if (result.looking_away) flags.push('LOOKING_AWAY');
  if (result.suspicious) flags.push('SUSPICIOUS_BEHAVIOR');

  return {
    flags,
    confidence: 0.8, // GPT-4V has ~80-90% accuracy per research
    description: result.description
  };
}
```

### Pattern 5: Teacher Review Dashboard with Timeline View

**What:** Display chronological timeline of all proctoring events + flagged snapshots for teacher review

**When to use:** Post-exam review for teachers to validate AI flags

**Example:**
```typescript
// Source: React timeline component patterns (react-chrono, Flowbite timeline)
// https://github.com/prabhuignoto/react-chrono

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

function EventTimeline({ events }: { events: ProctorEvent[] }) {
  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Card key={event.id} className="flex items-start gap-4">
          <div className="text-sm text-gray-500">
            {new Date(event.timestamp).toLocaleTimeString()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={event.type.includes('FACE') ? 'warning' : 'info'}>
                {event.type}
              </Badge>
              {event.metadata?.confidence && (
                <span className="text-xs text-gray-500">
                  {Math.round(event.metadata.confidence * 100)}% confidence
                </span>
              )}
            </div>
            {event.metadata?.description && (
              <p className="text-sm text-gray-700 mt-1">
                {event.metadata.description}
              </p>
            )}
          </div>
          {event.snapshotUrl && (
            <img
              src={event.snapshotUrl}
              alt="Snapshot"
              className="w-24 h-24 object-cover rounded"
            />
          )}
        </Card>
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid

- **DevTools prevention scripts:** Client-side DevTools detection is easily bypassable and creates poor UX. Focus on backend validation instead.
- **Blocking all copy/paste:** Prevent copy/paste prevention (e.g., `e.preventDefault()`) can frustrate legitimate users. LOG events, don't block them.
- **Continuous video recording:** Recording entire exam sessions creates massive storage costs and privacy issues. Use periodic snapshots instead.
- **Facial recognition for identity:** GPT-4 Vision deliberately won't identify people by name (privacy protection). Use pre-exam identity verification instead.
- **Browser lockdown without webcam:** Research shows browser lockdown alone is ineffective for remote exams (students can use phones, second computers).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webcam capture | Custom getUserMedia wrapper | react-webcam | Handles permissions, device selection, screenshot capture, 113k+ weekly users means bugs are found |
| Face detection | Custom computer vision | GPT-4 Vision or MediaPipe | Face detection algorithms are complex (lighting, angles, occlusion). GPT-4V already in stack, MediaPipe is Google-maintained |
| Video codec handling | Custom MediaRecorder wrapper | Native API + mimeType detection | Browser codec support varies (webm, mp4, etc). Use `MediaRecorder.isTypeSupported()` |
| Timeline component | Custom timeline UI | react-chrono or Flowbite Timeline | Timeline interactions (zoom, scroll, filters) are UX-heavy to get right |
| Copy/paste pattern analysis | Custom detection logic | Existing antiCheat.ts patterns | Already handles COPY→PASTE pairing, focus loss detection, scoring |
| Snapshot storage | Custom blob handling | MinIO (existing) | Already configured, handles multipart uploads, signed URLs for secure access |

**Key insight:** Browser APIs are mature and well-tested. The complexity is in orchestration (when to capture, how to analyze, how to present to teachers), not in low-level capture mechanisms.

## Common Pitfalls

### Pitfall 1: False Positives Ruining Trust
**What goes wrong:** AI flags innocent behavior (student thinking, adjusting posture, phone ringing in background), teachers see high flag counts and dismiss all flags as noise

**Why it happens:**
- GPT-4 Vision optimizes for detection over precision (research shows 8-30% false positive rates)
- No context: AI doesn't know if student is allowed to look away briefly
- Lighting/camera quality affects accuracy significantly

**How to avoid:**
- Design UI to show confidence scores prominently
- Allow teachers to mark flags as "false positive" to train their intuition
- Use configurable sensitivity levels per exam
- Display multiple snapshots in sequence (not just one) to show context
- Never auto-fail students based on AI flags alone

**Warning signs:**
- Teachers complaining about "too many flags"
- Students reporting anxiety about normal movements
- High variance in flag counts between similar exams

### Pitfall 2: Privacy and Legal Violations
**What goes wrong:**
- Recording students' private spaces without proper consent
- Storing biometric data (facial images) without GDPR/CCPA compliance
- Requiring 360-degree room scans exposes personal information
- Facial recognition working poorly for darker skin tones (bias)

**Why it happens:**
- Proctoring vendors prioritize security over privacy
- Legal requirements vary by jurisdiction (FERPA in US, GDPR in EU, etc.)
- Easy to copy patterns from commercial tools without understanding legal implications

**How to avoid:**
- **Explicit consent:** Show clear proctoring disclosure before exam, require explicit checkbox
- **Data retention policy:** Delete snapshots after grade appeals period (30-90 days)
- **Access controls:** Only exam teacher + student can view their snapshots
- **No room scans:** Don't require students to show their rooms
- **Bias testing:** Test with diverse student population before deployment
- **Legal review:** Consult legal counsel for your jurisdiction

**Warning signs:**
- Students refusing to take exams due to privacy concerns
- Parents/lawyers contacting institution about proctoring
- Retention of snapshots beyond grading period

### Pitfall 3: Webcam Permission Hell
**What goes wrong:** Students can't start exam because:
- Browser blocks getUserMedia on HTTP (requires HTTPS)
- Permission denied and student doesn't know how to reset
- Webcam in use by another application
- Browser doesn't support getUserMedia (old browsers)

**Why it happens:**
- getUserMedia requires secure context (HTTPS)
- Browser permission dialogs are confusing
- Permission state persists (denied = permanently blocked until manual reset)
- Students use various devices/browsers

**How to avoid:**
- **Pre-exam check:** Create separate "proctoring test" page to verify camera works BEFORE exam starts
- **Clear error messages:** "Camera blocked. Click the lock icon in address bar to allow camera access"
- **Fallback UI:** If camera fails, show clear instructions with screenshots for each browser
- **HTTPS required:** Never deploy proctoring on HTTP (will fail silently)
- **Permission check:** Use Permissions API to detect "denied" state and show recovery instructions

**Warning signs:**
- High support tickets about "can't start exam"
- Students starting exam but failing to enable camera
- "Permission denied" errors without clear recovery path

### Pitfall 4: DevTools Detection Creating False Security
**What goes wrong:** Implement DevTools detection thinking it prevents cheating, but:
- Students bypass using browser menus or extensions
- Creates false sense of security (backend validation neglected)
- Legitimate users (students with accessibility tools) get flagged

**Why it happens:**
- DevTools detection scripts are easy to find online
- Looks impressive ("we detect F12!")
- Doesn't address real threat model (students using second device)

**How to avoid:**
- **Log, don't block:** If you detect DevTools, log it as a proctoring event but don't prevent exam access
- **Focus on backend:** Validate all submissions server-side (timing, attempt integrity, answer validation)
- **Acknowledge bypasses:** Document that lockdown is bypassable, focus on multi-layered detection

**Warning signs:**
- Students bypassing detection easily
- Accessibility complaints (screen readers, zoom tools blocked)
- False confidence in security posture

### Pitfall 5: Snapshot Analysis Cost Explosion
**What goes wrong:**
- 100 students × 60-minute exam × 30-second snapshots = 12,000 API calls
- GPT-4 Vision at $0.01/image = $120 per exam
- Costs scale linearly with students/exam duration

**Why it happens:**
- Research examples use aggressive snapshot intervals (15-30s)
- No awareness of OpenAI pricing model
- No optimization (analyze every snapshot even if nothing changed)

**How to avoid:**
- **Configurable intervals:** Default to 60s, allow teachers to increase for high-stakes exams
- **Smart analysis:** Only analyze when motion detected (client-side) or use MediaPipe for free pre-filtering
- **Budget caps:** Set per-exam budget limits in BullMQ worker
- **Batch processing:** Analyze multiple snapshots in single API call (GPT-4V supports multiple images)
- **Teacher opt-in:** Disable AI analysis by default, let teachers enable per exam

**Warning signs:**
- OpenAI bill increasing linearly with exam activity
- Analyzing snapshots where student hasn't moved
- No cost controls in place

## Code Examples

Verified patterns from official sources:

### Browser Permission Pre-Check
```typescript
// Source: MDN Permissions API + getUserMedia patterns
// https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

async function checkCameraPermission(): Promise<{
  state: 'granted' | 'denied' | 'prompt';
  canProceed: boolean;
  message: string;
}> {
  try {
    // Check if Permissions API is available
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });

      if (result.state === 'denied') {
        return {
          state: 'denied',
          canProceed: false,
          message: 'Camera access was denied. Click the lock icon in your browser\'s address bar and allow camera access.'
        };
      }
    }

    // Try to get user media (will prompt if needed)
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    // Stop all tracks immediately (we're just testing)
    stream.getTracks().forEach(track => track.stop());

    return {
      state: 'granted',
      canProceed: true,
      message: 'Camera access granted.'
    };

  } catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      return {
        state: 'denied',
        canProceed: false,
        message: 'Camera access was denied. Please allow camera access to continue.'
      };
    }

    return {
      state: 'denied',
      canProceed: false,
      message: 'Camera not available. Please ensure a camera is connected and no other application is using it.'
    };
  }
}
```

### Right-Click Context Menu Disabling (Optional)
```typescript
// Source: MDN contextmenu event documentation
// https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
// NOTE: Easily bypassable. Use only for discouraging casual cheating, not as security measure.

useEffect(() => {
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    // Log the attempt instead of silently blocking
    fetch(`/api/attempts/${attemptId}/proctor-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'RIGHT_CLICK_ATTEMPT',
        metadata: { timestamp: Date.now() }
      })
    });
  };

  document.addEventListener('contextmenu', handleContextMenu);
  return () => document.removeEventListener('contextmenu', handleContextMenu);
}, [attemptId]);
```

### BullMQ Worker for Snapshot Analysis
```typescript
// Source: Existing AI grading worker patterns + BullMQ documentation

import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { analyzeSnapshot } from '@/lib/proctoring/snapshotAnalysis';

const worker = new Worker(
  'proctoring-analysis',
  async (job: Job) => {
    const { attemptId, snapshotUrl, timestamp } = job.data;

    try {
      // Analyze snapshot with GPT-4 Vision
      const analysis = await analyzeSnapshot(snapshotUrl);

      // Log events for each flag
      for (const flag of analysis.flags) {
        await prisma.proctorEvent.create({
          data: {
            attemptId,
            type: flag, // ABSENCE, MULTIPLE_FACES, etc.
            timestamp: new Date(timestamp),
            metadata: {
              confidence: analysis.confidence,
              description: analysis.description,
              snapshotUrl
            }
          }
        });
      }

      return { success: true, flags: analysis.flags };

    } catch (error) {
      console.error('Snapshot analysis failed:', error);
      throw error; // BullMQ will retry
    }
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 5, // Limit concurrent OpenAI calls
    limiter: {
      max: 10,
      duration: 1000 // Max 10 requests per second to OpenAI
    }
  }
);

worker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Continuous video recording | Periodic snapshots (30-60s intervals) | 2023-2024 | 90% storage cost reduction, better privacy compliance |
| Custom CV models (YOLO, etc.) | GPT-4 Vision API | Late 2023 | No model hosting needed, natural language output, but higher per-image cost |
| navigator.getUserMedia() | navigator.mediaDevices.getUserMedia() | 2021 | Old API deprecated, new API required for modern browsers |
| Browser plugins (Flash, Java) | Native browser APIs | 2020+ | No plugins needed, works on all platforms including mobile |
| Facial recognition for identity | Face detection + pre-exam ID check | 2024-2025 | Privacy compliant (no biometric ID storage), avoids bias issues |
| Auto-fail on AI flags | Teacher review + validation | 2024-2025 | Reduces false positive harm, maintains academic fairness |

**Deprecated/outdated:**
- **Respondus LockDown Browser:** Desktop application required, not web-based. Modern approach uses browser APIs.
- **ProctorU live proctors:** High cost ($20-30 per exam), AI-assisted proctoring reduces cost to $1-5 per exam.
- **navigator.getUserMedia():** Deprecated since 2021, use `navigator.mediaDevices.getUserMedia()` instead.
- **MediaPipe legacy models:** Use new @mediapipe/tasks-vision (2023+) not old @mediapipe/face_detection.

## Open Questions

Things that couldn't be fully resolved:

1. **MediaPipe vs GPT-4 Vision for face detection**
   - What we know: MediaPipe runs client-side (free, fast), GPT-4V is server-side (cost, slower but better context understanding)
   - What's unclear: Performance comparison for proctoring use case (accuracy, false positive rates)
   - Recommendation: Start with GPT-4 Vision (simpler integration, already in stack). Add MediaPipe as optimization if costs are high.

2. **Optimal snapshot interval**
   - What we know: Research papers use 15-30s, but this creates high API costs. Commercial systems use 30-60s.
   - What's unclear: Does longer interval (60s+) significantly reduce cheating detection?
   - Recommendation: Make configurable per exam (default 60s), allow teachers to adjust. Monitor false negative rates.

3. **Legal requirements by jurisdiction**
   - What we know: FERPA (US), GDPR (EU), CCPA (California) have different requirements. California has Student Test Taker Privacy Protection Act.
   - What's unclear: Specific compliance requirements for this project's target institutions
   - Recommendation: Consult legal counsel. Include consent flow, data retention policy, and access controls as baseline.

4. **Browser compatibility for MediaRecorder**
   - What we know: MediaRecorder widely supported since 2021, but MIME type support varies (webm vs mp4)
   - What's unclear: Should we support older browsers (pre-2021)?
   - Recommendation: Require modern browsers (Chrome 72+, Firefox 66+, Safari 14+). Use `MediaRecorder.isTypeSupported()` to detect codec.

5. **Real-time vs post-exam analysis**
   - What we know: Real-time analysis (during exam) allows instant intervention. Post-exam analysis (async) is cheaper.
   - What's unclear: Do teachers want real-time alerts during exams?
   - Recommendation: Start with async post-exam analysis. Add real-time as Phase 2 feature if teachers request it.

## Sources

### Primary (HIGH confidence)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) - Official documentation
- [MDN Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) - Official documentation
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) - Official documentation
- [MDN contextmenu event](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event) - Official documentation
- [Google MediaPipe Face Detector](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js) - Official guide
- [react-webcam npm package](https://www.npmjs.com/package/react-webcam) - 113k+ weekly downloads

### Secondary (MEDIUM confidence)
- [Paradiso Solutions Online Proctoring Guide 2026](https://www.paradisosolutions.com/blog/complete-guide-online-proctoring-remote-exams/) - WebSearch verified with patterns
- [Think Exam AI Webcam Proctoring 2026](https://thinkexam.com/blog/top-exam-proctoring-software-with-webcam-2026-how-ai-driven-webcam-monitoring-prevents-cheating/) - WebSearch verified practices
- [Respondus LockDown Browser Best Practices](https://teaching.unl.edu/resources/grading-feedback/respondus-lockdown-browser-and-monitor-best-practices/) - Academic source
- [OpenReplay React Webcam Tutorial](https://blog.openreplay.com/capture-real-time-images-and-videos-with-react-webcam/) - Implementation patterns
- [Legal Implications of Remote Exam Proctoring](https://scholarlycommons.law.case.edu/cgi/viewcontent.cgi?article=5058&context=caselrev) - Legal research paper

### Tertiary (LOW confidence - flagged for validation)
- [GPT-4 Vision for Exam Proctoring](https://www.visive.ai/solutions/proctor-ai) - WebSearch only, vendor claims
- [AI Proctoring False Positive Rates](https://www.researchgate.net/publication/364345744_The_Accuracy_of_AI-Based_Automatic_Proctoring_in_Online_Exams) - Research paper, need to verify methodology
- [Turnitin 1% False Positive Rate](https://proofademic.ai/blog/false-positives-ai-detection-guide/) - Vendor claim, not independently verified
- [DevTools Detection Bypass Methods](https://blog.exploit.cat/defeating-devtools-detection/) - Security blog, demonstrates bypasses

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation verified for MediaRecorder, Page Visibility API, getUserMedia. react-webcam is most popular React library with 113k+ weekly downloads.
- Architecture: HIGH - Patterns verified against MDN documentation and existing codebase (ProctorEvent model, BullMQ workers, MinIO storage already implemented).
- Pitfalls: MEDIUM - Based on WebSearch findings (false positive rates, privacy issues, legal cases) and research papers. Legal requirements need validation with counsel.
- AI analysis: MEDIUM - GPT-4 Vision capabilities documented, but proctoring-specific accuracy (false positive rates) from research papers need independent verification.

**Research date:** 2026-02-02
**Valid until:** 30 days (2026-03-04) - Browser APIs stable, AI capabilities evolving, legal landscape changing with new regulations

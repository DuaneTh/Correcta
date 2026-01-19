---
phase: 02-exam-creation
plan: 03
subsystem: exam-editor
tags: [minio, image-upload, math-toolbar, rich-text, markdown, preview]

dependency-graph:
  requires:
    - "01-01: MathToolbar component for math symbol insertion"
    - "01-02: MathRenderer for KaTeX rendering"
    - "02-02: Question editors (OpenQuestionEditor)"
  provides:
    - "MinIO storage integration for exam assets"
    - "ImageUpload component with drag-and-drop"
    - "RichTextEditor with math and image support"
    - "QuestionPreview for live content rendering"
  affects:
    - "02-04: Student exam taking can display images"
    - "04-*: AI grading receives rich content"
    - "05-*: PDF export can include images"

tech-stack:
  added:
    - minio (already installed, now configured)
  patterns:
    - "Proxy upload through Next.js API (avoids CORS)"
    - "Markdown-style image syntax for portability"
    - "$...$ delimiters for math in text content"
    - "Cursor position tracking for insertions"

key-files:
  created:
    - lib/storage/minio.ts
    - app/api/upload/route.ts
    - components/ui/ImageUpload.tsx
    - components/exam-editor/QuestionPreview.tsx
    - components/exam-editor/RichTextEditor.tsx
  modified:
    - components/exam-editor/question-types/OpenQuestionEditor.tsx

decisions:
  - id: PROXY-UPLOAD
    choice: "Proxy file uploads through Next.js API route"
    rationale: "Simpler for dev environments, avoids CORS/presigned URL complexity with local MinIO"
  - id: MARKDOWN-IMAGE-SYNTAX
    choice: "Use ![alt](url) syntax for images in content"
    rationale: "Standard markdown, easy to parse, portable between storage backends"
  - id: MATH-DELIMITERS
    choice: "$...$ for inline math in textarea content"
    rationale: "Works with existing MathRenderer, familiar LaTeX syntax"
  - id: PLACEHOLDER-CLEANUP
    choice: "Strip MathLive placeholders (#@ and #0) when inserting via toolbar"
    rationale: "Placeholders are for WYSIWYG editor, not plain text"

metrics:
  duration: "7 minutes"
  completed: "2026-01-19"
---

# Phase 02 Plan 03: Image Upload Integration Summary

MinIO storage integration with ImageUpload component, plus RichTextEditor that combines MathToolbar and image insertion for rich question content.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5dd235c | feat | Setup MinIO storage and upload API |
| 94c2c8b | feat | Add ImageUpload component with drag-and-drop |
| c668ee5 | feat | Integrate math toolbar and image upload into editors |

## What Was Built

### 1. MinIO Storage (`lib/storage/minio.ts`)

Server-side MinIO client configuration and helpers:

```typescript
// Client initialization with env vars
getMinioClient(): Minio.Client

// File operations
uploadFile(key, buffer, contentType, bucket): Promise<string>
getPresignedUploadUrl(bucket, key, expiry): Promise<string>
deleteObject(bucket, key): Promise<void>
getPublicUrl(bucket, key): string

// Utilities
generateUploadKey(filename): string // uploads/{date}/{uuid}-{sanitized}
isValidImageType(mimeType): boolean // JPEG, PNG, GIF, WebP, SVG
ensureBucket(bucket): Promise<void> // Creates with public read policy
```

**Environment Variables:**
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `MINIO_BUCKET`, `MINIO_PUBLIC_URL`

### 2. Upload API Route (`app/api/upload/route.ts`)

POST endpoint for proxied file uploads:

```typescript
POST /api/upload
- FormData with 'file' field
- Returns: { url: string }
- Auth: Teacher role required
- Validates: file type, size (10MB max)
```

### 3. ImageUpload Component (`components/ui/ImageUpload.tsx`)

Reusable upload component with:

**UI States:**
- Empty: Drop zone with dashed border, "Drag or click" text
- Uploading: Spinner with "Uploading..." message
- Error: Red warning with localized message
- Preview: Image display with remove button

**Props:**
```typescript
value: string | null       // Current image URL
onChange: (url | null) => void  // Called on upload or remove
label?: string             // Optional label
disabled?: boolean
locale?: 'fr' | 'en'
```

**Features:**
- Drag-and-drop support with visual feedback
- Click-to-upload fallback
- Keyboard accessible (Enter/Space)
- Error handling with user-friendly messages

### 4. QuestionPreview Component (`components/exam-editor/QuestionPreview.tsx`)

Renders question content with math and images:

```typescript
// Parses markdown images: ![alt](url)
// Delegates math ($...$) to MathRenderer
// Handles mixed content: text + math + images
```

### 5. RichTextEditor Component (`components/exam-editor/RichTextEditor.tsx`)

Combined editor with all features:

**Layout:**
- Label row with "Add Image" and "Preview" toggles
- MathToolbar (optional, default on)
- Image upload modal (collapsible)
- Side-by-side editor/preview on large screens

**Integration:**
- Tracks cursor position in textarea
- Inserts symbols/images at cursor
- Cleans MathLive placeholders for plain text
- Wraps math in $...$ delimiters automatically

**Props:**
```typescript
value: string
onChange: (value) => void
showMathToolbar?: boolean
showImageUpload?: boolean
defaultShowPreview?: boolean
locale?: 'fr' | 'en'
```

### 6. OpenQuestionEditor Updates

Updated to use RichTextEditor instead of plain textarea:

```diff
- <textarea value={content} onChange={...} />
+ <RichTextEditor
+   value={content}
+   onChange={...}
+   showMathToolbar={true}
+   showImageUpload={true}
+   locale={locale}
+ />
```

Also added full i18n support (fr/en labels throughout).

## User Flow

### Inserting Math:
1. Click symbol in MathToolbar (e.g., fraction)
2. Symbol inserted at cursor: `$\frac{}{}$`
3. Preview shows rendered math in real-time

### Uploading Image:
1. Click "Add Image" button
2. Drag file onto drop zone or click to browse
3. Image uploads to MinIO via API proxy
4. Markdown inserted: `![image](https://...)`
5. Preview shows rendered image

### Using Preview:
1. Toggle "Preview" button to show/hide
2. Side-by-side on large screens
3. Math and images render in preview pane

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

- MinIO client is lazily initialized (no startup connection)
- Upload API validates auth via `getAuthSession` and `isTeacher`
- Bucket auto-created with public read policy on first upload
- Image URLs are public (no signed URLs needed for display)
- MathToolbar placeholders (#@ and #0) are stripped for textarea insertion
- `<img>` used intentionally for external URLs (Next Image requires config)

## Verification Checklist

- [x] MinIO client configuration with env vars
- [x] Upload API validates auth and file types
- [x] ImageUpload has drag-and-drop
- [x] ImageUpload shows loading state
- [x] ImageUpload displays preview after upload
- [x] MathToolbar inserts symbols at cursor
- [x] Math renders in preview via $...$
- [x] Images render in preview via markdown syntax
- [x] OpenQuestionEditor uses RichTextEditor
- [x] Localization for fr/en

## Next Phase Readiness

Ready for 02-04 (Student Exam Taking). The rich content system provides:
- Images stored in MinIO accessible via public URLs
- Math and images in question content display correctly
- QuestionPreview can be reused for student view

---
phase: 03-organization
plan: 02
subsystem: user-management
tags: [csv-import, bulk-upload, papaparse, user-creation]

dependency-graph:
  requires:
    - "Existing bulk user creation API at /api/admin/school/users"
    - "SchoolUsersClient component"
    - "Dictionary system for i18n"
  provides:
    - "CsvUploader reusable component with drag-and-drop"
    - "CSV import UI integrated into school users page"
    - "Client-side CSV parsing with papaparse"
    - "Preview with validation before import"
  affects:
    - "User management workflow (faster bulk imports)"

tech-stack:
  added:
    - papaparse (CSV parsing library)
    - "@types/papaparse (TypeScript definitions)"
  patterns:
    - "Client-side CSV parsing for preview before submit"
    - "Drag-and-drop file upload with fallback button"
    - "Validation status per row (valid/invalid-email/duplicate)"
    - "Reusable uploader component with configurable labels"

key-files:
  created:
    - components/ui/CsvUploader.tsx
  modified:
    - package.json (papaparse dependency)
    - lib/i18n/dictionaries.ts (csvImport labels)
    - app/admin/school/users/SchoolUsersClient.tsx (CSV import drawer)

decisions:
  - id: CLIENT-SIDE-PARSING
    choice: "Parse CSV on client before sending to server"
    rationale: "Allows preview and validation, reduces server load for invalid files"
  - id: PAPAPARSE-LIBRARY
    choice: "Use papaparse for CSV parsing"
    rationale: "Mature, well-maintained library with TypeScript support"
  - id: PREVIEW-LIMIT
    choice: "Show first 50 rows in preview table"
    rationale: "Prevents UI slowdown with large files while showing representative sample"
  - id: REQUIRED-EMAIL-COLUMN
    choice: "email column required, name column optional"
    rationale: "Matches existing bulk API requirements"

metrics:
  duration: "8 minutes"
  completed: "2026-01-20"
---

# Phase 03 Plan 02: CSV Upload UI Summary

CSV upload interface for bulk user creation via papaparse client-side parsing.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| c5cf7e2 | feat | Add CsvUploader component with papaparse |
| b9bb3a2 | feat | Integrate CSV import into SchoolUsersClient |

## What Was Built

### 1. CsvUploader Component (`components/ui/CsvUploader.tsx`)

Reusable CSV upload component with:

- **Drag-and-drop support**: Visual feedback on drag over
- **Click-to-select fallback**: Standard file input button
- **Configurable columns**: Required and optional column validation
- **Row limit enforcement**: Default 500 rows max
- **Internationalized labels**: All text passed via props
- **Parse error handling**: Reports parsing errors to parent

Props interface:
```typescript
type CsvUploaderProps = {
  onParsed: (data: Record<string, string>[], errors: string[]) => void
  requiredColumns: string[]
  optionalColumns?: string[]
  accept?: string
  maxRows?: number
  labels: {
    dropzone: string
    selectFile: string
    parsing: string
    invalidFormat: string
    missingColumns: string
    tooManyRows: string
  }
}
```

### 2. CSV Import Integration in SchoolUsersClient

Added complete CSV import workflow:

**State management:**
- `csvDrawerOpen`: Drawer visibility
- `csvData`: Parsed user array
- `csvErrors`: Parse errors
- `csvImporting`: Loading state
- `csvResult`: Import results

**Validation logic:**
- `getCsvUserStatus()`: Returns 'valid' | 'invalid-email' | 'duplicate'
- Duplicate detection within same CSV file
- Email format validation (contains @)

**Three drawer views:**
1. **Upload view**: CsvUploader component
2. **Preview view**: Table with validation status per row
3. **Result view**: Created/skipped counts and errors

### 3. Dictionary Entries

Added `csvImport` section to both FR and EN dictionaries:

- `button`: Button text for opening import drawer
- `title`: Drawer title
- `dropzone/selectFile/parsing`: Upload UI labels
- `invalidFormat/missingColumns/tooManyRows`: Error messages
- `previewTitle/previewColumn*`: Preview table labels
- `statusValid/statusInvalidEmail/statusDuplicate`: Row status badges
- `importButton/importing`: Action button states
- `resultSuccess/resultErrors`: Result display
- `cancelButton/closeButton`: Navigation

## User Flow

1. School admin clicks "Import CSV" button in users page header
2. CSV import drawer opens with upload zone
3. Admin drops or selects CSV file
4. Papaparse parses file client-side
5. Preview table shows parsed data with validation status:
   - Green "Valid" badge for valid rows
   - Red "Invalid email" badge for missing/malformed emails
   - Red "Duplicate" badge for repeated emails in same file
6. Summary shows: X valid, Y invalid, Z duplicates
7. Admin clicks "Import N users" button
8. Valid users sent to existing bulk API
9. Result shows: "N users created, M skipped"
10. Admin clicks Close to dismiss drawer

## Technical Notes

### Validation

- **Required column check**: CSV must have "email" column
- **Email validation**: Must contain "@" character
- **Duplicate detection**: Same email appearing multiple times in CSV
- **Server-side dedup**: API uses `skipDuplicates: true` for DB conflicts

### Performance

- First 50 rows shown in preview (scrollable)
- Row count indicator shows total
- Large files (>500 rows) rejected early

### Integration

- Uses existing `/api/admin/school/users` bulk endpoint
- Same API handles both single and bulk user creation
- Role determined by active tab (teacher/student)

## Verification Checklist

- [x] papaparse in package.json
- [x] CsvUploader component exists and exports correctly
- [x] Import button visible on /admin/school/users page
- [x] CSV upload shows preview before import
- [x] Invalid emails highlighted, duplicates detected
- [x] Import creates users via existing bulk API
- [x] Result shows created/skipped counts
- [x] Existing user creation flow still works
- [x] Line count: CsvUploader (115 lines >= 100)
- [x] Line count: SchoolUsersClient (751 lines >= 500)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

CSV upload foundation ready for potential extension to:
- Course/section bulk import
- Enrollment bulk assignment
- Export functionality (reverse direction)

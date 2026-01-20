# Phase 3: Organization - Research

**Researched:** 2026-01-20
**Domain:** School administration, class/subgroup management, bulk user operations
**Confidence:** HIGH

## Summary

Phase 3 focuses on enabling school admins to manage organizational structure: classes, subgroups, and user roles. Research reveals that **significant infrastructure already exists** in the codebase that covers most requirements. The existing admin UI at `/app/admin/school/` already supports course/section (Class) management, user creation, and enrollment management.

Key findings:
1. **ORG-01 (Create classes):** ALREADY IMPLEMENTED - Course and "Section" (Class model) CRUD exists
2. **ORG-02 (Subgroups):** REQUIRES SCHEMA CHANGE - Current `Class` model is flat; needs `parentId` for hierarchy
3. **ORG-03 (Student assignment):** ALREADY IMPLEMENTED - Enrollment management exists with UI
4. **ORG-04 (CSV import):** PARTIALLY EXISTS - Bulk user API exists, needs UI upload component
5. **ORG-05 (Role assignment):** NEEDS API EXTENSION - SCHOOL_ADMIN role exists, promotion endpoint missing

**Primary recommendation:** Extend existing infrastructure rather than building from scratch. Add hierarchical subgroups to Class model, create CSV upload UI, and add role promotion endpoint.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.2.0 | Database ORM | Already used throughout codebase |
| Next.js App Router | 16.1.1 | Routing and server actions | Project standard |
| Zustand | 5.0.10 | Client state | Already used in exam editor |
| React | 19.2.0 | UI framework | Project standard |

### To Add
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| papaparse | ^5.4.0 | CSV parsing | Client-side preview, server-side bulk processing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| papaparse | xlsx (SheetJS) | xlsx handles Excel files but adds complexity; CSV-only is sufficient |
| Client-side parsing | Server-only parsing | Client-side preview improves UX before commit |

**Installation:**
```bash
npm install papaparse
npm install -D @types/papaparse
```

## Architecture Patterns

### Existing Project Structure (Extend, Don't Replace)
```
app/
├── admin/school/
│   ├── page.tsx                    # EXISTING: Admin dashboard
│   ├── classes/
│   │   ├── page.tsx               # EXISTING: Course/Section management
│   │   └── SchoolClassesClient.tsx # EXISTING: 1000+ lines of UI
│   ├── users/
│   │   ├── page.tsx               # EXISTING: User management
│   │   └── SchoolUsersClient.tsx  # EXISTING: Teacher/Student tabs
│   ├── enrollments/
│   │   ├── page.tsx               # EXISTING: Enrollment management
│   │   └── SchoolEnrollmentsClient.tsx # EXISTING: Assignment UI
│   └── settings/
│       └── page.tsx               # EXISTING: School settings
├── api/admin/school/
│   ├── courses/route.ts           # EXISTING: Course CRUD
│   ├── sections/route.ts          # EXISTING: Class CRUD (bulk support)
│   ├── users/route.ts             # EXISTING: User CRUD (bulk support)
│   └── enrollments/route.ts       # EXISTING: Enrollment CRUD
lib/
├── actions/
│   ├── exam-editor.ts             # EXISTING PATTERN: Server actions
│   └── organization.ts            # NEW: Organization server actions
├── school-admin-data.ts           # EXISTING: Data loading utilities
```

### Pattern 1: Hierarchical Subgroups via Self-Reference
**What:** Add `parentId` to Class model for subgroup hierarchy
**When to use:** When a class needs subdivision (TD1, TD2, TD3 under "Finance 2026")
**Example:**
```prisma
// In schema.prisma
model Class {
  id        String       @id @default(uuid())
  name      String
  courseId  String
  course    Course       @relation(fields: [courseId], references: [id])
  parentId  String?      // NEW: Reference to parent class
  parent    Class?       @relation("ClassHierarchy", fields: [parentId], references: [id])
  children  Class[]      @relation("ClassHierarchy")  // Subgroups
  archivedAt DateTime?

  enrollments Enrollment[]
  exams       Exam[]
}
```

### Pattern 2: Server Action for Bulk Operations
**What:** Use server actions pattern from exam-editor for organization operations
**When to use:** When performing mutations that need permission checks
**Example:**
```typescript
// Source: lib/actions/exam-editor.ts pattern
'use server'

import { getServerSession } from 'next-auth'
import { buildAuthOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function promoteToSchoolAdmin(userId: string) {
  const cookieStore = await cookies()
  const institutionId = cookieStore.get('correcta-institution')?.value

  const authOptions = await buildAuthOptions(institutionId)
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== 'SCHOOL_ADMIN') {
    throw new Error('Unauthorized')
  }

  // Verify target user is in same institution
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, institutionId: true }
  })

  if (!targetUser || targetUser.institutionId !== session.user.institutionId) {
    throw new Error('User not found')
  }

  if (targetUser.role !== 'TEACHER') {
    throw new Error('Can only promote teachers to school admin')
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: 'SCHOOL_ADMIN' }
  })

  revalidatePath('/admin/school/users')
  return { success: true }
}
```

### Pattern 3: CSV Upload with Client Preview
**What:** Parse CSV client-side for preview, submit via server action for processing
**When to use:** Bulk user creation, bulk enrollment
**Example:**
```typescript
// Client component
import Papa from 'papaparse'

function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  if (!file) return

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      // Preview data before submit
      setPreviewData(results.data)
      setErrors(results.errors)
    }
  })
}

// Server action receives parsed data, not file
export async function bulkCreateUsers(users: Array<{ email: string; name: string }>) {
  // Process and create users with validation
}
```

### Anti-Patterns to Avoid
- **Don't create new admin pages:** Extend existing `/admin/school/` pages
- **Don't duplicate API routes:** Extend existing routes with new functionality
- **Don't process large files client-side:** Use server actions for actual creation
- **Don't allow role promotion without verification:** Always check same institution

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV parsing | Custom regex/split | PapaParse | Handles quoted fields, encoding, streaming |
| Bulk user creation | Loop with individual creates | prisma.user.createMany() | Already implemented in /api/admin/school/users |
| Enrollment management | Custom UI | Extend SchoolEnrollmentsClient | 400+ lines of working UI |
| Class hierarchy | Separate Subgroup model | Self-referencing Class | Simpler, reuses existing model |
| Permission checks | Custom middleware | isSchoolAdmin() from lib/api-auth | Consistent with codebase |
| Bulk section creation | Individual API calls | POST /api/admin/school/sections with sections[] | Already supports bulk |

**Key insight:** The existing codebase has 80% of the infrastructure needed. Focus on extending, not replacing.

## Common Pitfalls

### Pitfall 1: Over-engineering Subgroups
**What goes wrong:** Creating a separate `Subgroup` model or complex hierarchy
**Why it happens:** Thinking subgroups are fundamentally different from classes
**How to avoid:** Use self-referencing `parentId` on existing Class model
**Warning signs:** Adding new models when existing ones can be extended

### Pitfall 2: Forgetting DEFAULT_SECTION Pattern
**What goes wrong:** Breaking existing functionality that relies on `__DEFAULT__` section
**Why it happens:** Not reading existing sections/enrollments API code
**How to avoid:** Maintain `DEFAULT_SECTION_NAME = '__DEFAULT__'` pattern throughout
**Warning signs:** Users disappearing from course when archiving sections

### Pitfall 3: Large File Upload Timeout
**What goes wrong:** CSV with 1000+ users times out during server action
**Why it happens:** Processing all users synchronously in request
**How to avoid:** Use `createMany()` with `skipDuplicates`, batch if >500 rows
**Warning signs:** Upload works for 10 users, fails for 200

### Pitfall 4: Role Promotion Without Scope Check
**What goes wrong:** School admin promotes user from different institution
**Why it happens:** Not verifying `institutionId` matches
**How to avoid:** Always check `targetUser.institutionId === session.user.institutionId`
**Warning signs:** Cross-institution data leakage in security audit

### Pitfall 5: UI State Desync After Bulk Operation
**What goes wrong:** Table shows stale data after CSV import
**Why it happens:** Client state not refreshed after server action
**How to avoid:** Call `router.refresh()` and `revalidatePath()` after mutations
**Warning signs:** User needs to refresh page to see new data

## Code Examples

Verified patterns from codebase:

### Existing Bulk User Creation
```typescript
// Source: app/api/admin/school/users/route.ts lines 80-127
if (Array.isArray(body?.users)) {
  const seen = new Set<string>()
  const errors: string[] = []
  const data = body.users
    .map((entry: { email?: string; name?: string }) => {
      const rawEmail = typeof entry?.email === 'string' ? entry.email.trim().toLowerCase() : ''
      const rawName = typeof entry?.name === 'string' ? entry.name.trim() : null
      if (!rawEmail || !rawEmail.includes('@')) {
        errors.push(rawEmail ? `Invalid email: ${rawEmail}` : 'Missing email')
        return null
      }
      if (seen.has(rawEmail)) return null
      seen.add(rawEmail)
      return {
        email: rawEmail,
        name: rawName || null,
        role,
        institutionId: session.user.institutionId,
        passwordHash,
      }
    })
    .filter(Boolean)

  const result = await prisma.user.createMany({
    data,
    skipDuplicates: true,
  })
  return NextResponse.json({ createdCount: result.count, skippedCount: data.length - result.count, errors })
}
```

### Existing Enrollment Assignment
```typescript
// Source: app/api/admin/school/enrollments/route.ts
// Already handles:
// - Single user enrollment
// - Bulk enrollment by email list
// - DEFAULT_SECTION fallback
// - Institution scope verification
```

### Existing Permission Pattern
```typescript
// Source: lib/api-auth.ts
export function isSchoolAdmin(session: any): boolean {
    return session?.user?.role === 'SCHOOL_ADMIN'
}

export function isAdmin(session: any): boolean {
    return isSchoolAdmin(session) || isPlatformAdmin(session)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API routes for mutations | Server actions | Next.js 14+ stable | Better DX, automatic revalidation |
| File upload via FormData | Client preview + server action | Current | Better UX with preview before commit |
| Flat class structure | Hierarchical with parentId | This phase | Enables subgroups without new model |

**Deprecated/outdated:**
- None in current codebase; patterns are modern

## What Already Exists (Critical Discovery)

This is the most important research finding. The following features are **ALREADY IMPLEMENTED**:

### Fully Implemented
1. **Course CRUD** - Create, edit, archive courses (`/admin/school/classes` courses tab)
2. **Class/Section CRUD** - Create, edit, archive sections (`/admin/school/classes` sections tab)
3. **User CRUD** - Create teachers and students with form (`/admin/school/users`)
4. **Enrollment Management** - Assign users to classes (`/admin/school/enrollments`)
5. **Roster Management** - View/manage students in a section (SchoolClassesClient drawer)
6. **Bulk User Creation** - API supports `users[]` array (POST /api/admin/school/users)
7. **Bulk Section Creation** - API supports `sections[]` array (POST /api/admin/school/sections)
8. **Bulk Enrollment** - API supports `emails[]` array (POST /api/admin/school/enrollments)

### Partially Implemented (Needs UI Only)
1. **CSV Import** - Bulk APIs exist, need file upload + preview UI component
2. **Excel Import** - Same as CSV, consider xlsx library if needed

### Not Implemented (Requires New Work)
1. **Subgroups** - Need `parentId` schema change and UI for hierarchy
2. **Role Promotion** - Need new endpoint to change TEACHER to SCHOOL_ADMIN
3. **CSV Upload UI** - Need file picker + preview + submit flow

## Gap Analysis vs Requirements

| Requirement | Status | Gap | Effort |
|-------------|--------|-----|--------|
| ORG-01: Create classes | DONE | None - already works | 0 |
| ORG-02: Create subgroups | NOT DONE | Schema change + UI | Medium |
| ORG-03: Assign students | DONE | None - enrollment UI works | 0 |
| ORG-04: CSV/Excel import | PARTIAL | Need upload UI component | Low |
| ORG-05: Role assignment | PARTIAL | Need promotion API + UI | Low |

**Estimated effort:** 2-3 plans instead of 5, primarily extending existing code

## Open Questions

Things that couldn't be fully resolved:

1. **Subgroup Enrollment Inheritance**
   - What we know: Parent class enrollments don't auto-inherit to children
   - What's unclear: Should enrolling in parent auto-enroll in all subgroups?
   - Recommendation: No auto-inheritance; explicit enrollment per subgroup

2. **Role Demotion**
   - What we know: ORG-05 says "role assignment (teacher, school admin)"
   - What's unclear: Can school admin demote another school admin back to teacher?
   - Recommendation: Allow promotion only; demotion requires platform admin

3. **Excel Format Support**
   - What we know: ORG-04 says "CSV/Excel"
   - What's unclear: Which Excel formats (.xls, .xlsx) must be supported
   - Recommendation: Start with CSV only; add xlsx if explicitly required

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - Current database schema
- `app/admin/school/**/*.tsx` - Existing admin UI (verified working)
- `app/api/admin/school/**/*.ts` - Existing API routes with bulk support
- `lib/school-admin-data.ts` - Data loading patterns
- `lib/api-auth.ts` - Permission check utilities
- `lib/actions/exam-editor.ts` - Server action patterns

### Secondary (MEDIUM confidence)
- [Next.js File Uploads: Server-Side Solutions](https://www.pronextjs.dev/next-js-file-uploads-server-side-solutions) - Server action file handling
- [NPM Trends: CSV Parsers Comparison](https://npmtrends.com/csv-parse-vs-exceljs-vs-node-xlsx-vs-papaparse-vs-xlsx) - PapaParse vs alternatives
- [JavaScript CSV Parsers Comparison](https://leanylabs.com/blog/js-csv-parsers-benchmarks/) - Performance benchmarks

### Tertiary (LOW confidence)
- None - all claims verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified in package.json and codebase
- Architecture: HIGH - patterns extracted from existing code
- What exists: HIGH - read actual implementation files
- Subgroup design: MEDIUM - self-reference pattern is standard but needs validation
- CSV handling: MEDIUM - PapaParse is standard, integration needs testing

**Research date:** 2026-01-20
**Valid until:** 2026-02-20 (30 days - stable patterns, existing code)

## Recommendations for Planning

1. **Plan 03-01: Subgroups** - Add `parentId` to Class schema, update UI to show hierarchy
2. **Plan 03-02: CSV Upload** - Add file upload component, connect to existing bulk APIs
3. **Plan 03-03: Role Promotion** - Add server action + UI button for promoting teachers

**Do NOT plan for:**
- Course/Section CRUD (exists)
- User creation (exists)
- Enrollment management (exists)
- Bulk APIs (exist)

# Architecture

**Analysis Date:** 2026-01-18

## Pattern Overview

**Overall:** Multi-tenant SaaS with Next.js App Router, Server Components, and API Routes

**Key Characteristics:**
- Server-first rendering with React Server Components for initial data fetching
- Client Components for interactive UI with `'use client'` directive
- API Routes for mutations and external integrations
- Multi-tenant isolation via institution ID in session/cookie
- Role-based access control (PLATFORM_ADMIN, SCHOOL_ADMIN, TEACHER, STUDENT)

## Layers

**Presentation Layer (React Components):**
- Purpose: UI rendering and user interaction
- Location: `app/**/page.tsx`, `components/**/*.tsx`
- Contains: Server Components (data fetching), Client Components (interactivity)
- Depends on: Data layer, lib utilities
- Used by: End users via browser

**API Layer (Next.js Route Handlers):**
- Purpose: HTTP endpoints for data mutations and external access
- Location: `app/api/**/route.ts`
- Contains: REST endpoints with GET, POST, PUT, DELETE handlers
- Depends on: Data layer, auth utilities, validation
- Used by: Client Components via fetch, external integrations

**Data Layer (Prisma ORM):**
- Purpose: Database access and entity management
- Location: `lib/prisma.ts`, `prisma/schema.prisma`
- Contains: Prisma client singleton, schema definitions
- Depends on: PostgreSQL database
- Used by: API routes, Server Components

**Business Logic Layer:**
- Purpose: Domain rules, permissions, calculations
- Location: `lib/*.ts` (exam-permissions.ts, attemptPermissions.ts, etc.)
- Contains: Permission checks, business validations, helper functions
- Depends on: Prisma, session context
- Used by: API routes, Server Components

**Authentication Layer:**
- Purpose: User identity and session management
- Location: `lib/auth.ts`, `lib/api-auth.ts`, `app/api/auth/[...nextauth]/route.ts`
- Contains: NextAuth.js config with credentials + SSO providers
- Depends on: Prisma, institution cookies
- Used by: All protected routes and API endpoints

## Data Flow

**Server Component Rendering:**
1. User requests page (e.g., `/student/attempts/[attemptId]`)
2. Server Component calls `getServerSession()` for auth
3. Server Component fetches data via Prisma directly
4. Data is serialized and passed to Client Component as props
5. Client Component hydrates with initial data

**API Mutation Flow:**
1. Client Component calls fetch with CSRF token header
2. API Route validates session via `getAuthSession()`
3. API Route verifies CSRF token via `verifyCsrf()`
4. API Route performs business logic validation
5. Prisma mutation executed
6. JSON response returned to client

**Multi-tenant Auth Flow:**
1. Institution cookie (`correcta-institution`) identifies tenant
2. `buildAuthOptions()` loads institution-specific SSO config
3. NextAuth.js session includes `institutionId`
4. All data queries filter by `institutionId`

**State Management:**
- Server state: Fetched fresh on each request via Server Components
- Client state: React useState/useCallback in Client Components
- No global state library (Redux, Zustand, etc.)
- Form state managed locally in components

## Key Abstractions

**Exam Builder Hook:**
- Purpose: Encapsulate exam editing logic
- Examples: `components/exams/hooks/useExamBuilderData.ts`
- Pattern: Custom hook returns state and mutation functions

**Permission Functions:**
- Purpose: Centralize authorization checks
- Examples: `lib/exam-permissions.ts`, `lib/attemptPermissions.ts`
- Pattern: Pure functions returning permission objects

**Data Loader Functions:**
- Purpose: Server-side data aggregation for pages
- Examples: `lib/school-admin-data.ts` (`loadSchoolAdminData()`)
- Pattern: Async functions returning typed data objects

**CSRF Protection:**
- Purpose: Prevent cross-site request forgery
- Examples: `lib/csrf.ts`, `lib/csrfClient.ts`, `lib/fetchJsonWithCsrf.ts`
- Pattern: Cookie + header token verification on mutations

## Entry Points

**Application Root:**
- Location: `app/layout.tsx`
- Triggers: Every page request
- Responsibilities: HTML structure, Providers wrapper, global styles

**Auth Entry:**
- Location: `app/api/auth/[...nextauth]/route.ts`
- Triggers: Login, logout, session checks
- Responsibilities: NextAuth.js handler delegation

**Page Entry Points by Role:**
- Students: `app/student/**` (courses, exams, attempts)
- Teachers: `app/teacher/**`, `app/dashboard/exams/**`
- School Admins: `app/admin/school/**`
- Platform Admins: `app/admin/platform/**`

**API Entry Points:**
- Exams CRUD: `app/api/exams/[examId]/route.ts`
- Attempts: `app/api/attempts/[id]/route.ts`
- Admin School: `app/api/admin/school/**`
- Institutions: `app/api/institutions/route.ts`

## Error Handling

**Strategy:** Try-catch with console logging and generic HTTP responses

**Patterns:**
- API routes wrap handler in try-catch
- Errors logged with `console.error("[API] Context:", error)`
- Generic 500 response returned to client
- Specific error codes for auth (401), forbidden (403), not found (404)
- CSRF failures return 403 with `{ error: "CSRF" }`

**Example from `app/api/exams/[examId]/route.ts`:**
```typescript
try {
    // ... handler logic
} catch (error) {
    console.error("[API] Update Exam Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
}
```

## Cross-Cutting Concerns

**Logging:**
- Approach: `console.log`/`console.error` with prefixes like `[API]`, `[Auth]`
- Sensitive data redacted via `lib/logging.ts` (`safeJson()`, `redactEmail()`)

**Validation:**
- Input validation in API routes before Prisma calls
- Type coercion for dates (`new Date(body.startAt)`)
- Business validation (exam status, time windows)

**Authentication:**
- Every protected route calls `getServerSession()` or `getAuthSession()`
- Session includes: `id`, `email`, `role`, `institutionId`
- Archived users blocked via `archivedAt` check

**Internationalization:**
- Server-side: `lib/i18n/server.ts` (`getLocale()`, `getDictionary()`)
- Locale stored in cookie (`LOCALE_COOKIE_NAME`)
- Dictionary passed to components as props

**Rate Limiting:**
- Applied to auth routes via `lib/rateLimit.ts`
- Uses Redis for distributed state

---

*Architecture analysis: 2026-01-18*

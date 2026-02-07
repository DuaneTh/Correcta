# Phase 11: Comprehensive Pre-Production Verification - Research

**Researched:** 2026-02-05
**Domain:** Pre-production verification, QA, security auditing, i18n testing
**Confidence:** HIGH

## Summary

Pre-production verification for Correcta requires a systematic multi-domain audit covering translations, functionality, security, UI consistency, and error handling. The codebase has mature infrastructure for security (CSRF protection, rate limiting, authorization), a complete i18n system with FR/EN dictionaries, a UI Kit component library, and comprehensive role-based access patterns.

Key findings:
- **I18n System:** Complete dictionary-based system with FR/EN translations in `lib/i18n/dictionaries.ts` (1490 lines), covering all user roles and features
- **Security Infrastructure:** Production-ready CSRF tokens, rate limiting (Redis-backed), role-based permissions, attempt integrity checks, input validation throughout API routes
- **UI Kit:** Comprehensive component library in `components/ui/` with Button, Card, EmptyState, Form, Badge, Layout, and more
- **Testing Infrastructure:** Existing test suite for security (csrf, rate-limit, attempt-permissions, security-headers)
- **Error Handling:** Consistent API error responses with 401/403/404/500 patterns, but no Next.js error boundaries yet

**Primary recommendation:** Systematic audit using automated tools for translation completeness, manual security checklist aligned with OWASP 2025, end-to-end testing per role, and UI Kit consistency verification across all pages.

## Standard Stack

### Core Testing Infrastructure
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Node.js test runner | Built-in | Security unit tests | Native to Node 20+, no dependencies |
| tsx | ^4.20.6 | TypeScript test execution | Used in existing test scripts |
| TypeScript | ^5 | Type safety verification | Project language |

### Existing Test Patterns
The project has security tests in `tests/` using Node's built-in test runner:
- `tests/csrf.test.ts` - CSRF token verification
- `tests/rate-limit.test.ts` - Rate limiting logic
- `tests/attempt-permissions.test.ts` - Authorization checks
- `tests/security-headers.test.ts` - HTTP security headers

### Translation Verification
| Tool | Purpose | When to Use |
|------|---------|-------------|
| Manual JSON diff | Find missing keys | FR vs EN dictionary comparison |
| grep/ripgrep | Find hardcoded strings | Search for text not using i18n |
| Pseudo-localization | Layout testing | Replace strings with longer text to catch UI breaks |

### Security Audit
| Standard | Purpose | Authority |
|----------|---------|-----------|
| OWASP Top 10 2025 | Web security checklist | Industry standard |
| OWASP ASVS | Application security verification | Comprehensive framework |
| Next.js Security Checklist | Framework-specific | Official Next.js docs |

## Architecture Patterns

### I18n System Architecture
```
lib/i18n/
├── config.ts          # Locale types, SUPPORTED_LOCALES
├── dictionaries.ts    # Complete FR/EN translations (1490 lines)
└── server.ts          # Server-side dictionary resolution

Pattern: Dictionary object with nested structure
{
  fr: { login: { title: "..." }, common: { ... }, admin: { ... }, student: { ... }, teacher: { ... } },
  en: { login: { title: "..." }, ... }
}
```

**Dictionary structure:**
- `login.*` - Authentication pages
- `common.*` - Shared UI strings (logout, roles, language switcher)
- `admin.institutions.*` - Platform admin institution management
- `admin.platformDashboard.*` - Platform-level dashboard
- `admin.school.*` - School admin pages (users, courses, exams, settings)
- `student.*` - Student flows (courses, exams, attempts, results)
- `teacher.*` - Teacher flows (courses, exams, grading, corrections)

### Security Pattern: Defense in Depth
```typescript
// Pattern used in ALL API routes (e.g., app/api/exams/[examId]/route.ts)
export async function PUT(req: Request, { params }) {
  // 1. Authentication
  const session = await getServerSession(authOptions)
  if (!session?.user) return 401

  // 2. CSRF verification (POST/PUT/DELETE)
  const csrfResult = verifyCsrf({ req, cookieToken, headerToken })
  if (!csrfResult.ok) return 403

  // 3. Authorization - institution check
  if (resource.institutionId !== session.user.institutionId) return 403

  // 4. Permission check - role-based
  const { canEdit } = await getExamPermissions(examId, session.user)
  if (!canEdit) return 403

  // 5. Input validation (Zod schemas in lib/grading/schemas.ts)
  // 6. Business logic with error handling
}
```

### Role-Based Page Access
```
app/
├── student/          # STUDENT role
│   ├── courses/
│   ├── exams/
│   └── attempts/
├── teacher/          # TEACHER, SCHOOL_ADMIN, PLATFORM_ADMIN
│   ├── courses/
│   ├── exams/
│   └── corrections/
├── admin/
│   ├── school/       # SCHOOL_ADMIN or PLATFORM_ADMIN (same institution)
│   └── platform/     # PLATFORM_ADMIN only
├── dashboard/        # Legacy admin routes
└── login/            # Public
```

### UI Kit Component Pattern
```typescript
// Consistent component API (components/ui/Button.tsx)
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'xs' | 'sm' | 'md'
  // + standard HTML button props
}

// Usage across all pages
import { Button } from '@/components/ui/Button'
<Button variant="primary" size="md" onClick={...}>Save</Button>
```

**Available UI Kit components:**
- `Button`, `Badge`, `Card`, `Text`, `Layout`
- `Form`, `SearchField`, `EmptyState`, `StatusBadge`
- `DateTimePicker`, `ConfirmModal`, `Drawer`
- `CsvUploader`, `ImageUpload`, `SegmentedControl`

### Error Handling Patterns

**API Routes (consistent pattern):**
```typescript
try {
  // Business logic
} catch (error) {
  console.error("[API] Error context:", error)
  return NextResponse.json({ error: "User-friendly message" }, { status: 500 })
}
```

**Status code patterns:**
- `400` - Invalid input, malformed request
- `401` - Not authenticated
- `403` - Authenticated but not authorized (CSRF fail, permission fail)
- `404` - Resource not found or archived
- `500` - Server error
- `503` - Service unavailable (rate limit redis down)

**Missing patterns (opportunities):**
- No `app/error.tsx` error boundaries (Next.js recommendation)
- No `app/loading.tsx` loading states (Next.js recommendation)
- No `app/not-found.tsx` custom 404 (Next.js recommendation)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation key validation | Custom script to find missing keys | Manual JSON comparison + grep | Small dictionary size (1490 lines), manual is reliable |
| Security headers testing | Custom header checker | Existing `tests/security-headers.test.ts` | Already implemented and working |
| CSRF testing | Manual token verification | Existing `tests/csrf.test.ts` | Comprehensive test coverage exists |
| API authorization testing | New test framework | Extend existing `tests/attempt-permissions.test.ts` | Pattern established |
| Rate limiting verification | Custom rate limiter | Existing `lib/rateLimit.ts` with tests | Production-ready with Redis fallback |

**Key insight:** The project has mature security and testing infrastructure. Focus on using existing patterns and extending existing tests rather than building new frameworks.

## Common Pitfalls

### Pitfall 1: Missing Translation Keys
**What goes wrong:** User sees untranslated text in production (key name instead of localized string)

**Why it happens:**
- New feature added with hardcoded strings
- Key exists in FR but not EN (or vice versa)
- Copy-paste error with wrong key path

**How to avoid:**
1. Compare FR and EN dictionary structure programmatically
2. Search codebase for string literals in JSX (grep for `"[A-Z]` in .tsx files)
3. Test language switcher on every page

**Warning signs:**
- Seeing key paths like `admin.school.users.actions` in UI
- Mixed French/English on same page
- Console errors about missing dictionary keys

### Pitfall 2: Inconsistent UI Kit Adoption
**What goes wrong:** Some pages use UI Kit, others use raw Tailwind, creating visual inconsistency

**Why it happens:**
- Phase 6 migration was comprehensive but new features may bypass UI Kit
- Developers unaware of available components
- Quick fixes using inline styles

**How to avoid:**
1. Audit all .tsx files in `app/` and `components/` for raw `className` with button/card patterns
2. Check for inline styles (`style={{...}}`)
3. Verify `/internal/ui-kit` page showcases all components

**Warning signs:**
- Button styles differ between pages
- Multiple ways to render the same pattern (e.g., badges)
- Inconsistent spacing, colors, typography

### Pitfall 3: Role-Based Access Gaps
**What goes wrong:** User accesses page/action they shouldn't based on role

**Why it happens:**
- Authorization check only at API level, not page level
- Role check missing in one code path
- Copy-paste error in permission logic

**How to avoid:**
1. Test each page as each role (STUDENT, TEACHER, SCHOOL_ADMIN, PLATFORM_ADMIN)
2. Verify 403 responses for unauthorized actions
3. Check that UI hides actions user can't perform (not just disable)

**Warning signs:**
- Student can view `/teacher/` URLs
- Teacher can access platform admin endpoints
- 403 errors in production logs

### Pitfall 4: CSRF Token Expiry During Long Exams
**What goes wrong:** Student completes 2+ hour exam, submission fails with CSRF error

**Why it happens:**
- CSRF token has 6-hour maxAge (set in `lib/csrf.ts`)
- Token cookie expires during exam
- No refresh mechanism

**How to avoid:**
1. Verify `maxAge: 60 * 60 * 6` in `setCsrfCookie()`
2. Test exam submission after 5+ hours
3. Consider refresh mechanism on exam start

**Warning signs:**
- CSRF failures in logs correlating with long exam durations
- Student complaints about submission failures
- Need to re-login mid-exam

### Pitfall 5: Archived Records Breaking UI
**What goes wrong:** UI shows archived users, courses, or exams that should be hidden

**Why it happens:**
- Query missing `where: { archivedAt: null }` filter
- Archive check in one place but not another
- Cascading archive logic incomplete

**How to avoid:**
1. Audit all Prisma queries for `archivedAt` filter
2. Test archiving a course → verify exams hidden
3. Test archiving a user → verify removed from rosters

**Warning signs:**
- Archived items in dropdowns
- 404 errors when clicking on visible items
- Count mismatches (e.g., "5 exams" but only 3 visible)

## Code Examples

### Translation Usage Pattern
```typescript
// app/teacher/courses/page.tsx
import { getDictionary } from '@/lib/i18n/dictionaries'
import { cookies } from 'next/headers'

const cookieStore = await cookies()
const locale = (cookieStore.get('correcta_locale')?.value as Locale) || 'fr'
const dict = getDictionary(locale)

// Usage in JSX
<Button>{dict.teacher.coursesPage.createExamButton}</Button>
// FR: "Créer un examen"
// EN: "Create exam"
```

### API Route Security Pattern
```typescript
// app/api/exams/[examId]/route.ts
export async function PUT(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params

  // 1. Auth
  const session = await getServerSession(await buildAuthOptions(institutionId))
  if (!session?.user || session.user.role === 'STUDENT') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. CSRF
  const csrfResult = verifyCsrf({
    req,
    cookieToken: getCsrfCookieToken(req),
    headerToken: req.headers.get('x-csrf-token'),
    allowedOrigins: getAllowedOrigins()
  })
  if (!csrfResult.ok) {
    return NextResponse.json({ error: "CSRF" }, { status: 403 })
  }

  // 3. Institution ownership
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { course: true }
  })
  if (exam.course.institutionId !== session.user.institutionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 4. Permission check
  const { canEdit } = await getExamPermissions(examId, session.user)
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 5. Business logic
  const updatedExam = await prisma.exam.update({ where: { id: examId }, data: ... })
  return NextResponse.json(updatedExam)
}
```

### UI Kit Component Usage
```typescript
// Good: Using UI Kit
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'

<Card>
  <EmptyState
    title={dict.teacher.examsPage.emptyStateText}
    action={<Button variant="primary">Create Exam</Button>}
  />
</Card>

// Bad: Raw Tailwind (inconsistent)
<div className="rounded-lg border border-gray-200 bg-white px-6 py-12">
  <button className="inline-flex items-center justify-center rounded-md bg-brand-900 px-4 py-2 text-white">
    Create Exam
  </button>
</div>
```

### Role-Based Page Protection
```typescript
// app/admin/school/page.tsx (Server Component)
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

export default async function SchoolAdminPage() {
  const session = await getAuthSession()

  if (!session?.user) {
    redirect('/login')
  }

  if (!isSchoolAdmin(session)) {
    return <div>Access denied</div>
  }

  // Page content
}
```

## State of the Art

### Next.js 15/16 Production Best Practices (2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual error handling | Error boundaries (`error.tsx`, `global-error.tsx`) | Next.js 13+ | Consistent error UI required for production |
| Custom loading spinners | Loading UI (`loading.tsx`) | Next.js 13+ | Automatic streaming UI |
| Manual 404 pages | `not-found.tsx` per route segment | Next.js 13+ | Accessible, consistent 404s |
| Middleware for auth | Per-route auth checks + middleware | CVE-2025-29927 | Never rely solely on middleware |
| Server Actions without validation | Auth + validation at start of every action | Next.js 15 | Critical security surface |

**Deprecated/outdated:**
- Relying only on middleware for authentication (critical vulnerability)
- Skipping CSRF on Server Actions (required in production)
- Manual caching strategies (Next.js 15 changed defaults)

### OWASP 2025 Security Priorities

**Top priorities for this project:**
1. **Broken Access Control** - Role-based authorization (already strong)
2. **Cryptographic Failures** - HTTPS enforcement, secure cookies (implemented)
3. **Injection** - SQL injection via Prisma (safe by design), XSS in math rendering (need verification)
4. **Insecure Design** - CSRF protection (implemented), rate limiting (implemented)
5. **Security Misconfiguration** - Security headers (implemented in `lib/securityHeaders.ts`)
6. **Vulnerable Components** - Dependency audit needed
7. **Authentication Failures** - Rate limiting on login (implemented), password hashing (bcrypt)
8. **Data Integrity Failures** - Attempt integrity checks (implemented in `lib/attemptIntegrity.ts`)

### I18n Testing 2026 Standards

**Completeness verification:**
1. **Structural parity** - FR and EN must have identical key structure
2. **Pseudo-localization** - Replace strings with `[XXXX]` or extended text to catch layout breaks
3. **Dynamic placeholders** - Verify `{{name}}`, `{{count}}` preserved in translations
4. **Pluralization** - Check `_one`, `_many` variants (not heavily used in this project)
5. **Context-aware** - Math symbols, code snippets should not be translated

**Modern approach:**
- Not just extracting strings, but testing that all UI surfaces use i18n
- Automated detection of hardcoded strings in JSX
- Language switcher functional on every page

## Verification Protocol

### Phase 11 Systematic Audit Checklist

**1. Translation Completeness (VERIF-01)**
- [ ] Compare FR and EN dictionary structures (automated script)
- [ ] Grep all `.tsx` files for hardcoded strings not using `dict.*`
- [ ] Test language switcher on all pages (student, teacher, admin)
- [ ] Verify math symbols not translated
- [ ] Check empty states and error messages translated

**2. Functionality Testing (VERIF-02)**
- [ ] Student flow: Browse courses → Start exam → Submit → View results
- [ ] Teacher flow: Create exam → Build questions → Publish → Grade → Release results
- [ ] School admin flow: Create users → Create courses → Assign enrollments
- [ ] Platform admin flow: Create institution → Configure SSO
- [ ] Edge case: PDF exam import → extract questions → build exam
- [ ] Edge case: Graph editor → draw shapes → save to question

**3. Edge Cases (VERIF-03)**
- [ ] Empty states: No courses, no exams, no students
- [ ] Limit values: 0-point questions, 1000+ student roster
- [ ] Network failures: API timeout handling (mock slow responses)
- [ ] Session expiry: Long exam duration (6+ hours)
- [ ] Archive cascade: Archive course → exams hidden

**4. Security Audit (VERIF-04)**
- [ ] CSRF: Verify all POST/PUT/DELETE routes check CSRF token
- [ ] XSS: Test math input for script injection (MathLive/KaTeX escaping)
- [ ] SQL Injection: Verify all queries use Prisma (no raw SQL)
- [ ] Authorization: Test each role accessing other role's pages
- [ ] Input validation: Test API routes with malformed data
- [ ] Rate limiting: Test auth endpoint with 10+ rapid requests
- [ ] Security headers: Verify CSP, HSTS, X-Frame-Options

**5. UI Kit Consistency (VERIF-05)**
- [ ] All pages use `Button` component (no raw button elements)
- [ ] All pages use `Card`, `Badge`, `StatusBadge` consistently
- [ ] No raw `className` for common patterns
- [ ] Check `/internal/ui-kit` page up-to-date with all components
- [ ] Typography: All text uses `Text` component or consistent Tailwind classes

**6. End-to-End Flows by Role (VERIF-06)**
- [ ] **Student:** Login → View courses → Take exam → Submit → View corrected copy
- [ ] **Teacher:** Login → Create exam with math → Publish → Students submit → Grade all → Release results → Export CSV
- [ ] **School Admin:** Login → Create course → Create section → Import students CSV → Assign to section
- [ ] **Platform Admin:** Login → Create institution → Configure OIDC SSO → Test login

**7. Robustness (VERIF-07)**
- [ ] Error boundaries: Add `error.tsx` to key routes
- [ ] Loading states: Add `loading.tsx` to slow pages
- [ ] Fallbacks: Verify `EmptyState` component used everywhere
- [ ] Timeouts: Test long-running operations (grading 100+ exams)
- [ ] 404 handling: Test invalid IDs, archived resources

**8. Performance & Accessibility (VERIF-08)**
- [ ] Page load times: < 2s on 3G network
- [ ] Math rendering: < 500ms for MathLive initialization
- [ ] Large data: Test 1000+ student courses, 100+ question exams
- [ ] Keyboard navigation: Tab through forms, modals
- [ ] Screen reader: Test with NVDA/JAWS on key flows
- [ ] Color contrast: Verify WCAG AA compliance

### Tools for Verification

**Automated:**
- `npm run typecheck:api` - Type safety verification
- `npm run test:csrf` - CSRF protection tests
- `npm run test:rate-limit` - Rate limiting tests
- `npm run test:security-headers` - HTTP security headers
- `npm run test:attempt-permissions` - Authorization tests
- Lighthouse (in Chrome DevTools) - Performance, accessibility baseline

**Manual:**
- Browser language switcher testing
- Role-based access testing (4 roles × key pages)
- OWASP security checklist walkthrough
- Visual regression (screenshot comparison)

## Open Questions

1. **Error Boundaries**
   - What we know: Next.js recommends `error.tsx` files for error handling
   - What's unclear: Which route segments need error boundaries most urgently
   - Recommendation: Add `app/error.tsx` (global), `app/student/exams/[examId]/error.tsx` (exam taking), `app/teacher/exams/[examId]/builder/error.tsx` (exam builder)

2. **Performance Baseline**
   - What we know: No current performance metrics or targets
   - What's unclear: What defines "acceptable" loading times for this application
   - Recommendation: Run Lighthouse on 5 key pages (student exam, teacher grading, admin dashboard), establish baseline, set targets (> 80 performance score)

3. **Accessibility Compliance Level**
   - What we know: No formal accessibility testing yet
   - What's unclear: Target compliance level (WCAG A, AA, or AAA)
   - Recommendation: WCAG AA for education platform (legal requirement in many jurisdictions), focus on keyboard navigation and screen reader support

4. **Translation Validation Process**
   - What we know: Dictionary is manually maintained, no automated validation
   - What's unclear: Who reviews translations for accuracy (not just completeness)
   - Recommendation: Native speaker review of educational terminology (e.g., "correction", "barème", "copie")

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `lib/i18n/dictionaries.ts`, `lib/auth.ts`, `lib/csrf.ts`, `lib/rateLimit.ts`, `lib/securityHeaders.ts`, `lib/attemptPermissions.ts`
- Existing test suite: `tests/csrf.test.ts`, `tests/rate-limit.test.ts`, `tests/attempt-permissions.test.ts`
- API route patterns: `app/api/exams/[examId]/route.ts` (comprehensive security example)
- UI Kit components: `components/ui/Button.tsx`, `components/ui/EmptyState.tsx`, `components/ui/Card.tsx`
- Project configuration: `package.json`, `prisma/schema.prisma`, `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence)
- [Next.js Production Checklist](https://nextjs.org/docs/app/guides/production-checklist) - Official guidance
- [Next.js 15 Production Checklist](https://srivathsav.me/blog/nextjs-15-production-checklist) - Community 2026 update
- [Building Production-Ready Next.js App Router Architecture](https://dev.to/yukionishi1129/building-a-production-ready-nextjs-app-router-architecture-a-complete-playbook-3f3h) - Comprehensive architecture guide
- [OWASP Web Application Security Testing Checklist](https://github.com/0xRadi/OWASP-Web-Checklist) - Security audit framework
- [OWASP Top 10 2025 Changes](https://www.aikido.dev/blog/owasp-top-10-2025-changes-for-developers) - Latest security priorities
- [Internationalization Testing Best Practices 2026](https://aqua-cloud.io/internationalization-testing/) - i18n audit methodology
- [i18n Testing — A Practical Guide for QA Engineers](https://medium.com/@AntonAntonov88/i18n-testing-a-practical-guide-for-qa-engineers-a92f7f4fc8b2) - Testing techniques

### Tertiary (LOW confidence)
- CVE-2025-29927 referenced in search results (Next.js auth middleware vulnerability) - Need to verify details
- Complete Authentication Guide for Next.js App Router 2025 (Clerk article) - May be vendor-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on existing project infrastructure and test patterns
- Architecture: HIGH - Direct analysis of codebase structure and patterns
- Pitfalls: HIGH - Derived from real code patterns and common issues in similar projects
- OWASP priorities: MEDIUM - Based on 2025 updates but need project-specific risk assessment

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - verification best practices are relatively stable)

**Key risks to validate during planning:**
1. Performance targets need to be defined before baseline can be established
2. Accessibility compliance level should be confirmed with stakeholders
3. Translation accuracy review process needs to be clarified
4. Error boundary placement strategy needs architectural review

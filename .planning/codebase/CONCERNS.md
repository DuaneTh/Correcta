# Codebase Concerns

**Analysis Date:** 2026-01-18

## Tech Debt

**TypeScript Type Safety Bypasses:**
- Issue: Multiple files disable TypeScript checks via `eslint-disable` directives and use `any` types extensively
- Files:
  - `lib/auth.ts` (line 1: disables `@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`, `@typescript-eslint/ban-ts-comment`)
  - `lib/api-auth.ts` (line 1: disables `@typescript-eslint/no-explicit-any`)
  - `lib/antiCheat.ts` (line 1: disables `@typescript-eslint/no-explicit-any`)
  - `lib/auth.ts` (line 290: uses `@ts-ignore` for session.user.provider)
- Impact: Type errors may slip into production, runtime crashes possible from unexpected data shapes
- Fix approach: Define proper TypeScript interfaces for SSO profiles, session types, and NextAuth callbacks; remove eslint-disable directives one file at a time

**Session Type Casting:**
- Issue: Role-checking functions use `any` type for session parameter
- Files: `lib/api-auth.ts` (lines 47, 53, 57, 61, 65)
- Impact: No compile-time protection against passing invalid session objects
- Fix approach: Define a `SessionWithRole` interface and use it across all role-checking utilities

**Large Monolithic Components:**
- Issue: Several client components exceed 1000+ lines, making them difficult to maintain and test
- Files:
  - `components/exams/SegmentedMathField.tsx` (5507 lines)
  - `app/admin/SchoolAdminClient.tsx` (3959 lines)
  - `components/exams/builder/SectionList.tsx` (3290 lines)
  - `components/exams/builder/ExamMetadataHeader.tsx` (1395 lines)
  - `app/admin/school/classes/SchoolClassesClient.tsx` (1001 lines)
  - `app/student/attempts/[attemptId]/ExamRoomClient.tsx` (957 lines)
- Impact: Hard to understand code flow, difficult to unit test, risk of regressions
- Fix approach: Extract logical sub-components, create custom hooks for state management, break into feature-specific modules

**Missing Authentication Check:**
- Issue: TODO comment indicates missing auth check on teacher course detail page
- Files: `app/teacher/courses/[courseId]/page.tsx` (lines 16-17)
- Impact: Any authenticated user could potentially access course details without being the course teacher
- Fix approach: Add `getAuthSession()` and verify user has teacher role with access to the specific course via enrollments

**Incomplete Async Grading Trigger:**
- Issue: TODO comment for triggering grading task after exam submission
- Files: `app/api/attempts/[id]/submit/route.ts` (line 115)
- Impact: Grading may require manual triggering or separate process; exam results not automatically computed
- Fix approach: Implement queue-based grading trigger using existing BullMQ infrastructure in `lib/queue.ts`

## Known Bugs

**None explicitly documented in code comments.**

## Security Considerations

**Console Logging in Scripts:**
- Risk: Seed scripts and utility scripts log sensitive data to console
- Files: `prisma/seed_users.ts`, `prisma/seed_sso.ts`, `prisma/seed.ts`, `scripts/check_attempt_status.ts`, `scripts/create_test_attempt.ts`
- Current mitigation: These are development/utility scripts, not production code
- Recommendations: Ensure scripts are not included in production builds; consider structured logging with redaction

**No Global Middleware:**
- Risk: No Next.js middleware.ts file exists for global request filtering
- Files: Root directory has no `middleware.ts`
- Current mitigation: Each API route implements its own auth, CSRF, and rate-limit checks
- Recommendations: Consider adding middleware for common security headers and basic auth checks; current approach is consistent but verbose

**Rate Limiting Memory Fallback:**
- Risk: In non-production without Redis, rate limiting uses in-memory store that doesn't persist across restarts
- Files: `lib/rateLimit.ts` (lines 79-92)
- Current mitigation: Throws error in production if Redis unavailable
- Recommendations: Current behavior is acceptable; ensure Redis is always available in production

**CSRF Cookie Not HttpOnly:**
- Risk: CSRF token cookie is readable by JavaScript (by design, for SPA pattern)
- Files: `lib/csrf.ts` (line 62: `httpOnly: false`)
- Current mitigation: This is intentional for double-submit cookie pattern; origin validation also performed
- Recommendations: Document this design decision; the implementation is correct for the pattern used

## Performance Bottlenecks

**Large Component Rendering:**
- Problem: SegmentedMathField (5507 lines) handles complex math editing with tables, graphs, and LaTeX
- Files: `components/exams/SegmentedMathField.tsx`
- Cause: All segment types (text, math, table, graph) handled in single component with complex state management
- Improvement path: Memoize sub-components, virtualize long content lists, split into segment-type-specific components

**Translation Dictionary:**
- Problem: Entire dictionary loaded for every locale request
- Files: `lib/i18n/dictionaries.ts` (1370 lines)
- Cause: Monolithic dictionary object with all translations inline
- Improvement path: Split dictionaries by feature/page, implement lazy loading for non-critical translations

**No Database Query Optimization Indicators:**
- Problem: Many `findMany` calls without visible pagination or limits for list views
- Files: Various API routes in `app/api/` (88 occurrences across 22 files)
- Cause: Standard Prisma patterns without explicit performance optimization
- Improvement path: Add pagination to list endpoints, implement cursor-based pagination for large datasets, add database indexes for common query patterns

## Fragile Areas

**Exam Builder State Management:**
- Files:
  - `components/exams/builder/SectionList.tsx`
  - `components/exams/hooks/useExamBuilderData.ts` (1350 lines)
- Why fragile: Complex prop drilling (60+ callback props passed through), optimistic updates for live editing, multiple concurrent update paths
- Safe modification: Always test section/question/segment CRUD operations end-to-end; verify live edit mode works correctly
- Test coverage: No visible unit tests for builder components

**NextAuth Configuration:**
- Files: `lib/auth.ts`
- Why fragile: Dynamic provider configuration based on institution SSO settings, multiple profile normalization paths, role mapping from various claim formats
- Safe modification: Test with all SSO providers (OIDC, SAML), verify role mapping with different claim structures
- Test coverage: No visible unit tests for auth configuration

**Anti-Cheat Copy/Paste Analysis:**
- Files: `lib/antiCheat.ts`
- Why fragile: Event ordering assumptions (COPY must precede PASTE), timestamp-based pairing logic
- Safe modification: Ensure event timestamp ordering is preserved; test with edge cases (multiple rapid copy/paste)
- Test coverage: No visible unit tests

## Scaling Limits

**In-Memory Rate Limiting:**
- Current capacity: Single-instance memory store for development
- Limit: Breaks with horizontal scaling or server restarts
- Scaling path: Redis required for production (already enforced via error throw)

**Session-Based Auth:**
- Current capacity: Standard NextAuth JWT tokens
- Limit: Token refresh and invalidation patterns not visible
- Scaling path: JWT-based sessions should scale horizontally; verify token expiration handling

## Dependencies at Risk

**None identified as critical risks.**

All major dependencies appear to be actively maintained:
- Next.js 16.1.1 (current)
- React 19.2.0 (current)
- Prisma 7.2.0 (current)
- next-auth 4.24.13 (stable, widely used)

## Missing Critical Features

**No Global Error Boundary:**
- Problem: No visible error boundary components for graceful error handling
- Blocks: Users see raw error pages on client-side failures
- Priority: Medium

**No E2E Test Suite:**
- Problem: Only unit tests exist in `tests/` directory (8 test files)
- Blocks: Confidence in full user flows, regression detection
- Priority: High for exam-taking flow

**No Audit Logging for User Actions:**
- Problem: User actions (login, exam submit, grade changes) not systematically logged
- Blocks: Compliance requirements, incident investigation
- Priority: Medium (platform admin audit page exists but scope unclear)

## Test Coverage Gaps

**Exam Builder Components:**
- What's not tested: Section creation, question editing, segment management
- Files: `components/exams/builder/SectionList.tsx`, `components/exams/ExamBuilder.tsx`
- Risk: UI regressions in exam creation flow
- Priority: High

**Authentication Flow:**
- What's not tested: SSO login, role mapping, institution resolution
- Files: `lib/auth.ts`, `lib/api-auth.ts`
- Risk: Auth failures for specific SSO configurations
- Priority: High

**Student Exam Room:**
- What's not tested: Exam start, answer submission, timer behavior
- Files: `app/student/attempts/[attemptId]/ExamRoomClient.tsx`
- Risk: Data loss during exam taking, incorrect submission timing
- Priority: Critical

**Covered by existing tests:**
- Attempt permissions (`tests/attempt-permissions.test.ts`)
- Attempt integrity (`tests/attempt-integrity.test.ts`)
- CSRF protection (`tests/csrf.test.ts`, `tests/csrf-routes.test.ts`)
- Rate limiting (`tests/rate-limit.test.ts`)
- Security headers (`tests/security-headers.test.ts`)
- Institution cookie (`tests/institution-cookie.test.ts`)
- Logging (`tests/logging.test.ts`)

---

*Concerns audit: 2026-01-18*

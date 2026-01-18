# Testing Patterns

**Analysis Date:** 2026-01-18

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`)
- No Jest or Vitest - uses native Node.js testing
- TypeScript tests compiled via tsc before running

**Assertion Library:**
- `node:assert/strict` for assertions

**Run Commands:**
```bash
npm run test:csrf              # Run CSRF tests
npm run test:rate-limit        # Run rate limit tests
npm run test:attempt-permissions  # Run attempt permissions tests
npm run test:security-logging  # Run logging tests
npm run test:institution-cookie  # Run institution cookie tests
npm run test:security-headers  # Run security headers tests
npm run test:attempt-integrity # Run attempt integrity tests
npm run test:ci                # Run all tests for CI (compiles + runs)
```

## Test File Organization

**Location:**
- All tests in dedicated `tests/` directory at project root
- Separate from source code (not co-located)

**Naming:**
- Pattern: `{feature-name}.test.ts`
- Examples: `csrf.test.ts`, `rate-limit.test.ts`, `attempt-permissions.test.ts`

**Structure:**
```
tests/
  attempt-integrity.test.ts
  attempt-permissions.test.ts
  csrf.test.ts
  csrf-routes.test.ts
  institution-cookie.test.ts
  logging.test.ts
  rate-limit.test.ts
  security-headers.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { functionUnderTest } from '../lib/moduleName'

test('descriptive test name', () => {
    // Arrange
    const input = { /* test data */ }

    // Act
    const result = functionUnderTest(input)

    // Assert
    assert.equal(result, expectedValue)
})
```

**Patterns:**
- No `describe()` blocks - flat structure with individual `test()` calls
- Test names are descriptive sentences: `'verifyCsrf allows safe methods without token'`
- Each test is independent and self-contained
- Setup logic repeated per test or in helper functions

## Mocking

**Framework:** No mocking library - manual mocking via environment manipulation

**Patterns:**
```typescript
const withCsrfEnabled = async (fn: () => void | Promise<void>) => {
    const originalEnabled = env.CSRF_ENABLED
    const originalNodeEnv = env.NODE_ENV
    env.CSRF_ENABLED = 'true'
    env.NODE_ENV = 'test'
    await fn()
    // Restore original values
    if (originalEnabled === undefined) {
        delete env.CSRF_ENABLED
    } else {
        env.CSRF_ENABLED = originalEnabled
    }
    if (originalNodeEnv === undefined) {
        delete env.NODE_ENV
    } else {
        env.NODE_ENV = originalNodeEnv
    }
}
```

**What to Mock:**
- Environment variables (`process.env`)
- External service connections (Redis URL deletion forces in-memory fallback)

**What NOT to Mock:**
- Pure functions - test directly
- Business logic modules
- Internal helper functions

## Fixtures and Factories

**Test Data:**
```typescript
const baseContext = {
    attemptStudentId: 'student-1',
    attemptInstitutionId: 'inst-1',
    teacherCanAccess: true
}

// Override specific fields per test
const allowed = canReadAttempt({
    ...baseContext,
    sessionUser: { id: 'student-1', role: 'STUDENT', institutionId: 'inst-1' }
})
```

**Location:**
- Inline in test files
- No dedicated fixtures directory
- Use spread operator to extend base fixtures

**Request Factories:**
```typescript
const makeRequest = (method: string, headers: Record<string, string> = {}) =>
    new Request('https://example.com/api', { method, headers })
```

## Coverage

**Requirements:** None enforced - no coverage targets configured

**View Coverage:**
- No built-in coverage tooling
- Would require adding Node.js `--experimental-coverage` flag

## Test Types

**Unit Tests:**
- Focus on pure functions in `lib/` directory
- Test authorization logic, CSRF verification, rate limiting, logging utilities
- No database or external service dependencies

**Integration Tests:**
- Not present - no database integration tests
- No API route integration tests

**E2E Tests:**
- Not present - no Cypress, Playwright, or similar framework

## Common Patterns

**Async Testing:**
```typescript
test('async operation', async () => {
    await withTestEnv(async () => {
        const result = await asyncFunction('input')
        assert.equal(result.ok, true)
    })
})
```

**Error Testing:**
```typescript
test('rejects invalid input', () => {
    const result = verifyFunction({ invalid: true })
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'expected_reason')
})
```

**Environment Variable Testing:**
```typescript
test('behavior with env var', async () => {
    const env = process.env as Record<string, string | undefined>
    const original = env.SOME_VAR
    env.SOME_VAR = 'test-value'

    // Test logic

    // Cleanup
    if (original === undefined) {
        delete env.SOME_VAR
    } else {
        env.SOME_VAR = original
    }
})
```

## CI Integration

**CI Test Script:** `npm run test:ci`

**Process:**
1. Compile TypeScript tests to `.test-dist/` using `tsconfig.tests.json`
2. Collect all `*.test.js` files from compiled output
3. Run with Node.js test runner: `node --test <files>`

**CI Script Location:** `scripts/run-tests-ci.mjs`

**tsconfig.tests.json:**
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": ".test-dist",
    "module": "commonjs",
    "moduleResolution": "node",
    "types": ["node"],
    "incremental": false,
    "sourceMap": true
  },
  "include": ["tests/**/*.ts", "types/**/*.d.ts"]
}
```

## Test Categories

**Security Tests:**
- `csrf.test.ts`: CSRF token verification (safe methods, token matching, origin checks)
- `csrf-routes.test.ts`: CSRF route-level tests
- `security-headers.test.ts`: Security header generation (HSTS, CSP)
- `rate-limit.test.ts`: Rate limiting enforcement

**Authorization Tests:**
- `attempt-permissions.test.ts`: Access control for exam attempts (role-based, institution scoping)
- `institution-cookie.test.ts`: Institution cookie signing and verification

**Integrity Tests:**
- `attempt-integrity.test.ts`: Nonce verification and idempotency

**Utility Tests:**
- `logging.test.ts`: Email redaction, sensitive data removal

## Adding New Tests

**Steps:**
1. Create `tests/{feature}.test.ts`
2. Import from `node:test` and `node:assert/strict`
3. Import module under test from `../lib/{module}`
4. Write individual `test()` functions
5. Add npm script in `package.json` if needed for direct running
6. Tests auto-discovered by `test:ci` via `.test.ts` pattern

**Template:**
```typescript
import test from 'node:test'
import assert from 'node:assert/strict'
import { myFunction } from '../lib/myModule'

test('myFunction returns expected result for valid input', () => {
    const result = myFunction({ valid: true })
    assert.equal(result.success, true)
})

test('myFunction handles edge case', () => {
    const result = myFunction({ edge: true })
    assert.equal(result.handled, true)
})
```

---

*Testing analysis: 2026-01-18*

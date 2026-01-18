# Coding Conventions

**Analysis Date:** 2026-01-18

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ExamBuilder.tsx`, `SchoolUsersClient.tsx`)
- Client components with suffix: `*Client.tsx` for client-side interactive components
- Utility/lib files: camelCase (e.g., `rateLimit.ts`, `attemptAuthorization.ts`)
- API routes: `route.ts` in Next.js App Router convention
- Test files: `*.test.ts` in dedicated `tests/` directory
- Type definition files: `*.d.ts` in `types/` directory

**Functions:**
- camelCase for all functions (e.g., `canReadAttempt`, `verifyCsrf`, `getAuthSession`)
- Boolean functions: `is*`, `can*`, `has*` prefixes (e.g., `isTeacher`, `canPublish`, `hasPendingLiveEdits`)
- Handler functions: `handle*` prefix (e.g., `handleSave`, `handleArchive`)
- Builder/factory functions: `build*`, `get*` prefixes (e.g., `buildAuthOptions`, `getSecurityHeaders`)

**Variables:**
- camelCase for all variables and parameters
- Boolean variables: `is*`, `has*`, `can*` prefixes (e.g., `isLocked`, `hasValidDuration`)
- Refs: `*Ref` suffix (e.g., `panelRef`, `closeRef`, `drawerReturnFocusRef`)

**Types:**
- PascalCase for all types and interfaces (e.g., `AttemptSessionUser`, `ExamChange`)
- Type parameters: single uppercase letters or descriptive PascalCase (e.g., `T`)
- Props types: `*Props` suffix (e.g., `DrawerProps`, `ExamBuilderProps`)

**Constants:**
- SCREAMING_SNAKE_CASE for module-level constants (e.g., `SENSITIVE_KEYS`, `DEFAULT_COOKIE_NAME`)

## Code Style

**Formatting:**
- No dedicated Prettier config detected - relies on ESLint
- 4-space indentation in TypeScript files
- Single quotes for strings
- No semicolons at end of statements (based on codebase patterns)
- Trailing commas in multiline arrays and objects

**Linting:**
- ESLint 9 with flat config: `eslint.config.mjs`
- Extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Custom script for lint-changed files: `npm run lint` (uses `scripts/lint-changed.mjs`)
- Ignores: `.next/`, `out/`, `build/`, `.test-dist/`, `node_modules/`, `dist/`, `coverage/`, `.turbo/`, `tmp/`

**TypeScript Settings:**
- Strict mode enabled (`strict: true`)
- Target: ES2017
- Module resolution: bundler
- Path alias: `@/*` maps to project root

## Import Organization

**Order:**
1. Node.js built-in modules (`node:test`, `node:crypto`, `node:assert/strict`)
2. External packages (`next/server`, `react`, third-party libraries)
3. Internal absolute imports using `@/` alias (`@/lib/prisma`, `@/components/ui/Drawer`)
4. Relative imports (within same module)

**Path Aliases:**
- `@/*`: Maps to project root for all internal imports
- Use absolute imports for cross-directory references
- Use relative imports only within same directory/module

**Pattern Examples:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'
```

## Error Handling

**Patterns:**
- API routes: try-catch with console.error and NextResponse.json error responses
- Return generic error messages to clients, log details server-side
- Use discriminated unions for result types: `{ ok: true } | { ok: false, reason: string }`

**API Error Responses:**
```typescript
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
return NextResponse.json({ error: "Not found" }, { status: 404 })
return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
```

**Result Types:**
```typescript
type RateLimitResult = {
    ok: boolean
    remaining: number
    reset: number
}
```

**Custom Error Classes:**
```typescript
class AttemptNotEditableError extends Error { }
```

## Logging

**Framework:** `console.log`, `console.error` (no dedicated logging library)

**Patterns:**
- Prefix logs with context: `[API]`, `[Auth]`, `[AdminUsers]`, `[CI]`
- Sensitive data redaction via `safeJson()` from `lib/logging.ts`
- Conditional debug logging controlled by environment variables

**Redaction:**
```typescript
import { safeJson } from '@/lib/logging'
console.log('[Auth] Session data', safeJson(session))
```

**Sensitive Keys Redacted:**
- `email`, `name`, `token`, `access_token`, `id_token`, `refresh_token`
- `profile`, `claims`, `cookie`, `password`, `secret`

## Comments

**When to Comment:**
- Document non-obvious business logic
- Explain security-related decisions
- Mark TODO items with context

**JSDoc/TSDoc:**
- Minimal usage - types are self-documenting
- No comprehensive JSDoc coverage

## Function Design

**Size:** Functions typically 10-50 lines; larger functions split into smaller helpers

**Parameters:**
- Use object parameters for functions with 3+ parameters
- Destructure props in function signature for React components
- Optional parameters with defaults: `options?: { maxAge?: number }`

**Return Values:**
- Explicit return types on exported functions
- Result objects with `ok` boolean for fallible operations
- Async functions return Promise types

**Pattern Examples:**
```typescript
export function canReadAttempt({
    sessionUser,
    attemptStudentId,
    attemptInstitutionId,
    teacherCanAccess
}: AttemptReadContext): boolean {
    // Implementation
}
```

## Module Design

**Exports:**
- Named exports for utilities and functions
- Default exports for React components
- Type exports: use `export type` for type-only exports

**Barrel Files:**
- Not widely used - import directly from specific files
- Types consolidated in `types/` directory

## React Patterns

**Component Structure:**
- `'use client'` directive at top for client components
- Props interface defined before component
- Hooks at top of component body
- Event handlers defined with useCallback when passed to children
- JSX returned at end

**State Management:**
- React useState for local component state
- useRef for DOM references and mutable values
- useMemo for expensive computations
- useCallback for stable function references

**Client Components:**
```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

type ComponentProps = {
    // props
}

export default function Component({ prop1, prop2 }: ComponentProps) {
    const [state, setState] = useState(initialValue)
    // hooks and handlers
    return (
        // JSX
    )
}
```

## API Route Patterns

**Structure:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isSchoolAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
    const session = await getAuthSession(req)

    if (!session || !session.user || !isSchoolAdmin(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Business logic

    return NextResponse.json({ data })
}
```

**Security Checks:**
1. Session authentication via `getAuthSession()`
2. Role authorization via `isTeacher()`, `isSchoolAdmin()`, etc.
3. CSRF verification for mutations via `verifyCsrf()`
4. Rate limiting via `rateLimit()`
5. Input validation inline

## CSS/Styling

**Framework:** Tailwind CSS v4

**Patterns:**
- Utility-first with Tailwind classes
- Brand colors: `brand-900`, `brand-700`, `brand-50`
- Consistent spacing and rounded corners
- Responsive prefixes: `sm:`, `md:`, `lg:`

**Class Organization:**
```tsx
className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
```

---

*Convention analysis: 2026-01-18*

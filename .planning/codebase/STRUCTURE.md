# Codebase Structure

**Analysis Date:** 2026-01-18

## Directory Layout

```
correcta/
├── app/                    # Next.js App Router pages and API routes
│   ├── actions/            # Server Actions (locale switching)
│   ├── admin/              # Admin dashboards (platform & school)
│   ├── api/                # REST API endpoints
│   ├── auth/               # Auth callback pages
│   ├── dashboard/          # Teacher/admin exam management
│   ├── login/              # Login page
│   ├── student/            # Student-facing pages
│   ├── teacher/            # Teacher-specific pages
│   ├── layout.tsx          # Root layout with Providers
│   ├── providers.tsx       # SessionProvider wrapper
│   └── page.tsx            # Landing page
├── components/             # Reusable React components
│   ├── admin/              # Admin UI components
│   ├── exams/              # Exam builder & preview components
│   ├── teacher/            # Teacher-specific components
│   └── ui/                 # Generic UI primitives
├── lib/                    # Shared utilities and business logic
│   ├── i18n/               # Internationalization
│   ├── math/               # Math rendering utilities
│   └── *.ts                # Domain utilities
├── types/                  # TypeScript type definitions
├── prisma/                 # Database schema and migrations
├── public/                 # Static assets
├── scripts/                # Dev/admin scripts
├── infra/                  # Docker compose, Keycloak config
├── tests/                  # Test files
├── styles/                 # Global CSS
└── docs/                   # Documentation
```

## Directory Purposes

**`app/`**
- Purpose: Next.js App Router structure (pages, layouts, API routes)
- Contains: `page.tsx` files for pages, `route.ts` files for API endpoints
- Key files: `layout.tsx` (root), `providers.tsx` (SessionProvider)

**`app/admin/platform/`**
- Purpose: Platform-wide administration (institutions management)
- Contains: Dashboard, system settings, audit logs
- Key files: `page.tsx` (institutions list), `dashboard/page.tsx`

**`app/admin/school/`**
- Purpose: School-level administration (users, classes, enrollments)
- Contains: User management, enrollment management, settings
- Key files: `users/page.tsx`, `enrollments/page.tsx`, `classes/page.tsx`

**`app/api/`**
- Purpose: REST API endpoints
- Contains: Route handlers for CRUD operations
- Key files: `exams/[examId]/route.ts`, `attempts/[id]/route.ts`

**`app/student/`**
- Purpose: Student-facing exam experience
- Contains: Exam listing, attempt taking, results viewing
- Key files: `attempts/[attemptId]/page.tsx` (exam room)

**`app/dashboard/exams/`**
- Purpose: Teacher exam management
- Contains: Exam builder, grading, proctoring views
- Key files: `[examId]/builder/page.tsx`, `[examId]/grading/page.tsx`

**`components/`**
- Purpose: Reusable React components
- Contains: Client and Server Components (Client marked with `'use client'`)
- Key files: `exams/ExamBuilder.tsx`, `ui/Drawer.tsx`, `ui/ConfirmModal.tsx`

**`components/admin/`**
- Purpose: Admin-specific UI components
- Contains: Layout wrappers, resource panels
- Key files: `platform/PlatformAdminLayout.tsx`, `school/SchoolAdminLayout.tsx`

**`components/exams/`**
- Purpose: Exam building and rendering
- Contains: Builder components, preview, math editor
- Key files: `ExamBuilder.tsx`, `ExamPreview.tsx`, `MathEditor.tsx`

**`lib/`**
- Purpose: Shared business logic and utilities
- Contains: Auth, permissions, CSRF, validation, i18n
- Key files: `auth.ts`, `prisma.ts`, `csrf.ts`, `exam-permissions.ts`

**`lib/i18n/`**
- Purpose: Internationalization support
- Contains: Locale detection, dictionary loading
- Key files: `server.ts`, `config.ts`, `dictionaries.ts`

**`types/`**
- Purpose: Shared TypeScript type definitions
- Contains: Domain types for exams, content, validation
- Key files: `exams.ts`

**`prisma/`**
- Purpose: Database schema and migrations
- Contains: Prisma schema, migration history
- Key files: `schema.prisma`, `migrations/*/migration.sql`

**`scripts/`**
- Purpose: Development and administration scripts
- Contains: Seeding, testing, debugging utilities
- Key files: `seed-demo-users.js`, `ai-grading-worker.ts`

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout, global styles import
- `app/page.tsx`: Landing page
- `app/providers.tsx`: NextAuth SessionProvider

**Configuration:**
- `next.config.ts`: Next.js configuration
- `tsconfig.json`: TypeScript configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `eslint.config.mjs`: ESLint configuration
- `prisma.config.ts`: Prisma configuration

**Core Logic:**
- `lib/auth.ts`: NextAuth configuration builder
- `lib/prisma.ts`: Prisma client singleton
- `lib/csrf.ts`: CSRF protection utilities
- `lib/api-auth.ts`: API authentication helpers

**Testing:**
- `tests/*.test.ts`: Test files (run via tsx --test)

**Infrastructure:**
- `infra/docker-compose.yml`: Local dev services (PostgreSQL, Redis)
- `infra/keycloak-realm.json`: Keycloak SSO configuration

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API Routes: `route.ts` (Next.js convention)
- Client Components: `*Client.tsx` suffix (e.g., `SchoolUsersClient.tsx`)
- Components: PascalCase (e.g., `ExamBuilder.tsx`)
- Utilities: camelCase (e.g., `fetchJsonWithCsrf.ts`)

**Directories:**
- Dynamic routes: `[param]` brackets (e.g., `[examId]`)
- Catch-all routes: `[...param]` (e.g., `[...nextauth]`)
- Feature grouping: lowercase (e.g., `admin/`, `exams/`)

**Components:**
- Default export for main component
- Named exports for sub-components/types
- `'use client'` directive at top for Client Components

## Where to Add New Code

**New Feature (e.g., new admin page):**
- Primary code: `app/admin/{area}/{feature}/page.tsx`
- Client component: `app/admin/{area}/{feature}/{Feature}Client.tsx` or `components/admin/{area}/{Feature}.tsx`
- API endpoint: `app/api/admin/{area}/{feature}/route.ts`
- Types: Extend `types/*.ts` or add inline

**New API Endpoint:**
- Implementation: `app/api/{resource}/[{id}]/route.ts`
- Follow pattern: auth check, CSRF verify, business logic, Prisma call

**New Reusable Component:**
- UI primitive: `components/ui/{Component}.tsx`
- Domain component: `components/{domain}/{Component}.tsx`

**New Business Logic:**
- Shared utility: `lib/{feature}.ts`
- Permission function: Add to existing `lib/*-permissions.ts`

**New Page in Existing Area:**
- Create directory: `app/{area}/{page}/`
- Add `page.tsx` (Server Component) and optional `*Client.tsx`

## Special Directories

**`.next/`**
- Purpose: Next.js build output
- Generated: Yes (by `next build` or `next dev`)
- Committed: No (in .gitignore)

**`node_modules/`**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

**`prisma/migrations/`**
- Purpose: Database migration history
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes (required for schema versioning)

**`.planning/`**
- Purpose: Planning and analysis documents
- Generated: By development tooling
- Committed: Optional (project-specific)

**`public/`**
- Purpose: Static assets served at root URL
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-01-18*

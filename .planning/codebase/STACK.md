# Technology Stack

**Analysis Date:** 2025-01-18

## Languages

**Primary:**
- TypeScript 5.x - All application code (frontend, backend, scripts)

**Secondary:**
- JavaScript - Build scripts and configuration (`scripts/lint-changed.mjs`, `scripts/run-tests-ci.mjs`)

## Runtime

**Environment:**
- Node.js 20 (specified in CI workflow `.github/workflows/ci.yml`)
- Next.js 16.1.1 with App Router

**Package Manager:**
- npm (package-lock.json present)
- Lockfile: present, enforced by CI (rejects pnpm-lock.yaml and yarn.lock)

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack React framework with App Router
- React 19.2.0 - UI library
- React DOM 19.2.0 - React rendering

**Testing:**
- Node.js built-in test runner (`tsx --test`) - Unit tests
- tsx 4.20.6 - TypeScript execution for tests and scripts

**Build/Dev:**
- Next.js built-in bundler (Turbopack available, Webpack fallback)
- TypeScript 5.x - Type checking
- ESLint 9.x with eslint-config-next - Linting
- Tailwind CSS 4.x - Styling
- PostCSS - CSS processing

## Key Dependencies

**Critical:**
- `next-auth` 4.24.13 - Authentication (credentials + OIDC/SAML)
- `@prisma/client` 7.2.0 - Database ORM
- `prisma` 7.2.0 - Database migrations and schema
- `@prisma/adapter-pg` 7.2.0 - PostgreSQL driver adapter
- `pg` 8.16.3 - PostgreSQL client

**Infrastructure:**
- `bullmq` 5.64.1 - Job queue for AI grading
- `ioredis` 5.8.2 - Redis client for queue and rate limiting
- `minio` 8.0.6 - S3-compatible object storage client (referenced but not actively used in app code)
- `bcryptjs` 3.0.3 - Password hashing

**UI:**
- `@headlessui/react` 2.2.9 - Accessible UI components
- `lucide-react` 0.554.0 - Icons
- `tailwind-merge` 3.4.0 - Tailwind class merging
- `clsx` 2.1.1 - Conditional class names
- `react-datepicker` 8.10.0 - Date/time picker

**Utilities:**
- `date-fns` 4.1.0 - Date manipulation
- `axios` 1.13.2 - HTTP client
- `mathlive` 0.108.2 - Math equation editor

## Configuration

**Environment:**
- `.env.local` for local development (not committed)
- `env_config` as reference template
- Key required vars:
  - `DATABASE_URL` - PostgreSQL connection string
  - `NEXTAUTH_SECRET` - Session encryption
  - `INSTITUTION_COOKIE_SECRET` - Institution cookie signing (required in production)
  - `CSRF_SECRET` - CSRF token generation
  - `REDIS_URL` - Redis connection (optional in dev, required in production for rate limiting)

**Build:**
- `next.config.ts` - Next.js configuration with security headers
- `tsconfig.json` - TypeScript compiler options (ES2017 target, strict mode)
- `tsconfig.api.json` - API-specific type checking
- `tailwind.config.ts` - Tailwind with custom brand colors
- `prisma.config.ts` - Prisma schema and migrations configuration
- `eslint.config.mjs` - ESLint flat config with Next.js presets

## Platform Requirements

**Development:**
- Node.js 20+
- Docker for infrastructure services (PostgreSQL, Redis, MinIO, Keycloak)
- Scripts: `scripts/start-services.ps1` (Windows) or `scripts/start-services.sh` (macOS/Linux)

**Production:**
- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (required for rate limiting and job queue)
- S3-compatible storage (MinIO or AWS S3)
- Optional: Keycloak for SSO testing

**CI/CD:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Runs: npm ci, test:ci, typecheck:api, build

---

*Stack analysis: 2025-01-18*

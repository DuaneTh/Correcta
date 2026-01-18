# External Integrations

**Analysis Date:** 2025-01-18

## APIs & External Services

**Authentication:**
- NextAuth.js 4.x - Core authentication framework
  - Client: `next-auth` package
  - Config: `lib/auth.ts` (dynamic auth options builder)
  - Endpoint: `app/api/auth/[...nextauth]/route.ts`

**SSO Providers (per-institution):**
- OIDC - OpenID Connect for institutional SSO
  - Config stored in `Institution.ssoConfig` JSON field
  - Supports custom role claim mapping
  - Implementation: `lib/auth.ts` lines 174-199
- SAML (via BoxyHQ) - SAML 2.0 federation
  - Wrapped as OAuth provider
  - Implementation: `lib/auth.ts` lines 200-232

**AI Grading (Stub):**
- Currently a stub implementation in `scripts/ai-grading-worker.ts`
- Returns 70% of max points as placeholder score
- No actual AI provider integrated yet (OpenAI/Anthropic/Gemini APIs not present)
- Queue: `lib/queue.ts` (BullMQ)

## Data Storage

**Databases:**
- PostgreSQL 16+ (primary database)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma ORM with pg adapter (`lib/prisma.ts`)
  - Schema: `prisma/schema.prisma`
  - Migrations: `prisma/migrations/`

**Caching/Queue:**
- Redis 7+
  - Connection: `REDIS_URL` env var (defaults to `redis://localhost:6379`)
  - Usage: Rate limiting (`lib/rateLimit.ts`), Job queue (`lib/queue.ts`)
  - Queue name: `ai-grading`

**File Storage:**
- MinIO (S3-compatible)
  - Package: `minio` 8.0.6 in dependencies
  - Config vars: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`
  - Currently referenced but not actively used in application code

## Authentication & Identity

**Auth Provider:**
- NextAuth.js with Prisma Adapter
  - Session strategy: JWT
  - Custom login page: `/login`
  - Implementation: `lib/auth.ts`

**Credentials Auth:**
- Email/password authentication
- Password hashing: bcryptjs
- Rate limiting: 10 attempts per minute per IP+email

**Multi-tenant SSO:**
- Institution-based SSO configuration
- Cookie-based institution detection (`correcta-institution` cookie)
- HMAC-signed institution cookies (`lib/institutionCookie.ts`)
- OIDC and SAML support per institution

**Role Mapping:**
- Roles from SSO claims mapped to app roles
- Fallback role mappings: faculty/instructor/teacher -> TEACHER, student/alumni -> STUDENT
- PLATFORM_ADMIN role excluded from SSO assignment (security)

## Monitoring & Observability

**Error Tracking:**
- None integrated (console logging only)

**Logs:**
- Console-based logging with sensitive data redaction (`lib/logging.ts`)
- Redacted fields: email, token, password, secret, etc.
- Auth debug mode: `AUTH_DEBUG=true` in development

**Security:**
- Security headers via `lib/securityHeaders.ts`
- CSP (Content Security Policy) configurable via `CSP_ENFORCE`
- CSRF protection: `lib/csrf.ts` with double-submit cookie pattern
- Rate limiting: `lib/rateLimit.ts` with Redis backend

## CI/CD & Deployment

**Hosting:**
- Not specified (Next.js compatible: Vercel, self-hosted, Docker)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Triggers: push, pull_request
- Steps:
  1. Checkout
  2. Setup Node 20
  3. Guard lockfiles (npm only)
  4. Install dependencies (npm ci)
  5. Run tests (npm run test:ci)
  6. Typecheck (npm run typecheck:api)
  7. Build (npm run build)

## Environment Configuration

**Required env vars (production):**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Session encryption key (32+ bytes hex recommended)
- `INSTITUTION_COOKIE_SECRET` - Institution cookie HMAC key (required in production)
- `CSRF_SECRET` - CSRF token secret

**Optional env vars:**
- `REDIS_URL` - Redis connection (required for rate limiting in production)
- `RATE_LIMIT_REDIS_URL` - Override Redis URL for rate limiting
- `RATE_LIMIT_ENABLED` - Set to 'false' to disable rate limiting
- `CSRF_ENABLED` - Set to 'false' to disable CSRF protection
- `CSRF_ALLOWED_ORIGINS` - Comma-separated allowed origins
- `AUTH_DEBUG` - Enable auth debugging (development only)
- `AUTH_ALLOW_DANGEROUS_EMAIL_LINKING` - Allow account linking (development only)
- `CSP_ENFORCE` - Enforce CSP (vs report-only)
- `SECURITY_ALLOW_CAMERA` - Allow camera access (for proctoring)
- `SECURITY_ALLOW_MICROPHONE` - Allow microphone access (for proctoring)

**Secrets location:**
- `.env.local` (local development, not committed)
- Environment variables in production deployment

## Webhooks & Callbacks

**Incoming:**
- NextAuth.js callback endpoints (`/api/auth/callback/[provider]`)
- OIDC/SAML callbacks handled by NextAuth

**Outgoing:**
- None configured

## LMS Integration (Schema Only)

**Planned:**
- `LMSConfig` model in schema for future LMS integration
- Supports: MOODLE, CANVAS (via `lmsType` field)
- LTI 1.3 key storage ready (`ltiKey` field)
- Not yet implemented in application code

## Internationalization

**i18n:**
- Custom implementation in `lib/i18n/`
- Supported locales: French (default), English
- Cookie-based locale preference (`correcta_locale`)
- Dictionary-based translations (`lib/i18n/dictionaries.ts`)

---

*Integration audit: 2025-01-18*

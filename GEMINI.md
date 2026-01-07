# Correcta - Gemini Context

## Project Overview

**Correcta** is a comprehensive exam management platform designed for educational institutions. It facilitates the creation, delivery, and grading of exams with support for rich content (including math), anti-cheat measures, and AI-assisted grading.

**Tech Stack:**
*   **Framework:** Next.js 16 (App Router)
*   **Language:** TypeScript
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Authentication:** NextAuth.js (integrated with Keycloak for SSO in dev)
*   **Styling:** Tailwind CSS 4, Headless UI
*   **Infrastructure:** Docker (PostgreSQL, Redis, MinIO, Keycloak)
*   **Background Jobs:** BullMQ (Redis)

## Building and Running

### Prerequisites
*   Node.js (v20+ recommended)
*   Docker Desktop (must be running)

### Setup & Installation

1.  **Start Infrastructure Services:**
    *   **Windows (PowerShell):** `.\scripts\start-services.ps1`
    *   **Linux/macOS:** `./scripts/start-services.sh`
    *   *Alternatively:* `cd infra && docker-compose up -d`

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Database Setup:**
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

### Development Commands

*   **Start Dev Server:** `npm run dev` (Runs on http://localhost:3000)
*   **Build Production:** `npm run build`
*   **Start Production:** `npm run start`
*   **Lint Code:** `npm run lint`
*   **Run AI Grading Worker:** `npm run worker:ai-grading`
*   **Test AI Queue:** `npm run queue:test-ai`

## Development Conventions

### Directory Structure
*   `app/`: Next.js App Router pages and API routes.
*   `components/`: Reusable React components.
*   `lib/`: Utility functions, business logic, and shared configurations (e.g., `auth.ts`, `prisma.ts`).
*   `prisma/`: Database schema (`schema.prisma`) and seed scripts.
*   `infra/`: Docker Compose configuration and related infrastructure files.
*   `scripts/`: Utility scripts for maintenance, testing, and background tasks.
*   `types/`: TypeScript type definitions.

### Key Domain Concepts (Schema)
*   **Multi-tenancy:** Users and Courses belong to an `Institution`.
*   **Roles:** `PLATFORM_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`.
*   **Exams:** Can have `ExamSections` (formerly question groups) and `Questions` (Text, MCQ, Code).
*   **Attempts:** Track student submissions (`Attempt`), answers (`Answer`), and proctoring events (`ProctorEvent`).
*   **Grading:** Supports manual and potential AI grading via `GradingTask` and `Rubric`.

### Configuration
*   **Environment Variables:** Managed via `.env`. See `env_config` for a reference.
*   **Database:** PostgreSQL running on port 5435 (mapped to 5432).
*   **Object Storage:** MinIO running on ports 9000/9001.
*   **Auth Provider:** Keycloak running on port 8080.

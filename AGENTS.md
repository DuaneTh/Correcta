# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and route handlers.
- `components/`: shared UI and feature components (exam builder, editors).
- `lib/`: server and client utilities (auth, helpers, formatting).
- `types/`: shared TypeScript domain types (exam, segments).
- `prisma/`: Prisma schema and migrations.
- `infra/`: Docker compose and service setup.
- `scripts/`: local workers and utilities (AI queue, grading worker).
- `public/`: static assets; `styles/`: global styles and Tailwind setup.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start Next.js dev server.
- `npm run build`: production build.
- `npm run start`: run production server after build.
- `npm run lint`: run ESLint checks.
- `npx prisma generate`: generate Prisma client.
- `npx prisma migrate dev`: apply local database migrations.
- `.\scripts\start-services.ps1` (Windows) or `./scripts/start-services.sh` (macOS/Linux): start Docker services (Postgres, Redis, MinIO).

## Coding Style & Naming Conventions
- Language stack: TypeScript + React (Next.js 16).
- Indentation: 4 spaces in TS/TSX; match existing files.
- Quotes: single quotes are the common style in TS/TSX.
- Components use `PascalCase`, hooks use `useX` names, utilities use `camelCase`.
- Styling: Tailwind CSS classes; keep class lists readable and avoid inline styles unless necessary.

## Testing Guidelines
- No test framework detected yet.
- If you add tests, keep them close to the feature and document the new command here.

## Commit & Pull Request Guidelines
- Git history only shows an initial commit, so no established convention.
- Suggested commit style: short, imperative, and scoped (example: `Fix exam preview layout`).
- PRs should include a concise summary, testing notes (commands run), and screenshots for UI changes.

## Configuration & Local Services
- Environment variables live in `.env`; `env_config` is a reference template.
- Run Docker services from `infra/` before local dev if you need DB, Redis, or MinIO.

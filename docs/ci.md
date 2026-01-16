# CI

This repo uses GitHub Actions to run tests, typecheck, and build.

## Local commands

- Install: `npm ci`
- Tests (CI runner): `npm run test:ci`
- Typecheck (API/lib only): `npm run typecheck:api`
- Full typecheck (local): `npx tsc -p tsconfig.json`
- Build: `npm run build`
- Seed demo users (dev only): `npm run seed:demo-users`
  - Accounts: `admin@correcta.app`, `admin@demo1.edu`, `prof1@demo1.edu`, `prof2@demo1.edu`, `student1..4@demo1.edu`, `admin@demo2.edu`, `prof1@demo2.edu`, `prof2@demo2.edu`, `student1..4@demo2.edu`
  - Password: `password123`

## Notes

- CI uses `npm ci` and expects `package-lock.json` to be present.
- `node_modules` should not be tracked; CI will fail if it is.
- CI runs tests by compiling TypeScript to `.test-dist/` and executing `node --test` to avoid tsx IPC issues in constrained environments.
- The build avoids fetching Google Fonts by using system font stacks. To reintroduce custom fonts offline, add `.woff2` files to `public/fonts/` and use `next/font/local` in `app/layout.tsx`.
- CI uses Webpack builds (`next build --webpack`) to avoid Turbopack issues in sandboxed/offline environments. Use `npm run build:turbo` locally if you want Turbopack.
- CI typechecks only API/lib/scripts via `tsconfig.api.json`. TODO: re-enable full UI typecheck in CI once the existing UI errors are resolved.
- `package-lock.json` is the source of truth for dependencies; other lockfiles are rejected in CI.

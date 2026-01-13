# CI

This repo uses GitHub Actions to run tests, typecheck, and build.

## Local commands

- Install: `npm ci`
- Tests (CI runner): `npm run test:ci`
- Typecheck: `npx tsc -p tsconfig.json`
- Build: `npm run build`

## Notes

- CI uses `npm ci` and expects `package-lock.json` to be present.
- `node_modules` appears in the repo; CI does not modify it.
- CI runs tests by compiling TypeScript to `.test-dist/` and executing `node --test` to avoid tsx IPC issues in constrained environments.

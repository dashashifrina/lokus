# Repo guidance

## Codebase Map

See `.obvious/codebase-map.md`.

## Rules

<!-- synthesized from: CLAUDE.md, CONTRIBUTING.md (files found in SCAN) -->

- **Tech stack:** Tauri 2.0 desktop app. React 19 + Vite 7 frontend (`src/`), Rust backend (`src-tauri/`), Supabase for optional cloud sync.
- **Package manager:** npm (use `npm install --ignore-scripts` in sandbox — `isolated-vm` native module requires build tools to compile fully).
- **Dev server:** `npm run dev` starts Vite on port 1420 (strictPort). Do NOT use `npm run tauri dev` in sandbox — requires Rust toolchain + GTK/WebKit.
- **Sync system:** Manifest-based (V2, March 2026). Key files: `src/core/sync/SyncEngine.js`, `ManifestManager.js`, `StorageManager.js`. 1 workspace per user, 6h cooldown on switches.
- **Diff algorithm:** `ManifestManager.diff` — local only → UPLOAD; same hash → SKIP; different hash → last-write-wins; remote-only + in syncCache → DELETE; remote-only + not in cache → DOWNLOAD.
- **Do NOT commit:** `.env` (real credentials), `src-tauri/target/` (Rust build artifacts), `dist/`.
- **Tauri APIs in browser:** DeepLink, global shortcuts, and other Tauri-specific APIs will throw in plain browser context. Expected when running `npm run dev` without full Tauri runtime.
- **Plugins:** See `packages/plugin-sdk/`. Plugin execution uses `isolated-vm` for sandboxing (requires native build).
- **Conventional commits:** Use `feat:`, `fix:`, `refactor:`, `docs:`, `test:` prefixes.
- **Tests:** `npm test` (vitest run) — 118/119 suites pass in sandbox (1 suite requires isolated-vm native build). E2E: `npm run test:e2e` (Playwright).

## Local Verification

> **Warning:** Running full-repo typecheck, lint, or tests may OOM or timeout in the sandbox for large repos.
> Use the scoped commands below when verifying changes.

### Verified Commands

- **Lint:** `npx eslint src/` — verified ✅ (0 errors)
- **Test:** `npm test` — verified ✅ (2206 tests pass, 118/119 suites)
- **Typecheck:** not_discovered (no `tsc --noEmit` configured; JSConfig only)

<!-- local-verification-summary:v1 -->
- **Typecheck command:** not_discovered
- **Lint command:** `npx eslint src/` | verified
- **Test command:** `npm test` | verified
- **Scoped typecheck:** not_supported
- **Scoped lint:** `npx eslint src/path/to/file.jsx` | verified
- **Scoped test:** `npx vitest run src/path/to/file.test.js` | verified
- **Full-repo check safe:** yes
- **Scoped alternatives discovered:** yes
<!-- /local-verification-summary -->

### Scoped Workflow

Run these commands to verify changed files without triggering a full-repo scan:

1. **Lint changed files:** `npx eslint src/path/to/file.jsx`
2. **Test changed files:** `npx vitest run src/path/to/file.test.js`

## Sandbox Snapshot

- **Snapshot ID:** `qd7u7m0hhwd2yy8r1cfu:default`
- **Captured:** `2026-06-03T15:12:21.327Z`
- **Dev stack healthy:** yes

## Runbooks

[Populated by autobuild-runbooks skill when requested. See `.obvious/runbooks/` after that skill runs.]

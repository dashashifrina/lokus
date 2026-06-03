---
name: local-dev
version: 1.0.0
description: Bring this repo local development environment up from scratch.
category: local-dev
triggers:
  - local dev setup
  - run repo locally
  - start dev server
  - bring up local stack
author: autobuild-setup
created: 2026-06-03
---

## Prerequisites

- Node.js: v20.x (verified: v20.20.2)
- npm: v10.x (verified: v10.8.2)
- Rust/Cargo: Required ONLY for full Tauri desktop build. NOT available in Obvious sandbox.
- Platform deps for Tauri: GTK3, WebKit2GTK, libssl (Linux). Not needed for Vite-only dev.

## Install

    npm install --ignore-scripts

Note: isolated-vm (plugin sandboxing) will not compile without C++ build tools.
This means 1 test suite (src/core/templates/sandbox-isolated.test.js) fails.
All other 118 suites and 2206 tests pass.

## Environment

All environment variables are optional for local Vite dev.

    cp .env.example .env

Variable | Required for | Can stub
VITE_SUPABASE_URL | Cloud sync | Yes -- app loads without it
VITE_SUPABASE_ANON_KEY | Cloud sync | Yes
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET | Gmail integration | Yes
VITE_SENTRY_DSN / TAURI_SENTRY_DSN | Crash reporting | Yes
VITE_POSTHOG_KEY | Analytics | Yes

Without env vars: app loads, workspace activation runs, no sync/auth/analytics.

## Start

    npm run dev
    # Output: VITE v7.3.1 ready in ~200ms
    # URL: http://localhost:1420/

Verified port: 1420 (strictPort -- fails if port is occupied).

Full Tauri desktop (requires Rust + platform deps -- NOT in Obvious sandbox):
  npm run tauri dev      # Linux
  npm run dev:macos      # macOS
  npm run dev:windows    # Windows

## Verify Primary User Flow

1. Run npm run dev - Vite starts in ~200ms at http://localhost:1420/
2. Open browser to http://localhost:1420/ - HTTP 200 confirmed
3. Page title: Lokus - React app boots, Vite HMR connects
4. Console shows: [vite] connected, [WorkspaceActivation] Starting workspace initialization
5. Expected non-blocking warnings in browser context:
   - Missing Supabase environment variables - sync disabled, app still loads
   - [DeepLink] Failed to setup handler - Tauri API unavailable in plain browser (expected)
   - [PostHog] No API key configured - analytics disabled

Evidence: 01-vite-dev-server-running.png, 02-app-loading.png captured during install.

## Verified Commands

- Typecheck: not_discovered (JSConfig only, no tsc --noEmit configured)
- Lint: npx eslint src/ -- verified (0 errors)
- Test: npm test -- verified (runs vitest, 2206 tests pass)

Additional commands:
- npm run test:e2e - Playwright E2E (requires running app)
- npx eslint src/path/to/file.jsx - scoped lint
- npx vitest run src/path/to/file.test.js - scoped test

## Sandbox Snapshot

- snapshotId: qd7u7m0hhwd2yy8r1cfu:default
- Captured: 2026-06-03T15:12:21.327Z

## Known Blockers / Workarounds

isolated-vm native build fails => Use npm install --ignore-scripts. Affects only plugin sandboxing test suite.
Tauri/Rust build not available in sandbox => Use npm run dev (Vite frontend only). Full desktop build requires Rust + GTK/WebKit.
Supabase not configured => App loads without it -- sync disabled. Add real values to .env for cloud sync.
DeepLink API errors in browser => Expected -- Tauri APIs require native runtime. Non-blocking for frontend dev.
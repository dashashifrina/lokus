# Codebase Map

| Directory | Purpose |
|---|---|
| `src` | React 19 frontend — all UI components, views, hooks, stores |
| `src/components` | Shared UI components (editor, graph, sidebar, modals) |
| `src/core` | Core business logic — sync engine, auth, tasks, MCP server |
| `src/core/sync` | Cloud sync system (SyncEngine, ManifestManager, SyncScheduler, etc.) |
| `src/views` | Top-level page views (Launcher, Editor, Preferences, etc.) |
| `src/features` | Feature modules (canvas, knowledge graph, AI chat, etc.) |
| `src/stores` | Zustand state stores |
| `src/hooks` | Custom React hooks |
| `src/editor` | TipTap/ProseMirror rich text editor integration |
| `src-tauri` | Rust/Tauri 2.0 backend — native OS APIs, file system, deep links |
| `src-tauri/src` | Rust source (build.rs, main entrypoint) |
| `src-tauri/capabilities` | Tauri capability declarations (permissions) |
| `packages/lokus-plugin-cli` | Plugin CLI tooling |
| `packages/lokus-registry` | Plugin registry |
| `packages/plugin-sdk` | Plugin SDK for third-party extensions |
| `supabase` | Supabase DB migrations and config |
| `supabase/migrations` | SQL migration files |
| `tests` | Playwright E2E tests and unit test helpers |
| `scripts` | Build and utility scripts |
| `.github/workflows` | CI — build, test, release pipelines |

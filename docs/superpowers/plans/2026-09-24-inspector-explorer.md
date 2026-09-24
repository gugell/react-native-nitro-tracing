# Inspector Explorer Implementation Plan

> Execute inline using superpowers:executing-plans; the user approved implementation.

**Goal:** Replace the long inspector page with searchable, filterable, sortable exploration and focused detail screens.

**Architecture:** Pure queries build traces and event results from bounded native snapshots. A hook owns queued refreshes and navigation. Shared controls and separate views render that state. No native recording changes.

**Tech Stack:** React Native FlatList, TypeScript, Nitro native snapshots, Jest.

- [x] Create `src/react/explorerModel.ts` and tests. Cover exact correlation, case-insensitive attributes, AND/OR filters, stable duration/time/name sorts, full trace membership, uncorrelated root trees, cycles and collapsed descendants. Use a typed query with search/outcomes/sources/minDuration/from/to/correlation/sort. Never treat numeric metrics as synthetic traces.
- [x] Replace `useTraceViewer.ts` with snapshot/navigation state, recording reset detection, per-mode queries, and pending snapshots. Poll visible views only. Hold incoming updates while paused, editing or showing detail; show pending count and explicit apply. Store inspected records so eviction cannot switch selection.
- [x] Build shared controls/styles and `ExplorerView.tsx`, `DetailView.tsx`, `MetricsView.tsx`. Use FlatList for event and span lists, stable keys, accessible selected/filter state, long-name wrapping and empty-reset guidance. Preserve list offsets with navigation. Trace details retain full membership and collapsed hierarchy; spans link parent/children/whole trace.
- [x] Replace `TraceInspector.tsx` with compact header/status/actions, four destinations, Tools playground, overview links and profile artifact controls. Add translation keys. Export remains all retained data and stops recording; Pause updates never stops capture. Confirm replacing a recording explicitly.
- [x] Add deterministic query tests; run `pnpm test` and `pnpm build`. Package a new version, update the app archive/provenance/lockfile and localization. Run app TypeScript, lint and regression tests.
- [ ] Refresh Metro and verify Pixel search/filter/sort, span/back, collapse, metrics and paused view. Record actual checks and limitations. Commit both repositories locally; do not push.

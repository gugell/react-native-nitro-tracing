# Verification — 2026-09-23

## Automated checks

- Nitro 0.37.1 codegen: all three HybridObjects generated from source.
- TypeScript: library and Expo example pass.
- Jest: 27 tests across plugin lifecycle, clock mapping, Sentry adapter, linear parent ordering, profiler recovery, client lifecycle, playground, viewer models and Expo adapter.
- C++ host tests: parent identity, nested/concurrent spans, errors, cancellation at lifecycle boundaries, idempotence, expiry, budgets, eviction, imported timestamps and JSON escaping.
- Real Sentry 8.27.0 JS tracing engine: completed span capture, parent/child export timestamps and transaction envelopes through an in-memory transport. No network or account required.
- ESM/CJS/declaration build passes. Packed tarball contains native source, generated glue, podspec, all entry points, declarations and license. External production install succeeds without Sentry, Performance, Expo or Nitrogen installed; optional adapter modules import without loading those SDKs.
- Android arm64 debug library and complete Expo development-client APK compile via Gradle with NDK 27.1.
- Full iOS Simulator debug example compiles with Xcode 26.6, React Native 0.85.3 and Expo SDK 56.

## iOS Simulator smoke test

On iPhone 17 Pro / iOS 26.5:

1. Opened Performance inspector from the custom Expo development-menu item.
2. Ran Playground: all six native checks passed (hierarchy, overlapping equal-name operations, cancelled outcome, idempotent end, error outcome, metric values).
3. Opened scenario trace; checked waterfall, durations and outcomes.
4. Checked metric values, sample counts and time range.
5. Stopped and exported a recording: native share sheet showed the JSON file. Cancelled without sending; inspector returned in stopped state and new recording started successfully.
6. Started/stopped Hermes sampling via the release-profiler adapter. Native share sheet showed an 85 KB CPU profile. Cancelled without sending.

## Limits and follow-up validation

- During development, a JS reload while Expo's native share sheet was open caused a simulator crash in Expo's JavaScriptPromise destruction after runtime teardown. Normal presentation/cancellation was retested successfully without reload. Dismiss sharing before Fast Refresh/reload. This is an observed integration limitation, not a verified upstream diagnosis.
- No physical-device overhead, battery, memory or frame-time benchmark is claimed. Host span timings exclude Nitro/JS/UI and cannot predict device performance.
- Android device interaction has not been exercised. Simulator success does not establish release-device compatibility.
- CPU profile symbolication and in-app flamegraphs are not implemented. Sentry native-only telemetry and web/server analytics are not mirrored.
- Playground checks six focused behaviors; it is not a complete destructive lifecycle/overflow scenario matrix. Host/unit tests cover additional lifecycle and retention behavior.
- Publication has not occurred. Choose final package/repository metadata and confirm ownership before a registry release.

## Explorer 0.2.0 (2026-09-24)

Build, package/example TypeScript and all 50 tests passed. Coverage includes filter combinations, correlation grouping, stable sorting, hierarchy cycles/collapse and snapshots above 3,000 retained events. Read-only reviews prompted fixes for mark Similar navigation, metric/detail scroll restoration, queued updates, timeline alignment and eviction notices. The independent example uses safe-area-context 5.7 with a stable root provider and Expo status bar handling. App integration passed all 236 tests and TypeScript; lint has zero errors. Pixel dev-client loading and new screen presence were confirmed; full interaction checks remain pending due concurrent device navigation. The standalone sample was typechecked but not rebuilt on device.

## Inspector overhead correction (0.2.1)

The previous inspector reread all retained native events every second and rerendered its root for stats/pending changes. Cursor reads now preserve unchanged arrays; small Legend State telemetry subscriptions isolate those updates from held content. A React hook regression test verifies no content rerender on a held-view poll, explicit pending application and timer cleanup. Four reader regression cases cover incremental pages, unchanged snapshots and retention eviction. All 55 tests, build and package/example typechecks pass.

The controlled host workload in `benchmarks/2026-09-24-reader.json` compares the previous reader from bc84f1c with the cursor reader: 4,500 retained events, 30 polls adding four events each, ten repetitions. Event objects converted: 136,860 before, 120 after. Node host median loop time: 11.14 ms before, 1.11 ms after. This synthetic reader test excludes native scheduling, React rendering and device frame timing; it cannot establish release UI latency or frame rate.

UI reference inspected: https://github.com/getsentry/sentry-react-native/blob/main/samples/react-native/src/App.tsx uses bottom-tab and native-stack navigation. This inspector follows the separation of destinations, detail screens and modal controls without adding a navigation-container dependency to the host app.

Integration verification: all 236 app tests, app TypeScript, lint with zero errors and Android production bundle export passed. Pixel 7a displayed the updated Metrics and Explore lists with real recording data. Concurrent device navigation prevented reliable sheet/tap/scroll verification; no on-device smoothness or release-overhead claim is made.

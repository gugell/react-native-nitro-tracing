# react-native-nitro-tracing

An on-device performance inspector backed by bounded C++ recordings and Nitro Modules. Inspect nested spans, timings, marks and metric samples, then share a recording through the native share sheet.

This is a new standalone library, with an Expo development-client example. It does not depend on an application repository. Nitro runtime and generator are pinned to **0.37.1**. The example uses React Native 0.85.3 / Expo SDK 56, React 19 and Hermes.

## Install

```sh
pnpm add react-native-nitro-tracing react-native-nitro-modules@^0.37.1 react-native-performance
# For the optional Expo menu and file-sharing adapter:
pnpm exec expo install expo-dev-client expo-file-system expo-sharing
```

Build a native development client after installing native dependencies. Expo Go cannot load this library. The npm name is provisional: this repository has not been published yet; use a packed tarball or workspace dependency until publication.

## Expo development client

Keep the client in your app's setup/service layer. Mount the inspector once alongside the application root. All recorder, viewer, plugin and sharing logic lives in the package.

```tsx
import { createTraceClient } from 'react-native-nitro-tracing/client'
import { TraceInspector } from 'react-native-nitro-tracing/react'
import { createExpoTraceSharing, registerTraceDevMenu } from 'react-native-nitro-tracing/expo'

export const client = createTraceClient({
  ...createExpoTraceSharing(),
  onError: console.warn,
})

// During setup:
await client.start()
if (__DEV__) await registerTraceDevMenu(client)

// Alongside your application root:
<TraceInspector client={client} />

// During teardown:
await client.dispose()
```

The development menu gets a **Performance inspector** item. `client.open()` also opens it, including in an explicitly instrumented release build. The package does not gate itself on `__DEV__`: the consuming app decides when to include it. Registration uses Expo's `registerDevMenuItems`; compose your other custom entries if the app already owns that registration.

The UI offers Summary (issues and topics), Timeline, Explore and Metrics views, search, parent-child waterfalls, span details, and visible retention/truncation information. It polls only while open, with bounded display data. `labels` and `translate` props support localization. Playground generates deterministic examples; it is not an application benchmark.

## Native API

The root export is the direct Nitro API. It does not import Expo, the viewer or Sentry.

```ts
import { Tracing } from 'react-native-nitro-tracing'

const recording = Tracing.startRecording({
  maxEvents: 3000,
  maxBytes: 2 * 1024 * 1024,
  maxActiveSpans: 256,
  spanTimeoutMs: 30 * 60 * 1000,
})
const parent = recording.startSpan({
  name: 'image.process',
  correlationId: 'image-1',
  attributes: [],
})
const child = recording.startSpan({
  name: 'image.decode',
  parentSpanId: parent.spanId,
  correlationId: 'image-1',
  attributes: [],
})
child.end('success')
parent.end('success')
recording.recordMetric({
  name: 'image.bytes',
  value: 4096,
  unit: 'byte',
  correlationId: 'image-1',
  attributes: [],
})
recording.stop()
const json = await recording.exportJson()
recording.dispose()
```

Span handles are unique, so concurrent operations with the same name are safe. Pass parents explicitly; async tasks never rely on a shared current-span variable. `end` is idempotent. Stopping interrupts unfinished spans; disposal releases history. Expiration runs on the next recording operation, not a background timer.

`readEvents({ afterSequence, limit })` returns typed span/mark/metric arrays, an eviction-aware cursor and dropped-event count. Page size is 1–1000. `recordSpan`, `mark` and `recordMetric` accept source timestamps in recording-relative milliseconds. Imported source span IDs let producers preserve parents that complete later.

The optional higher-level client supplies `trace.mark`, `trace.metric`, `trace.measure`, and correlated `trace.measureSince`. These wrappers report instrumentation errors without replacing the measured operation's result or error. Use native span handles for explicit nesting.

## Plugins

| Entry point         | Purpose                                                            | Dependency                                             |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `/performance`      | Observe marks, measures and metrics with their original timestamps | `react-native-performance`                             |
| `/sentry`           | Capture SDK spans locally and/or export retained spans             | Optional injected `@sentry/react-native` 7.11.x or 8.x |
| `/release-profiler` | Manually record and share a Hermes CPU profile                     | Optional injected `react-native-release-profiler`      |
| `/plugins`          | Implement custom sources/exporters                                 | None                                                   |
| `/expo`             | Dev menu and native file sharing                                   | Optional Expo modules                                  |
| `/react`            | Inspector component                                                | React Native                                           |
| `/client`           | Recording lifecycle and UI coordination                            | Performance plugin by default                          |

The client enables React Native Performance by default; use `performance: false` for native-only instrumentation, or inject `{ performance, PerformanceObserver }`. The source library owns its global entry buffer; this plugin never clears another consumer's entries. Configure source retention if your app generates a large volume of marks.

Plugins implement `id` and `start({ recording, reportError })`, returning `stop()` and optionally `flush()`. Cleanup stops producers, freezes native recording, then runs exporters. Failures are isolated and reported. Duplicate plugin IDs are rejected.

### Sentry as a measuring layer

Yes: the optional plugin listens to the installed Sentry client's completed JS spans. SDK sampling and instrumentation determine which spans exist. Local capture does not reproduce server-side aggregation, symbolication, native-only spans or Sentry's web application.

```ts
import * as Sentry from '@sentry/react-native'
import { createSentryPlugin } from 'react-native-nitro-tracing/sentry'

// Initialize Sentry in your application according to its SDK documentation.
const plugin = createSentryPlugin({
  sentry: Sentry,
  captureSpans: true,
  exportSpans: false,
})
const client = createTraceClient({ plugins: [plugin] })
```

Both capture and export default to false. Set `exportSpans: true` to send retained native spans when recording stops. Export preserves measured timestamps and parent relationships; it excludes captured Sentry spans to avoid feedback loops. Only explicitly allowlisted custom attributes are exported (`exportedAttributeKeys`), in addition to names, timing, status and internal linkage fields. The app owns SDK initialization, DSN, sampling, scrubbing and network policy. SDK upload completion is controlled by Sentry, not this plugin. Local metric samples are not exported as Sentry metrics in this version.

### Hermes release profiler

```ts
import * as ReleaseProfiler from 'react-native-release-profiler'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'
const profiler = createReleaseProfilerPlugin(ReleaseProfiler)
const client = createTraceClient({ profiler, ...createExpoTraceSharing() })
```

Attaching the plugin does not start the sampler. Use the inspector's profile controls. Only one plugin can own the process-wide sampler at a time. The returned local profile is shared separately through the OS share sheet. For useful performance measurements use a release build and symbolicate with the profiler's tooling; an in-app CPU flamegraph is not implemented.

## Performance and limits

- Shared C++ recorder with a monotonic clock, bounded event/active-span counts and retained payload budget.
- No fetch monkeypatching, response decoding, per-span console output, automatic replay or continuous profiling.
- Async snapshot/export work; UI updates only while visible. Opening the inspector adds rendering overhead, so close it while measuring workloads.
- `maxBytes` accounts for retained payload/container estimates, not process RSS. Snapshot copies, JS conversions and export strings temporarily allocate additional memory.
- JSON includes schema version, wall-clock anchor, recording-relative timestamps and ordered events. Native sharing writes a temporary cache file and removes it after the share operation. Files may contain the attributes you recorded.
- This version does not provide backend traces, cross-device aggregates, native FPS/CPU/memory sampling, profile symbolication or Sentry web feature parity. Plugins can add sources without changing storage or UI.

## Develop and package

```sh
pnpm install
pnpm codegen
pnpm typecheck
pnpm test
pnpm test:native
pnpm build
pnpm example ios       # or android
pnpm --dir packages/react-native-nitro-tracing pack --pack-destination /tmp
```

Generated Nitro bindings are committed and included in the package. Consumers do not run Nitrogen. `prepack` regenerates bindings and builds CJS, ESM and declarations. Optional integrations live behind separate entry points. The example contains setup and a launcher, not library implementation.

Before publishing, choose the final npm name and repository metadata, confirm ownership/license, run native/device verification and publish under your own npm access. No registry publish or remote repository creation is performed by these scripts.

See [verification notes](docs/verification.md) in the repository for the tested platform matrix and known limitations.

MIT.

### Automatic development profiling

Pass `autoProfile: true` together with a `profiler` to `createTraceClient` to start Hermes sampling on every recording. Stopping, exporting or disposing the recording stops sampling and saves its artifact. Sampling failure is reported without disabling traces. The default remains manual. Enable this explicitly in development; sampling adds overhead and continuous profiles grow until stopped. Use the inspector to stop and share a profile. Do not run another Hermes sampler concurrently.

### Migrating an existing tracer

`client.trace` supports `mark`, `metric`, `measure`, `measureSince` and `clear`. `measure` preserves the work's result or original error; disabled recording still executes the work. `measureSince` deduplicates by measure name and correlation ID, including when a start mark is repeated or another start name is supplied. Several differently named measures may share a start. `clear(id)` resets that operation.

Pass an optional `sink(line, entry)` to `createTraceClient` to retain formatted app logs and structured breadcrumbs. It receives explicit trace calls and observed Performance entries; native/Sentry-imported events stay in the recording without being echoed back as breadcrumbs. Sink failures are reported and never change measured work. String metrics retain their original value in sink output; nonnumeric values appear as native marks. Native attributes are bounded string values; sink attributes keep their original primitive types.

Retention is bounded: the compatibility facade retains up to 512 operation IDs, 64 marks and 64 emitted measure names per ID. Stopping a recording clears correlation state, so restarting cannot create spans across recording boundaries. Native event budgets may evict older history.

### Topics, issues and collectors

The inspector opens on **Summary**. It lists issues first, meaning retained events over a local budget or with errors. Below them is one card per topic: Startup, Screens, Network, Responsiveness, Errors and Custom spans. A topic with no collector configured shows **Not tracked** and names the option that enables it, so a missing signal is not mistaken for a healthy one. Tapping a card opens Explore or Metrics filtered to that topic. **Timeline** lists events newest first, grouped under the screen visit in which they happened. Exports are in the Share (⇪) menu; recording controls, Freeze view and Tools (CPU profile, playground) are in the More (⋯) menu.

```ts
import {
  createErrorsPlugin,
  createNavigationPlugin,
  createNetworkPlugin,
} from 'react-native-nitro-tracing/plugins'

const client = createTraceClient({
  runtimeMetrics: true,
  plugins: [
    createNavigationPlugin(navigationRef), // React Navigation ref or expo-router useNavigationContainerRef()
    createNetworkPlugin(),
    createErrorsPlugin(),
  ],
})

<TraceInspector client={client} budgets={{ requestMs: 800 }} />
```

- **Navigation** records a `navigation.enter` mark and a `screen <name>` visit span per focused route, plus `navigation.transition`: the time from the state change to the second frame callback. This is a render-opportunity estimate, not content readiness.
- **Network** is opt-in. It wraps `XMLHttpRequest.prototype`, which axios and React Native's polyfilled `fetch` use. It also wraps a native global `fetch` (Expo SDK 52+ installs `expo/fetch`; nitro-fetch is also native) unless that `fetch` is the XHR-based polyfill, so no request is counted twice. It records method, URL without query/fragment (with IDs templated to `:id`), status and duration. XHR spans end at `loadend`; native `fetch` spans end when response headers arrive, because the plugin never reads bodies or headers. The originals are restored on stop.
- **Errors** chains `ErrorUtils.setGlobalHandler` and records `js.error` marks, and always calls the previous handler. Set `console: true` to also record `console.error` calls.
- **Responsiveness** uses `runtimeMetrics` and `longtask` entries when React Native's global `PerformanceObserver` supports them.

Default budgets: app ready 2000 ms, screen transition 1000 ms, request 1000 ms, JS stall 250 ms. These are local triage thresholds, not production percentiles.

### Measurement layers: native, Sentry or both

Performance signals use one shared metric vocabulary, so topics, issues, the live overlay and exports work the same whichever provider produces them. Every sample carries a `source` attribute.

| Metric                                               | `createNativeMetricsPlugin()` (`source=native`)                  | `createSentryPlugin({ captureSpans: true })` (`source=sentry`) |
| ---------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `ui.fps`, `ui.frame_gap.max`                         | Main-thread CADisplayLink / Choreographer windows                | —                                                              |
| `ui.frames.slow`, `ui.frames.frozen`                 | Gap > 1.5× display interval / ≥ 700 ms                           | Sentry nativeFrames span data (`ui.frames.total` too)          |
| `process.cpu` (% of one core), `process.memory` (MB) | Sampler thread: `getrusage`, iOS physical footprint, Android RSS | —                                                              |
| `app.start.cold`, `app.start.warm`                   | —                                                                | Sentry appStart spans                                          |

The native plugin runs one C++ thread per recording (default window 1000 ms). Frame callbacks run on the main thread only while sampling is active, and there is no per-frame JS work. Display callbacks measure main-thread availability at each vsync; they do not measure GPU or compositor time. Background windows report no frame metrics.

```ts
createTraceClient({
  plugins: [
    createNativeMetricsPlugin({ intervalMs: 1000 }),
    createSentryPlugin({ sentry: Sentry, captureSpans: true }),
  ],
})
```

### Exporting traces

`recording.exportTraceEvents()` serializes the retained history as Chrome Trace Event JSON, off the JS thread. Open it at [ui.perfetto.dev](https://ui.perfetto.dev) or `chrome://tracing`:

- Spans become lanes per source (`network`, `navigation`, `app`…), and concurrent spans get extra lanes so nesting stays valid.
- Marks and flags become instant events.
- Metrics become counter tracks (FPS, CPU, memory, stalls) aligned on the same clock.

`client.shareTrace('perfetto')` shares a snapshot without stopping the recording. The overlay's **Share trace** button and the inspector's Share menu both use it. `client.export()` still stops the recording and shares the lossless recording JSON. Custom `share(recording, format)` adapters receive `'recording'` or `'perfetto'`. The overlay's **Flag** button records a `flag` mark, so testers can pin the moment they saw a problem before sharing.

### Live overlay

`<TraceOverlay client={client} />` from `/react` adds a draggable bubble showing JS frame-callback FPS; it turns red when the current screen has issues. Tap the bubble to open a **non-modal** sheet: the app stays usable above it, and the sheet streams the current screen visit (time on screen, requests, stalls, errors, and events newest first). Drag or tap to switch between the peek and half heights. Drag up, tap Inspector, or long-press the bubble to open the full inspector. Mount it last at the app root, next to `<TraceInspector />`. It appears below the app's own native modals. The app decides who sees it, for example internal or UAT builds only. It polls the recording once a second while the full inspector is closed.

### Core metrics

Set `runtimeMetrics: true` on `createTraceClient` to collect foreground JS event-loop timer delay, frame-callback rate, maximum frame-callback gap and gap counts over 50 ms. Defaults to a one-second reporting window, with no per-frame native writes. `runtimeMetrics: { intervalMs: 2000, frames: false }` reduces collection. These measure JS scheduling, not native UI FPS/dropped frames or CPU utilization; background windows are discarded. Dev mode, sampling, logs and inspector rendering affect these values.

`useAppReadyMetric(client, ready)` from `/react` records `app.ready.after_tracer_init` once after the consumer reports readiness and a frame callback runs. It measures elapsed time from client creation, excludes earlier JS work and native process launch, and does not certify TTI, TTID or TTFD. A fresh client/launch is needed to measure again after clearing history.

Metrics show the whole recording rather than the selected trace. Explicit samples remain native/exportable events; `duration:` series and outcome statistics are derived from retained spans in the viewer. Duration series include successful/error outcomes; cancelled/interrupted spans are counted separately. Latest, median, min, max and nearest-rank p95 use retained samples (charts show the most recent 40). Retention eviction can bias statistics. Missing data is not reported as zero.

Next collectors: native frame deadlines and frozen frames, process memory, CPU utilization, native app-start/first/full display boundaries, and per-screen readiness. These are not inferred from JS callback rates.

### Inspector navigation (0.2)

Summary triages issues and topics; Timeline groups events by screen visit; Explore has separate Traces, Spans and Marks lists with search, outcome/source filters, duration/time bounds, exact correlation and sorting. Selecting a trace opens its full hierarchy; selecting a span exposes attributes and parent/child navigation. Metrics supports category/search/sort and focused charts. The More (⋯) menu holds recording controls and Tools (CPU profile and playground); Share (⇪) exports.

Pause updates freezes the displayed snapshot, not collection. Interacting with lists/details queues new events until applied. Stop ends collection; Stop and export shares all retained events, regardless of filters. Starting over asks before replacing history.

The `/react` entry point requires the optional peers `react-native-safe-area-context` (5.7 or later within major version 5) and `@legendapp/list` 3.x. The root, `/client` and `/plugins` entry points need neither. Install them with `npx expo install react-native-safe-area-context @legendapp/list`. The inspector owns a modal safe-area provider; the example uses a stable root provider with initial window metrics, a scrollable responsive launcher and Expo StatusBar. Development in the example enables runtime metrics and automatic Hermes profiling.

### Inspector overhead (0.2.1)

Explorer, metric and trace-detail lists use LegendList 3.4.0. A small `useSyncExternalStore` store owns live counters and queued-update metadata; only status/eviction indicators subscribe to those values. Navigation and draft controls remain local React state. Native snapshots use sequence cursors to transfer only newly retained events and trim evicted history. Unchanged event arrays retain identity, and metrics/outcome aggregation is limited to screens that display it. Search uses deferred queries; it still executes on the JS thread.

Bottom navigation switches destinations, details show one selection, Share and More open native menus, and Filters open a separate sheet. Trace filters are drafts: Apply commits them, Cancel discards them. Pause updates holds the content snapshot while recording continues. This reduces observer work; continuous Hermes sampling and development logging still have their own overhead.

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

The UI offers Overview, Traces, Metrics and Playground tabs, search, parent-child waterfalls, span details, and visible retention/truncation information. It polls only while open, with bounded display data. `labels` and `translate` props support localization. Playground generates deterministic examples; it is not an application benchmark.

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

Native builds and iOS simulator flows were checked; device overhead and Android UI remain to be validated. During development, dismiss the native share sheet before reloading JavaScript.

MIT.

# react-native-nitro-tracing

An in-process native trace recorder for React Native, built with Nitro 0.37.1.
A shared C++ core owns bounded recordings. JS and native producers can record
spans, marks and numeric metrics; optional plugins supply additional measurements.
There are no per-event native-to-JS callbacks.

## Workspace setup

```sh
pnpm install
pnpm --dir packages/react-native-nitro-tracing nitrogen
pnpm --dir packages/react-native-nitro-tracing typecheck
pnpm --dir packages/react-native-nitro-tracing test
pnpm --dir packages/react-native-nitro-tracing test:native
```

The app must include this native package and rebuild iOS/Android. It cannot be
installed into an existing binary through an OTA update or used in Expo Go.
Generated Nitrogen files follow this repository's ignore policy and are recreated
by postinstall/codegen. Do not edit generated bindings.

## Record native spans

```ts
import { Tracing } from 'react-native-nitro-tracing'

const recording = Tracing.startRecording({
  maxEvents: 3000,
  maxBytes: 2 * 1024 * 1024,
  maxActiveSpans: 256,
  spanTimeoutMs: 30 * 60 * 1000,
})
const span = recording.startSpan({
  name: 'upload.transfer', correlationId: 'upload-42', attributes: [],
})
try {
  await transfer()
  span.end('success')
} catch (error) {
  span.end('error')
  throw error
}
recording.recordMetric({
  name: 'upload.queueDepth', correlationId: '', attributes: [], value: 3, unit: 'count',
})
const page = await recording.readEvents({ afterSequence: 0, limit: 250 })
recording.stop()
const json = await recording.exportJson()
recording.dispose()
```

The low-level native API reports invalid arguments. An app instrumentation adapter
should isolate diagnostic failures so they cannot replace business errors/results.
A host-app adapter does this. Same-name spans receive independent native IDs. Pass a
parent's `spanId` as `parentSpanId` for nested work. `recordSpan` imports completed
measurements with explicit timestamps; source-qualified IDs preserve relationships
when imported children finish before their parents.

All local timestamps are monotonic milliseconds from recording creation. The
session includes a Unix-millisecond wall-clock anchor for export. Never compare raw
JS and native clocks without translating their origins. Imported timestamps must
be finite and nonnegative. Source importers skip measurements predating the session.

## Configurable plugins

The native package root has no runtime dependency on Sentry or the profiler.
Plugin entry points receive dependencies explicitly:

```ts
import performance, { PerformanceObserver } from 'react-native-performance'
import { startPlugins } from 'react-native-nitro-tracing/plugins'
import { createPerformancePlugin } from 'react-native-nitro-tracing/performance'

const plugins = startPlugins(recording, [
  createPerformancePlugin({ performance, PerformanceObserver }),
], console.error)

// Disconnect sources, freeze native history, then flush optional exporters.
await plugins.stop()
```

The app enables the performance plugin by default; `performance: false` disables it
and `plugins: [...]` adds integrations in `setupPerformanceTracing`. Performance
entries preserve measured start/duration and source timestamps. The observer never
clears another consumer's performance buffer. Producers still own that source
buffer's retention; the native recorder bounds only its own copy. Do not configure
multiple collectors for the same instrumentation unless duplicate data is intended.

### Optional Sentry measurement and export

```ts
import * as Sentry from '@sentry/react-native'
import { createSentryPlugin } from 'react-native-nitro-tracing/sentry'

const sentryPlugin = createSentryPlugin({
  sentry: Sentry,
  captureSpans: true, // local SDK spanEnd measurements; SDK sampling still applies
  exportSpans: false, // explicitly enable only when external export is intended
  exportedAttributeKeys: [],
})
```

Both directions default to disabled. Sentry remains app-initialized. Capture uses
public SDK span lifecycle hooks and maps source parents into native IDs. It is not
a copy of all Sentry server-side processing or fleet aggregates. Export runs when
plugins stop, preserving recorded start/end timestamps and parent handles. Only
retained spans are exported; missing/evicted parents are marked. SDK sampling and
transport still control delivery. Explicitly allowlist sanitized custom attributes;
span names and timings are exported when `exportSpans` is enabled. Sentry-origin
spans and exporter-marked spans are excluded from feedback loops. Metrics remain
local in this version; the Sentry exporter sends completed spans, not time series.

### Optional Hermes release profiler

```ts
import * as ReleaseProfiler from 'react-native-release-profiler'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'

const profiler = createReleaseProfilerPlugin(ReleaseProfiler)
const plugins = startPlugins(recording, [profiler], console.error)
profiler.startProfiling() // explicit: attaching a plugin never starts sampling
const artifactPath = await profiler.stopProfiling()
await plugins.stop()
```

One profiling session is owned process-wide by these plugin instances. The artifact
stays on device and is not inserted into telemetry attributes. The app offers native
file sharing. Hermes profiling is intended for release-build performance work; it
can be unavailable in some debug builds. Raw profiles require source-map processing
for useful symbolication; use the release-profiler CLI and tools such as Perfetto
or Speedscope for deep stack analysis. The in-app viewer shows the profile interval
and sharing controls, not a symbolicated CPU flame graph.

## In-app inspector

In the host app's development client, open **Performance inspector** in the Expo dev
menu. The modal keeps underlying screens mounted. Inspect correlated waterfalls,
span outcomes/attributes, numeric charts and point events. A secondary playground
creates real native records for manual and automated validation. UI polling runs
only while visible and its snapshots are bounded.

Export writes a versioned JSON file into app cache and opens the native iOS/Android
share sheet using Expo Sharing. Temporary JSON is cleaned after the share sheet
returns. Hermes profile artifacts can be shared separately. Sharing does not
require Sentry. Development menu access is not available in a release build; a
release profiling workflow must expose an explicitly gated app entry point.

## Retention and limits

Completed events and active-span payloads share `maxBytes`; event and active-span
counts also have caps. Retained bytes are conservatively accounted payload storage,
not process RSS or a guarantee about allocator/snapshot overhead. Reads/export make
bounded snapshots; avoid issuing unlimited parallel exports. Capacity rejection
returns a non-recording span (`recorded: false`); evictions and rejections increment
`droppedEvents`. Pages expose `earliestSequence` so callers detect missing history.
Expiry runs on recorder access, with no idle background timer. Stop closes active
spans as interrupted and freezes history. Dispose releases retained data. Live
active spans are counted but only completed spans appear in event pages.

Native workers can use `cpp/core/Recorder.hpp` directly; the app's background upload
engine is not automatically instrumented. JS-origin timings cannot observe native
work while JS is suspended. History is in memory and does not survive process death.
True native UI FPS, process CPU/memory collectors and durable recording are separate
capabilities, not inferred from JS timing or configured camera FPS.

## Verification

Colocated plugin tests use fake SDKs and never send data. Native tests exercise the
real C++ recorder and concurrent producers. Host microbenchmarks exclude Nitro/JS
conversion and are not device performance claims. The workspace verification notes
record which actual native builds/device checks were possible.

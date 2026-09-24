# Collectors

Collectors are plugins that write into the active recording. Pass them in `plugins`, or use the client flags for the built-in ones. Each is opt-in, and each records with a `source` attribute, which the inspector and the Perfetto export use to group events.

| Collector        | Enable                                       | Records                                                                                       | Topic                     |
| ---------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------- |
| Native metrics   | `createNativeMetricsPlugin()`                | `ui.fps`, `ui.frame_gap.max`, `ui.frames.slow/frozen`, `process.cpu`, `process.memory`        | Responsiveness, Resources |
| Runtime metrics  | `runtimeMetrics: true`                       | `js.event_loop.delay`, `js.frame_callback.rate`, `js.frame_gap.max`, `js.frame_gap.over_50ms` | Responsiveness            |
| Navigation       | `createNavigationPlugin(ref)`                | `navigation.enter`, `screen <name>`, `navigation.transition`                                  | Screens                   |
| Network          | `createNetworkPlugin()`                      | `<METHOD> <url template>` spans                                                               | Network                   |
| Errors           | `createErrorsPlugin()`                       | `js.error` marks                                                                              | Errors                    |
| Performance API  | on by default (`performance: false` to skip) | Your `performance.mark`/`measure` entries, `js.longtask`                                      | Custom, Responsiveness    |
| Sentry           | `createSentryPlugin({ captureSpans: true })` | Sentry spans, `ui.frames.*`, `app.start.cold/warm`                                            | All                       |
| Release profiler | `profiler: createReleaseProfilerPlugin(api)` | `hermes.profile` spans, `hermes.profile.saved` marks                                          | —                         |

All plugins are imported from `react-native-nitro-tracing/plugins`, except `/performance`, `/sentry` and `/release-profiler`, which have their own entry points so their SDKs load only when used.

## Native metrics

```ts
createNativeMetricsPlugin({ intervalMs: 1000, frames: true })
```

A C++ sampler thread writes one window per `intervalMs` (250–60000, default 1000), with no per-frame JS work.

| Metric             | Unit  | Meaning                                                                          |
| ------------------ | ----- | -------------------------------------------------------------------------------- |
| `ui.fps`           | fps   | Main-thread display callbacks per second (CADisplayLink / Choreographer)         |
| `ui.frame_gap.max` | ms    | Longest gap between display callbacks in the window                              |
| `ui.frames.slow`   | count | Gaps over 1.5× the display interval                                              |
| `ui.frames.frozen` | count | Gaps of 700 ms or more                                                           |
| `process.cpu`      | %     | Process CPU time over the window, in % of one core (`getrusage`; can exceed 100) |
| `process.memory`   | MB    | iOS physical footprint; Android resident set size                                |

Frame callbacks run only while sampling is active. They measure main-thread availability at each vsync, not GPU or compositor time. Background windows report no frame metrics. `frames: false` keeps CPU and memory only.

## Runtime metrics

```ts
createTraceClient({ runtimeMetrics: { intervalMs: 1000, frames: true } })
```

Foreground JS scheduling: timer delay (`js.event_loop.delay`), `requestAnimationFrame` callback rate and longest gap, and the number of gaps over 50 ms. These measure the JS thread, not native UI frames. A JS stall issue is raised when a gap exceeds the `stallMs` budget. Dev mode, logging and an open inspector all affect these values.

## Navigation

```ts
createNavigationPlugin(navigationRef) // React Navigation ref, or expo-router's useNavigationContainerRef()
```

For each focused route it records:

- a `navigation.enter` mark;
- a `screen <name>` visit span, which the Timeline uses to group events;
- `navigation.transition`: the time from the state change to the second frame callback. This estimates when the screen first had a chance to render; it does not mean its content is ready.

It listens to `ready` as well as `state`, so the initial route is captured. It waits for `isReady()` before reading the route.

For tab containers that are not a React Navigation navigator:

```ts
import { createScreenTracker } from 'react-native-nitro-tracing/plugins'

export const screens = createScreenTracker('Home')
createNavigationPlugin(screens)
// when the tab changes:
screens.setScreen('Upload')
```

## Network

```ts
createNetworkPlugin({ ignore: (url) => url.includes('sentry.io') })
```

- Wraps `XMLHttpRequest.prototype`, which backs axios and React Native's polyfilled `fetch`.
- Also wraps a native global `fetch` (Expo SDK 52+ installs `expo/fetch`), unless that `fetch` is the XHR-based polyfill, so no request is counted twice.
- Records method, URL without query or fragment (IDs templated to `:id` by `urlTemplate`), status and duration.
- XHR spans end at `loadend`. Native fetch spans end when response headers arrive: the plugin never reads bodies or headers.
- Metro symbolication requests are ignored by default.
- The original implementations are restored when the recording stops.

Transfers made in native code (OkHttp, URLSession, upload engines) are invisible to it. Record those from your native module's events. A plugin like the example below turns each engine job into an `upload.part` span.

## Errors

```ts
createErrorsPlugin({ console: false })
```

Chains `ErrorUtils.setGlobalHandler`, records a `js.error` mark with the message, then always calls the previous handler. `console: true` also records `console.error` calls; it is off by default because libraries log non-fatal noise there.

## Performance API

On by default. The client observes `react-native-performance` when it is installed, otherwise React Native's global `performance`. Marks and measures keep their original timestamps. `longtask` entries become `js.longtask` spans where `PerformanceObserver` supports them. Pass `performance: false` for native-only instrumentation, or inject `{ performance, PerformanceObserver }`.

The source library owns its entry buffer. This plugin never clears another consumer's entries, so configure that library's own retention if the app records many marks.

## Sentry as a measurement layer

```ts
import * as Sentry from '@sentry/react-native'
import { createSentryPlugin } from 'react-native-nitro-tracing/sentry'

createSentryPlugin({ sentry: Sentry, captureSpans: true, exportSpans: false })
```

Native metrics and Sentry share one metric vocabulary. Topics, issues, the overlay and exports work the same whichever produces them, and teams choose one layer or run both. Every sample carries `source=native` or `source=sentry`.

| Metric                               | Native metrics           | Sentry                                       |
| ------------------------------------ | ------------------------ | -------------------------------------------- |
| `ui.fps`, `ui.frame_gap.max`         | Display callback windows | —                                            |
| `ui.frames.slow`, `ui.frames.frozen` | Gap thresholds           | nativeFrames span data (+ `ui.frames.total`) |
| `process.cpu`, `process.memory`      | Sampler thread           | —                                            |
| `app.start.cold`, `app.start.warm`   | —                        | appStart spans                               |

- **Capture** (`captureSpans`) listens to the installed Sentry client's completed JS spans. SDK sampling decides which spans exist.
- **Export** (`exportSpans`) sends retained native spans to Sentry when recording stops. It keeps timestamps and parents, and it skips spans that came from Sentry, so nothing loops. Only attributes listed in `exportedAttributeKeys` are exported.
- Both default to `false`.
- The app owns SDK initialization, DSN, sampling and scrubbing.

## Release profiler

```ts
import * as ReleaseProfiler from 'react-native-release-profiler'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'

createTraceClient({ profiler: createReleaseProfilerPlugin(ReleaseProfiler) })
```

Attaching the plugin does not start sampling. Profiles start from:

- **Flag**: a bounded window, `flagProfileMs`, default 10000.
- The inspector's **Tools**.
- `autoProfile: true`, which samples every recording. Avoid it in development; see [troubleshooting](troubleshooting.md#the-app-aborts-on-reload-while-profiling).

Only one plugin can own the process-wide Hermes sampler. Each profile appears as a `hermes.profile` span. A `hermes.profile.saved` mark carries the `.cpuprofile` path, and `shareProfile()` shares the file.

## Writing a collector

```ts
import type { TracePlugin } from 'react-native-nitro-tracing/plugins'

export function createUploadEnginePlugin(uploader: Uploader): TracePlugin {
  return {
    id: 'upload-engine',
    start({ recording, reportError }) {
      const unsubscribe = uploader.on('completed', (job) => {
        try {
          recording.recordSpan({
            name: `upload.part #${job.part}`,
            correlationId: job.uploadId, // joins the app's upload trace
            timestampMs: job.startedAt,
            durationMs: job.duration,
            outcome: 'success',
            attributes: [{ key: 'source', value: 'upload-engine' }],
          })
        } catch (error) {
          reportError(error)
        }
      })
      return { stop: unsubscribe }
    },
  }
}
```

- A plugin has an `id` and `start({ recording, reportError })`, which returns `stop()` and optionally `flush()`.
- IDs must be unique.
- Failures are isolated and reported, and never reach the measured code.
- Use `correlationId` to join an existing trace. Use `sourceSpanId` / `sourceParentSpanId` to nest under spans that another source records, even when the parent finishes later.
- Keep source span IDs unique per event. Two events with one ID collapse into one span.

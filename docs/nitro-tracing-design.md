# Native tracing module proposal

Status: proposed for review, 2026-09-23. Supersedes the JS-owned recorder in
[the initial investigation](./tracing-devtools-investigation.md).

## Package and ownership

Create `packages/react-native-nitro-tracing`, a reusable library with no host-app,
Sentry, Expo or navigation dependency in its native recording core. Use the repo's
Nitro/Nitrogen 0.37.1 catalog versions and generated bindings. The existing app is
the integration example; a second example app is unnecessary for this repository.

The native module owns clocks, spans, events, metric samples and retained history.
React renders a separately imported viewer; the app owns dev-menu registration,
redaction policy and domain instrumentation. Existing the host app's perf package callers
migrate through an adapter, with the native recorder becoming the source of truth.

## Implementation choices

| Approach | Benefit | Cost |
| --- | --- | --- |
| Shared C++ recorder and Nitro API, platform collectors added separately | One implementation for correlation, retention, timestamps and queries | Native platform collectors require explicit integration with the shared core |
| Swift and Kotlin recorders | Matches the existing upload module's language split | Duplicates the most correctness-sensitive recorder behavior and tests |
| JS recorder behind a thin Nitro clock | Smallest migration | Does not satisfy the intended native ownership |

Recommend the shared C++ recorder. It implements Nitrogen-generated specs on both
platforms. Keep any later platform sampling and OS integration out of the recorder.
Nitro supports native stateful objects and factory-returned objects, so session and
span lifetimes can be explicit rather than global JS maps.
[Official HybridObject documentation](https://nitro.margelo.com/docs/concepts/hybrid-objects).

## First complete deliverable

- Native recording sessions with bounded history, monotonic durations, unique span
  IDs, explicit parent relationships, outcomes, marks and numeric metrics with units.
- Multiple simultaneous operations with the same name, including multipart uploads.
- Bounded snapshot reads for the viewer and asynchronous versioned JSON export.
- Existing perf instrumentation adapted to the new module; keep Sentry reporting
  independently configured and preserve operation return values/errors.
- Dev-client **Open traces & metrics** entry; root modal with timeline, filters,
  metric charts, record/stop controls and export. Retain underlying screen mounts.
- Explicit cleanup for stop, reset, runtime reload and abandoned spans; visible
  dropped-event and truncated-history indicators.

First-version metrics are recorded numeric samples: throughput, queue depth,
in-flight uploads and recording backlog. Native storage does not automatically
produce CPU, memory or frame-performance measurements. Platform samplers are an
additional milestone with defined units, measurement semantics and device tests.
Do not label JS callback cadence or configured camera FPS as measured UI FPS.

## Public API sketch

This sketches usage, not generated or typechecked implementation:

```ts
import { Tracing } from 'react-native-nitro-tracing'

const recording = Tracing.startRecording({
  maxEvents: 10_000,
  maxBytes: 4 * 1024 * 1024,
  maxActiveSpans: 512,
})

const upload = recording.startSpan({
  name: 'upload.total',
  correlationId: instanceId,
})
try {
  const result = await uploadFile()
  upload.end({ outcome: 'success' })
  return result
} catch (error) {
  upload.end({ outcome: 'error' })
  throw error
}

recording.recordMetric({ name: 'upload.queueDepth', value: 3, unit: 'count' })

// The viewer requests bounded pages, rather than receiving each native event.
const page = await recording.readEvents({ afterSequence: 0, limit: 250 })
recording.stop()
const json = await recording.exportJson()
recording.dispose()
```

`Tracing` is the autolinked root. A recording owns native state; a span is a
returned native handle. Only the root needs an autolinking entry. The eventual
spec separates span, mark and metric result shapes and documents all fields.

Recorder appends and span completion are short synchronous native operations.
Queries and serialization run asynchronously against snapshots. Native producers
and JS may access the same session: protect shared state with a short critical
section, and never serialize or invoke callbacks under that lock. This is the
concrete concurrency requirement, not generic locking around every method.

Repeated `end()` and `stop()` are idempotent. `stop()` closes still-active spans
as interrupted and freezes the recording; reads/export remain valid until dispose.
New recording calls after stop fail clearly through the library API. The app's
instrumentation adapter isolates diagnostic failures from upload business logic
and reports recorder failures separately. Starting another recording does not
silently replace a recording still owned by a caller.

Enforce event count, retained-byte and active-span limits natively. Reject invalid
configuration, cap attribute sizes, report evictions and expire abandoned spans.
Limits include active-span state; exhaustion returns an explicitly non-recording
span handle and increments a drop counter rather than interrupting app work.
Snapshots include the earliest retained sequence so readers can detect lost data.
Displayed aggregates disclose their retained window and sample count.

## Integration and lifecycle

`services/perf` supplies one recording to the existing instrumentation and maps
cross-function marks into native spans. It owns the association between upload
instance IDs, native job IDs and live recording IDs. A completed native event is
the input to viewer history and reporting adapters; avoid a second competing
history in Zustand. Viewer state holds selection and filters only.

Add a small `services/devtools` setup function for menu registration and visibility.
`hooks/useTraceViewer` owns subscriptions/paged reads and view models; the screen
only renders. Register menu entries centrally and guard development-only imports.
Viewer polling exists only while visible and never drives native recording.

Native producers must write through the recorder's native interface without a
round trip through JS. Wiring background upload producers is a separate integration
step: the current `UploadRecord` exposes no timing fields. In-memory recording
cannot survive process death. Durable recording, background reconstruction and
system profilers are explicitly outside the first deliverable, not implied by Nitro.

New native dependency means rebuilding both development clients. Add the workspace
package and app dependency, generated autolinking, podspec and Gradle/CMake setup;
change Expo configuration through config plugins if required. Do not edit generated
app `ios/` or `android/` directories by hand.

## Acceptance checks

### Sentry sample as UI and functional reference

Use the official Sentry React Native sample as a reference for the test playground
and telemetry assertions. Source reviewed at
[`bae70813793801708200fe934756e591dfef2054`](https://github.com/getsentry/sentry-react-native/tree/bae70813793801708200fe934756e591dfef2054/samples/react-native).
This source was inspected, not run. The sample screens are scenario launchers and
diagnostic readouts; they do not provide a ready-made local trace waterfall.

Concrete references:

- [PerformanceScreen](https://github.com/getsentry/sentry-react-native/blob/bae70813793801708200fe934756e591dfef2054/samples/react-native/src/Screens/PerformanceScreen.tsx):
  grouped entry points for manual, automatic, gesture and timing examples.
- [PerformanceTimingScreen](https://github.com/getsentry/sentry-react-native/blob/bae70813793801708200fe934756e591dfef2054/samples/react-native/src/Screens/PerformanceTimingScreen.tsx):
  clock readings, elapsed times and differences useful for diagnostic UI.
- [Native-call Maestro scenario](https://github.com/getsentry/sentry-react-native/blob/bae70813793801708200fe934756e591dfef2054/samples/react-native/e2e/tests/turboModuleSpanAttributes/turboModuleSpanAttributes.test.yml)
  and [payload assertions](https://github.com/getsentry/sentry-react-native/blob/bae70813793801708200fe934756e591dfef2054/samples/react-native/e2e/tests/turboModuleSpanAttributes/turboModuleSpanAttributes.test.ts):
  drive a real UI, check completion/readouts, then verify counts and attributes in
  emitted telemetry. Its TurboModule instrumentation is not a Nitro integration.
- [Mock ingestion server](https://github.com/getsentry/sentry-react-native/blob/bae70813793801708200fe934756e591dfef2054/samples/react-native/e2e/utils/mockedSentryServer.ts):
  capture telemetry locally and wait for matching payloads before asserting.

Proposed viewer tabs: **Overview**, **Traces**, **Metrics**, **Playground**.
Keep capture status and start/stop/export controls visible in the header. Selecting
a trace opens its waterfall, attributes and linked metric window. Playground cards
show the scenario description, Run action, running/pass/fail state, expected versus
observed results, and an Open trace action for that exact run.

Initial scenarios: nested spans; simultaneous same-name spans; native-origin mark
and metric; success/error/cancel; repeated completion; bounded-buffer overflow;
stop/restart; snapshot/export equivalence. Add clock comparisons as diagnostics,
without asserting identical origins between JS, wall and native monotonic clocks.
Use local controlled workloads rather than copying sample external API dependencies.

Each scenario lives in an app-independent test service over the public Nitro API,
with stable run IDs and structured expectations. The screen delegates through a
hook. The same scenarios support manual runs and device tests. Validate output
from the real native recorder, not just a mocked module or a screenshot.
Use the Sentry harness's testing pattern without requiring its wire format or an
account; assert our exported schema locally. Test the Sentry adapter separately
with captured Sentry envelopes when that adapter is implemented.

The sample's Maestro/Jest approach is a functional reference, not a requirement to
replace the eventual device runner. This proposal adds a development-only
playground within the current integration app, not a second standalone app.

Generate with pinned Nitrogen and typecheck all public specs and app adapters.
Test concurrent equal-name spans, parent relationships, idempotent completion,
native concurrency, event/byte/span limits, truncated queries, stop/dispose,
clock behavior and export correctness. Use an injectable clock for deterministic
recorder tests. Validate generated native integration on iOS and Android.

On devices, open/close the menu and viewer during multipart uploads and recording;
verify recording remains active, errors propagate unchanged, Fast Refresh cleans
up ownership, and release builds do not mount the viewer. Compare recorder off,
recorder on/viewer closed, and viewer open for allocation growth and frame impact.
No speedup or overhead claim is accepted without those measurements.

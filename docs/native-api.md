# Native API

The root entry point is the direct Nitro API. It imports no UI, Expo or Sentry code. Use it for explicit instrumentation, or to build your own client.

```ts
import { Tracing } from 'react-native-nitro-tracing'

const recording = Tracing.startRecording({
  maxEvents: 10000,
  maxBytes: 6 * 1024 * 1024,
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
  attributes: [{ key: 'format', value: 'heic' }],
})
child.end('success')
parent.end('success')

recording.mark({
  name: 'image.cached',
  correlationId: 'image-1',
  attributes: [],
})
recording.recordMetric({
  name: 'image.bytes',
  value: 4096,
  unit: 'byte',
  correlationId: 'image-1',
  attributes: [],
})

recording.stop()
const json = await recording.exportJson()
const perfetto = await recording.exportTraceEvents()
recording.dispose()
```

## Spans

- Span handles are unique. Concurrent operations with the same name are safe.
- Pass parents explicitly. Async tasks never rely on a shared "current span".
- `end(outcome)` is idempotent. Outcomes are `success`, `error`, `cancelled` and `interrupted`.
- Stopping interrupts unfinished spans. Spans older than `spanTimeoutMs` expire on the next recording operation, not on a timer.
- `recordSpan`, `mark` and `recordMetric` accept source timestamps in recording-relative milliseconds, so already-measured work can be imported.
- `sourceSpanId` and `sourceParentSpanId` preserve parents that another source reports, even when the parent completes later.

## Reading

`readEvents({ afterSequence, limit })` returns typed span, mark and metric arrays, a cursor that accounts for eviction, and the dropped-event count. Page size is 1–1000. `getStats()` returns the session, elapsed time, retained events and bytes, and active spans.

## Limits

| Option           | Range      | Client default |
| ---------------- | ---------- | -------------- |
| `maxEvents`      | 1–100000   | 10000          |
| `maxBytes`       | 1 KB–64 MB | 6 MB           |
| `maxActiveSpans` | 1–10000    | 256            |
| `spanTimeoutMs`  | ≥ 1        | 30 min         |

## Native sampling

```ts
recording.startNativeSampling({ intervalMs: 1000, frames: true })
recording.stopNativeSampling()
```

This is what `createNativeMetricsPlugin` calls. Stopping or disposing the recording stops the sampler.

## The client's `trace` facade

`client.trace` wraps the active recording, so app code need not hold one:

| Call                                             | Records                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `mark(name, attributes?)`                        | A mark                                                                         |
| `metric(name, value, attributes?)`               | A metric (`attributes.unit`, default `count`); non-numeric values become marks |
| `measure(name, async () => …, attributes?)`      | A span around the work. Returns its result, rethrows its error.                |
| `measureSince(name, startName, id, attributes?)` | A span from an earlier `mark(startName, { id })`                               |
| `clear(id)`                                      | Resets `measureSince` state for an operation                                   |

`attributes.id` becomes the correlation ID, which groups events into one trace. Instrumentation errors are reported through `onError` and never replace the measured result. When recording is off, `measure` still runs the work.

`measureSince` deduplicates by measure name and correlation ID. The facade keeps at most 512 operation IDs, 64 marks and 64 measure names per ID. Stopping clears them, so a restart cannot create spans that cross recordings.

Pass `sink(line, entry)` to `createTraceClient` to mirror trace calls and observed Performance entries into your logs or breadcrumbs. Sink failures are reported and never affect measured work.

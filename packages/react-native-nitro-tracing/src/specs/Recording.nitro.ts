import type { HybridObject } from 'react-native-nitro-modules'
import type { TraceSpan } from './TraceSpan.nitro'
import type {
  CompletedSpanOptions,
  SpanOptions,
  MarkOptions,
  MetricOptions,
  ReadOptions,
  TracePage,
  RecordingStats,
  NativeSamplingOptions,
} from '../types'
/** Owns bounded native history. Stop before export; dispose when all readers are done. */
export interface Recording extends HybridObject<{
  ios: 'c++'
  android: 'c++'
}> {
  /** Start a span, optionally linked to an explicit parent. */
  startSpan(options: SpanOptions): TraceSpan
  /** Import a completed measurement; returns its native span identity. */
  recordSpan(options: CompletedSpanOptions): string
  /** Append a point event. */
  mark(options: MarkOptions): void
  /** Append a finite numeric sample with units. */
  recordMetric(options: MetricOptions): void
  /** Read at most 1000 completed events without per-event callbacks. */
  readEvents(options: ReadOptions): Promise<TracePage>
  /** Read cheap recording counters and clock anchor. */
  getStats(): RecordingStats
  /** Freeze history and close active spans as interrupted. Idempotent. */
  stop(): void
  /** Serialize a snapshot off the JS thread; includes schema version and clock anchor. */
  exportJson(): Promise<string>
  /** Chrome Trace Event JSON for ui.perfetto.dev; serialized off the JS thread. */
  exportTraceEvents(): Promise<string>
  /** Start a native thread writing process.cpu, process.memory and ui.* frame metrics. Replaces a running sampler. */
  startNativeSampling(options: NativeSamplingOptions): void
  /** Stop native sampling. Idempotent; stop() and dispose() also stop it. */
  stopNativeSampling(): void
}

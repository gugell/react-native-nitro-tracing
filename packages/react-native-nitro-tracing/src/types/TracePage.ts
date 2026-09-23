import type { SpanEvent } from './SpanEvent'
import type { MarkEvent } from './MarkEvent'
import type { MetricEvent } from './MetricEvent'
/** Immutable event page. Arrays share a global sequence; merge by sequence if needed. */
export interface TracePage {
  /** Completed durations. */
  spans: SpanEvent[]
  /** Point events. */
  marks: MarkEvent[]
  /** Numeric samples. */
  metrics: MetricEvent[]
  /** Last returned sequence; pass to the next query. */
  nextSequence: number
  /** First retained sequence, or next assignable sequence when empty. */
  earliestSequence: number
  /** Number dropped since creation. */
  droppedEvents: number
}

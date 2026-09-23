import type { SpanOutcome } from './SpanOutcome'
import type { EventContext } from './EventContext'
/** Completed span from Recording.readEvents. */
export interface SpanEvent extends EventContext {
  /** Unique native span identity. */
  spanId: string
  /** Parent identity; empty for root spans. */
  parentSpanId: string
  /** Monotonic elapsed time in milliseconds. */
  durationMs: number
  /** Terminal result. */
  outcome: SpanOutcome
}

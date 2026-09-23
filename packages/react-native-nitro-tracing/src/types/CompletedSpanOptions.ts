import type { SpanOutcome } from './SpanOutcome'
import type { SpanOptions } from './SpanOptions'
/** Completed external measurement in Recording's native clock domain. */
export interface CompletedSpanOptions extends SpanOptions {
  /** Optional source-qualified identity, for example sentry:traceId:spanId. */
  sourceSpanId?: string
  /** Source-qualified parent identity; resolves even when parent ends later. */
  sourceParentSpanId?: string
  /** Start in milliseconds relative to recording creation. */
  timestampMs: number
  /** Finite nonnegative duration. */
  durationMs: number
  /** Terminal result from the measurement source. */
  outcome: SpanOutcome
}

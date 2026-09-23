import type { TraceContext } from './TraceContext'
/** Immutable native event identity and timing shared by recorded variants. */
export interface EventContext extends TraceContext {
  /** Increasing session-local completion sequence. */
  sequence: number
  /** Milliseconds since recording creation on its native monotonic clock. */
  timestampMs: number
}

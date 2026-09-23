import type { TraceAttributes } from './TraceAttributes'
/** Context shared by marks and spans in a Recording. */
export interface TraceContext {
  /** Stable operation name, capped to 256 bytes. */
  name: string
  /** Application operation identity; empty for uncorrelated events. */
  correlationId: string
  /** Bounded scalar attributes, at most 32 entries. */
  attributes: TraceAttributes
}

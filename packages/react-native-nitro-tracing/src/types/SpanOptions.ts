import type { TraceContext } from './TraceContext'
/** Input to Recording.startSpan. */
export interface SpanOptions extends TraceContext {
  /** Parent from the same recording; omit for a root span. */
  parentSpanId?: string
}

import type { TraceContext } from './TraceContext'
/** Native mark, optionally imported with a translated source timestamp. */
export interface MarkOptions extends TraceContext {
  /** Milliseconds in the recording clock; omit to record now. */
  timestampMs?: number
}

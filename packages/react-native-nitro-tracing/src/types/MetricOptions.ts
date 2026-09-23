import type { TraceContext } from './TraceContext'
/** Input to Recording.recordMetric. */
export interface MetricOptions extends TraceContext {
  /** Optional source timestamp translated to the recording clock. */
  timestampMs?: number
  /** Finite numeric sample. */
  value: number
  /** Unit, for example bytes, byte/second, count, millisecond. */
  unit: string
}

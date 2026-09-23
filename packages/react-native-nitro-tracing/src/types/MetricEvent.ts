import type { EventContext } from './EventContext'
/** Numeric sample from Recording.readEvents. */
export interface MetricEvent extends EventContext {
  /** Finite numeric sample. */
  value: number
  /** Sample unit. */
  unit: string
}

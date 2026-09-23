import type { HybridObject } from 'react-native-nitro-modules'
import type { SpanOutcome } from '../types'
/** A native span handle returned by Recording.startSpan. */
export interface TraceSpan extends HybridObject<{
  ios: 'c++'
  android: 'c++'
}> {
  /** Empty when rejected by capacity limits. */
  readonly spanId: string
  /** Whether capacity allowed this span to be recorded. */
  readonly recorded: boolean
  /** Complete once. Repeated completion and completion after stop are no-ops. */
  end(outcome: SpanOutcome): void
}

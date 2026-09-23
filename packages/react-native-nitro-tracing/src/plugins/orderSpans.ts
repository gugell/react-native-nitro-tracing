import type { SpanEvent } from '../types'
/** Parent-first order in O(n), including parents delivered after their children. */
export function orderSpans(spans: readonly SpanEvent[]): SpanEvent[] {
  const byId = new Map(spans.map((span) => [span.spanId, span]))
  const children = new Map<string, SpanEvent[]>()
  const ordered: SpanEvent[] = []
  for (const span of byId.values()) {
    if (!span.parentSpanId || !byId.has(span.parentSpanId)) ordered.push(span)
    else {
      const siblings = children.get(span.parentSpanId)
      if (siblings) siblings.push(span)
      else children.set(span.parentSpanId, [span])
    }
  }
  for (let index = 0; index < ordered.length; index++) {
    const descendants = children.get(ordered[index]!.spanId)
    if (descendants) for (const child of descendants) ordered.push(child)
  }
  if (ordered.length !== byId.size)
    throw new Error('Cannot export cyclic span parents')
  return ordered
}

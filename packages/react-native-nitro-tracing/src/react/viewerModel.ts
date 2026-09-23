import type { MetricEvent, SpanEvent, TracePage } from '../types'
export interface TraceGroup {
  id: string
  name: string
  start: number
  duration: number
  errors: number
  events: number
}
export const groupTraces = (page: TracePage, query: string): TraceGroup[] => {
  const groups = new Map<string, TraceGroup>()
  for (const event of [...page.spans, ...page.marks, ...page.metrics]) {
    const id = event.correlationId || 'uncorrelated'
    const end =
      event.timestampMs +
      ('durationMs' in event && typeof event.durationMs === 'number'
        ? event.durationMs
        : 0)
    const previous = groups.get(id)
    const start = Math.min(
      previous?.start ?? event.timestampMs,
      event.timestampMs
    )
    groups.set(id, {
      id,
      name:
        previous && previous.start <= event.timestampMs
          ? previous.name
          : event.name,
      start,
      duration:
        Math.max(previous ? previous.start + previous.duration : end, end) -
        start,
      errors:
        (previous?.errors ?? 0) +
        ('outcome' in event && event.outcome === 'error' ? 1 : 0),
      events: (previous?.events ?? 0) + 1,
    })
  }
  const search = query.toLowerCase()
  const matchingIds = new Set(
    [...page.spans, ...page.marks, ...page.metrics]
      .filter((event) =>
        `${event.name} ${event.correlationId}`.toLowerCase().includes(search)
      )
      .map((event) => event.correlationId || 'uncorrelated')
  )
  return [...groups.values()]
    .filter((group) => !search || matchingIds.has(group.id))
    .sort((a, b) => b.start - a.start)
}
export const waterfall = (spans: SpanEvent[]) => {
  const byId = new Map(spans.map((span) => [span.spanId, span]))
  const base = spans.length
    ? Math.min(...spans.map((span) => span.timestampMs))
    : 0
  const duration = Math.max(
    1,
    ...spans.map((span) => span.timestampMs + span.durationMs - base)
  )
  return [...spans]
    .sort(
      (a, b) => a.timestampMs - b.timestampMs || b.durationMs - a.durationMs
    )
    .map((span) => {
      const seen = new Set([span.spanId])
      let parent = byId.get(span.parentSpanId)
      let depth = 0
      while (parent && !seen.has(parent.spanId)) {
        seen.add(parent.spanId)
        depth++
        parent = byId.get(parent.parentSpanId)
      }
      return {
        span,
        depth: Math.min(depth, 8),
        offset: (span.timestampMs - base) / duration,
        width: span.durationMs / duration,
      }
    })
}
export const metricSeries = (metrics: MetricEvent[]) => {
  const groups = new Map<string, MetricEvent[]>()
  for (const metric of metrics) {
    const key = `${metric.name} (${metric.unit})`
    const group = groups.get(key) ?? []
    group.push(metric)
    groups.set(key, group)
  }
  return [...groups].map(([name, retained]) => {
    const samples = retained
      .sort((a, b) => a.timestampMs - b.timestampMs)
      .slice(-40)
    return {
      name,
      samples,
      retainedCount: retained.length,
      startMs: samples[0]?.timestampMs ?? 0,
      endMs: samples[samples.length - 1]?.timestampMs ?? 0,
      max: Math.max(1, ...samples.map((sample) => Math.abs(sample.value))),
    }
  })
}

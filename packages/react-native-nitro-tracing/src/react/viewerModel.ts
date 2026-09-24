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
      while (parent && depth < 8 && !seen.has(parent.spanId)) {
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
    const values = retained.map((sample) => sample.value).sort((a, b) => a - b)
    return {
      latest: retained[retained.length - 1]?.value ?? 0,
      median: values.length
        ? (values[Math.floor((values.length - 1) / 2)] +
            values[Math.ceil((values.length - 1) / 2)]) /
          2
        : 0,
      min: values[0] ?? 0,
      peak: values[values.length - 1] ?? 0,
      p95: values[Math.max(0, Math.ceil(values.length * 0.95) - 1)] ?? 0,
      name,
      samples,
      retainedCount: retained.length,
      startMs: samples[0]?.timestampMs ?? 0,
      endMs: samples[samples.length - 1]?.timestampMs ?? 0,
      max: Math.max(1, ...samples.map((sample) => Math.abs(sample.value))),
    }
  })
}

/** Durations are derived from retained completed spans, not additional native samples. */
export const recordingMetrics = (page: TracePage) =>
  metricSeries([
    ...page.metrics,
    ...page.spans
      .filter((span) => span.outcome === 'success' || span.outcome === 'error')
      .map((span) => ({
        ...span,
        name: `duration: ${span.name}`,
        value: span.durationMs,
        unit: 'ms',
      })),
  ])

export const operationMetrics = (spans: SpanEvent[]) => {
  const groups = new Map<string, SpanEvent[]>()
  for (const span of spans) {
    const group = groups.get(span.name) ?? []
    group.push(span)
    groups.set(span.name, group)
  }
  return [...groups]
    .map(([name, samples]) => {
      const completed = samples.filter(
        (s) => s.outcome === 'success' || s.outcome === 'error'
      )
      return {
        name,
        count: samples.length,
        errors: completed.filter((s) => s.outcome === 'error').length,
        errorRate: completed.length
          ? (completed.filter((s) => s.outcome === 'error').length /
              completed.length) *
            100
          : undefined,
        cancelled: samples.filter((s) => s.outcome === 'cancelled').length,
        interrupted: samples.filter((s) => s.outcome === 'interrupted').length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

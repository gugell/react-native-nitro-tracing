import type { MarkEvent, SpanEvent, TracePage } from '../types'

export type ExplorerMode = 'traces' | 'spans' | 'marks'
export type Sort =
  'newest' | 'oldest' | 'longest' | 'shortest' | 'errors' | 'count' | 'name'
export interface Query {
  search: string
  outcomes: string[]
  sources: string[]
  minDuration: string
  from: string
  to: string
  correlation: string
  sort: Sort
}
export const defaultQuery = (): Query => ({
  search: '',
  outcomes: [],
  sources: [],
  minDuration: '',
  from: '',
  to: '',
  correlation: '',
  sort: 'newest',
})
export type Event = SpanEvent | MarkEvent
export interface Trace {
  id: string
  name: string
  start: number
  duration: number
  errors: number
  spans: SpanEvent[]
  marks: MarkEvent[]
  sources: string[]
}
const isSpan = (event: Event): event is SpanEvent => 'spanId' in event
export const sourceOf = (event: Event): string =>
  event.attributes.find((a) => a.key === 'source')?.value || 'unknown'
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const identity = (event: Event) =>
  isSpan(event) ? event.spanId : `mark:${event.sequence}`
const tie = (a: Event, b: Event) =>
  compareText(identity(a), identity(b)) || a.sequence - b.sequence
const chronological = (a: Event, b: Event) =>
  a.timestampMs - b.timestampMs || tie(a, b)
const durationOf = (event: Event) => (isSpan(event) ? event.durationMs : 0)
const endOf = (event: Event) => event.timestampMs + durationOf(event)
const numeric = (value: string): number | undefined =>
  value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined
const overlaps = (start: number, duration: number, query: Query) => {
  const from = numeric(query.from)
  const to = numeric(query.to)
  return (
    (from === undefined || start + duration >= from) &&
    (to === undefined || start <= to)
  )
}
export const matchesSearch = (event: Event, search: string) =>
  !search ||
  [
    event.name,
    event.correlationId,
    isSpan(event) ? event.spanId : '',
    ...event.attributes.flatMap((a) => [a.key, a.value]),
  ].some((value) => value.toLowerCase().includes(search.toLowerCase()))

/** A deterministic forest: missing parents are roots and cycles are cut once. */
const forest = (spans: SpanEvent[]) => {
  const sorted = [...spans].sort(chronological)
  const byId = new Map(sorted.map((span) => [span.spanId, span]))
  const children = new Map<SpanEvent, SpanEvent[]>()
  const roots: SpanEvent[] = []
  for (const span of sorted) {
    const parent = byId.get(span.parentSpanId)
    if (!parent || parent === span) roots.push(span)
    else {
      const siblings = children.get(parent) ?? []
      siblings.push(span)
      children.set(parent, siblings)
    }
  }
  const visited = new Set<SpanEvent>()
  const rows: Array<{
    span: SpanEvent
    depth: number
    root: SpanEvent
    parent?: SpanEvent
    children: number
  }> = []
  const rowBySpan = new Map<SpanEvent, (typeof rows)[number]>()
  for (const root of [...roots, ...sorted]) {
    if (visited.has(root)) continue
    const stack: Array<{ span: SpanEvent; depth: number; parent?: SpanEvent }> =
      [{ span: root, depth: 0 }]
    while (stack.length) {
      const next = stack.pop()!
      if (visited.has(next.span)) continue
      visited.add(next.span)
      const row = { ...next, root, children: 0 }
      rows.push(row)
      rowBySpan.set(next.span, row)
      const descendants = children.get(next.span) ?? []
      for (let i = descendants.length - 1; i >= 0; i--)
        stack.push({
          span: descendants[i],
          depth: next.depth + 1,
          parent: next.span,
        })
    }
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i]
    const parent = row.parent && rowBySpan.get(row.parent)
    if (parent) parent.children += row.children + 1
  }
  return rows
}

export const buildTraces = (page: TracePage): Trace[] => {
  const groups = new Map<string, { id: string; events: Event[] }>()
  for (const event of [...page.spans, ...page.marks]) {
    if (!event.correlationId) continue
    const key = `correlation:${event.correlationId}`
    const group = groups.get(key) ?? { id: key, events: [] }
    group.events.push(event)
    groups.set(key, group)
  }
  for (const row of forest(page.spans.filter((span) => !span.correlationId))) {
    const key = `span:${row.root.spanId}`
    const group = groups.get(key) ?? { id: key, events: [] }
    group.events.push(row.span)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map(({ id, events }) => {
      events.sort(chronological)
      const spans = events.filter(isSpan)
      const start = events[0].timestampMs
      const end = events.reduce(
        (latest, event) => Math.max(latest, endOf(event)),
        start
      )
      return {
        id,
        name: events[0].name,
        start,
        duration: end - start,
        errors: spans.filter((s) => s.outcome === 'error').length,
        spans,
        marks: events.filter((e) => !isSpan(e)),
        sources: [...new Set(events.map(sourceOf))].sort(compareText),
      }
    })
    .sort((a, b) => b.start - a.start || compareText(a.id, b.id))
}

export const queryEvents = (events: Event[], query: Query): Event[] => {
  const search = query.search.toLowerCase()
  const minimum = numeric(query.minDuration)
  return events
    .filter(
      (event) =>
        matchesSearch(event, search) &&
        (!query.correlation || event.correlationId === query.correlation) &&
        (!query.sources.length || query.sources.includes(sourceOf(event))) &&
        (!isSpan(event) ||
          !query.outcomes.length ||
          query.outcomes.includes(event.outcome)) &&
        (!isSpan(event) ||
          minimum === undefined ||
          event.durationMs >= minimum) &&
        overlaps(event.timestampMs, durationOf(event), query)
    )
    .sort((a, b) => {
      let order = 0
      switch (query.sort) {
        case 'oldest':
          order = a.timestampMs - b.timestampMs
          break
        case 'longest':
          order = durationOf(b) - durationOf(a)
          break
        case 'shortest':
          order = durationOf(a) - durationOf(b)
          break
        case 'name':
          order = compareText(a.name, b.name)
          break
        case 'errors':
          order =
            Number(isSpan(b) && b.outcome === 'error') -
            Number(isSpan(a) && a.outcome === 'error')
          break
        default:
          order = b.timestampMs - a.timestampMs
      }
      return order || tie(a, b)
    })
}

export const queryTraces = (traces: Trace[], query: Query): Trace[] => {
  const search = query.search.toLowerCase()
  const minimum = numeric(query.minDuration)
  return traces
    .filter((trace) => {
      const events: Event[] = [...trace.spans, ...trace.marks]
      return (
        (!search || events.some((event) => matchesSearch(event, search))) &&
        (!query.correlation ||
          events.some((event) => event.correlationId === query.correlation)) &&
        (!query.sources.length ||
          trace.sources.some((source) => query.sources.includes(source))) &&
        (!query.outcomes.length ||
          query.outcomes.some((outcome) =>
            outcome === 'error'
              ? trace.errors > 0
              : (outcome === 'success' || outcome === 'no-error') &&
                trace.errors === 0
          )) &&
        (minimum === undefined || trace.duration >= minimum) &&
        overlaps(trace.start, trace.duration, query)
      )
    })
    .sort((a, b) => {
      let order = 0
      switch (query.sort) {
        case 'oldest':
          order = a.start - b.start
          break
        case 'longest':
          order = b.duration - a.duration
          break
        case 'shortest':
          order = a.duration - b.duration
          break
        case 'errors':
          order = b.errors - a.errors
          break
        case 'count':
          order = b.spans.length - a.spans.length
          break
        case 'name':
          order = compareText(a.name, b.name)
          break
        default:
          order = b.start - a.start
      }
      return order || compareText(a.id, b.id)
    })
}

export const hierarchyRows = (spans: SpanEvent[], collapsed: Set<string>) => {
  const rows = forest(spans)
  const start = spans.reduce(
    (min, span) => Math.min(min, span.timestampMs),
    Infinity
  )
  const end = spans.reduce((max, span) => Math.max(max, endOf(span)), -Infinity)
  const duration = Math.max(1, end - start)
  let hiddenBelow = Infinity
  return rows
    .filter((row) => {
      if (row.depth > hiddenBelow) return false
      hiddenBelow = collapsed.has(row.span.spanId) ? row.depth : Infinity
      return true
    })
    .map(({ span, depth, children }) => ({
      span,
      depth,
      children,
      offset: (span.timestampMs - start) / duration,
      width: span.durationMs / duration,
    }))
}
export const traceForSpan = (
  traces: Trace[],
  span: SpanEvent
): Trace | undefined =>
  traces.find((trace) =>
    trace.spans.some(
      (member) =>
        member.spanId === span.spanId && member.sequence === span.sequence
    )
  )

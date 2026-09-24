import type { MarkEvent, SpanEvent, TracePage } from '../types'
import {
  buildTraces,
  defaultQuery,
  hierarchyRows,
  matchesSearch,
  queryEvents,
  queryTraces,
  sourceOf,
  traceForSpan,
} from './explorerModel'
const span = (
  spanId: string,
  overrides: Partial<SpanEvent> = {}
): SpanEvent => ({
  spanId,
  parentSpanId: '',
  name: spanId,
  correlationId: 'trace',
  sequence: 1,
  timestampMs: 10,
  durationMs: 100,
  outcome: 'success',
  attributes: [],
  ...overrides,
})
const mark = (overrides: Partial<MarkEvent> = {}): MarkEvent => ({
  name: 'mark',
  correlationId: '',
  sequence: 20,
  timestampMs: 50,
  attributes: [],
  ...overrides,
})
const page = (spans: SpanEvent[], marks: MarkEvent[] = []): TracePage => ({
  spans,
  marks,
  metrics: [],
  nextSequence: 30,
  earliestSequence: 1,
  droppedEvents: 0,
})

it('combines filter groups with AND and source/outcome alternatives with OR', () => {
  const matching = span('a', {
    outcome: 'error',
    attributes: [
      { key: 'source', value: 'sentry' },
      { key: 'URL', value: '/UPLOAD' },
    ],
  })
  const events = [
    matching,
    span('b'),
    span('c', { ...matching, spanId: 'c', durationMs: 1 }),
  ]
  const query = {
    ...defaultQuery(),
    search: 'upload',
    outcomes: ['error', 'cancelled'],
    sources: ['sentry', 'performance'],
    minDuration: '100',
    correlation: 'trace',
  }
  expect(queryEvents(events, query)).toEqual([matching])
  expect(queryEvents(events, { ...query, correlation: 'trac' })).toEqual([])
  expect(queryEvents(events, { ...query, search: 'url' })).toEqual([matching])
})
it('matches a child without pruning the full trace and permits different members to match groups', () => {
  const root = span('root', {
    attributes: [{ key: 'source', value: 'performance' }],
  })
  const child = span('child', {
    parentSpanId: 'root',
    name: 'compress',
    outcome: 'error',
  })
  const traces = buildTraces(
    page([root, child], [mark({ correlationId: 'trace' })])
  )
  expect(
    queryTraces(traces, {
      ...defaultQuery(),
      search: 'COMPRESS',
      sources: ['performance'],
      outcomes: ['error'],
    })
  ).toEqual(traces)
  expect(traces[0].spans).toHaveLength(2)
  expect(traces[0].marks).toHaveLength(1)
  expect(
    queryTraces(traces, { ...defaultQuery(), outcomes: ['success'] })
  ).toEqual([])
  expect(traceForSpan(traces, { ...child })).toBe(traces[0])
})
it('uses inclusive interval overlap, including point marks and ignores span-only filters for marks', () => {
  const events = [
    span('a'),
    mark({ timestampMs: 110 }),
    mark({ timestampMs: 111 }),
  ]
  expect(
    queryEvents(events, { ...defaultQuery(), from: '110', to: '110' })
  ).toHaveLength(2)
  expect(
    queryEvents([events[1]], {
      ...defaultQuery(),
      outcomes: ['error'],
      minDuration: '999',
    })
  ).toEqual([events[1]])
  expect(
    queryTraces(buildTraces(page([events[0] as SpanEvent])), {
      ...defaultQuery(),
      from: '110',
      to: '110',
      minDuration: '100',
    })
  ).toHaveLength(1)
})
it('keeps unrelated root trees separate, omits uncorrelated marks and all metrics', () => {
  const p = page(
    [
      span('root', { correlationId: '' }),
      span('child', { correlationId: '', parentSpanId: 'root' }),
      span('other', { correlationId: '' }),
      span('missing', { correlationId: '', parentSpanId: 'evicted' }),
    ],
    [mark()]
  )
  p.metrics.push({
    ...mark({ correlationId: 'metric-only' }),
    value: 1,
    unit: 'ms',
  })
  const traces = buildTraces(p)
  expect(traces).toHaveLength(3)
  expect(traces.find((t) => t.id === 'span:root')?.spans).toHaveLength(2)
  expect(
    queryTraces(traces, { ...defaultQuery(), correlation: 'span:root' })
  ).toEqual([])
})
it('sorts with deterministic identity and sequence ties without mutating input', () => {
  const a = span('a'),
    b = span('b')
  const events = [b, a]
  expect(queryEvents(events, defaultQuery())).toEqual([a, b])
  expect(events).toEqual([b, a])
  expect(
    queryEvents(
      [mark({ sequence: 2 }), mark({ sequence: 1 })],
      defaultQuery()
    ).map((e) => e.sequence)
  ).toEqual([1, 2])
  const traces = buildTraces(
    page([span('b', { correlationId: 'b' }), span('a', { correlationId: 'a' })])
  )
  expect(
    queryTraces(traces.reverse(), defaultQuery()).map((t) => t.id)
  ).toEqual(['correlation:a', 'correlation:b'])
})
it('renders true tree order, descendant counts, collapse and a common time scale', () => {
  const spans = [
    span('root'),
    span('sibling', { parentSpanId: 'root', timestampMs: 11 }),
    span('child', { parentSpanId: 'root', timestampMs: 10 }),
    span('grandchild', {
      parentSpanId: 'child',
      timestampMs: 35,
      durationMs: 25,
    }),
  ]
  const rows = hierarchyRows(spans, new Set())
  expect(rows.map((r) => r.span.spanId)).toEqual([
    'root',
    'child',
    'grandchild',
    'sibling',
  ])
  expect(rows.map((r) => r.children)).toEqual([3, 1, 0, 0])
  expect(rows[2]).toMatchObject({ depth: 2, offset: 25 / 101, width: 25 / 101 })
  expect(
    hierarchyRows(spans, new Set(['child'])).map((r) => r.span.spanId)
  ).toEqual(['root', 'child', 'sibling'])
  expect(hierarchyRows(spans, new Set(['root']))).toHaveLength(1)
})
it('bounds cyclic, self-parent and missing-parent hierarchies without losing rows', () => {
  const spans = [
    span('a', { correlationId: '', parentSpanId: 'b' }),
    span('b', { correlationId: '', parentSpanId: 'a' }),
    span('self', { correlationId: '', parentSpanId: 'self' }),
    span('missing', { correlationId: '', parentSpanId: 'evicted' }),
  ]
  const rows = hierarchyRows(spans, new Set())
  expect(rows).toHaveLength(4)
  expect(Math.max(...rows.map((r) => r.depth))).toBe(1)
  expect(buildTraces(page(spans))).toHaveLength(3)
  expect(hierarchyRows([], new Set())).toEqual([])
})
it('never guesses a source from an operation name and defaults contain no hidden filters', () => {
  expect(sourceOf(span('sentry.upload'))).toBe('unknown')
  expect(
    sourceOf(
      span('anything', {
        attributes: [{ key: 'source', value: 'release-profiler' }],
      })
    )
  ).toBe('release-profiler')
  const first = defaultQuery()
  first.sources.push('sentry')
  expect(defaultQuery().sources).toEqual([])
})
it('supports duration, error and count sorting and invalid numeric fields as absent', () => {
  const a = span('a', { durationMs: 1 }),
    b = span('b', { durationMs: 50, outcome: 'error' })
  expect(queryEvents([a, b], { ...defaultQuery(), sort: 'longest' })).toEqual([
    b,
    a,
  ])
  expect(queryEvents([a, b], { ...defaultQuery(), sort: 'shortest' })).toEqual([
    a,
    b,
  ])
  expect(
    queryEvents([a, b], {
      ...defaultQuery(),
      from: 'invalid',
      minDuration: 'invalid',
    })
  ).toHaveLength(2)
  const traces = buildTraces(
    page([a, b, span('c', { correlationId: 'other' })])
  )
  for (const sort of ['errors', 'count'] as const)
    expect(queryTraces(traces, { ...defaultQuery(), sort })[0].id).toBe(
      'correlation:trace'
    )
})

it('namespaces correlated identities so root IDs cannot collide', () => {
  const correlated = span('correlated', { correlationId: 'span:foo' })
  const root = span('foo', { correlationId: '' })
  const traces = buildTraces(page([correlated, root]))
  expect(new Set(traces.map((trace) => trace.id)).size).toBe(2)
  expect(traceForSpan(traces, correlated)?.id).toBe('correlation:span:foo')
  expect(traceForSpan(traces, root)?.id).toBe('span:foo')
  expect(
    queryTraces(traces, { ...defaultQuery(), correlation: 'span:foo' })
  ).toEqual([traceForSpan(traces, correlated)])
})
it('exposes case-insensitive retained-field matching for detail highlights', () => {
  expect(matchesSearch(span('Upload'), 'UPLOAD')).toBe(true)
  expect(matchesSearch(span('Upload'), 'download')).toBe(false)
})

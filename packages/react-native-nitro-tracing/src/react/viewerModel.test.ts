import type { SpanEvent, TracePage } from '../types'

import { groupTraces, metricSeries, waterfall } from './viewerModel'
const span = (overrides: Partial<SpanEvent>): SpanEvent => ({
  name: 'upload',
  correlationId: 'a',
  attributes: [],
  spanId: 'root',
  parentSpanId: '',
  timestampMs: 10,
  durationMs: 100,
  sequence: 1,
  outcome: 'success',
  ...overrides,
})
const page = (spans: SpanEvent[]): TracePage => ({
  spans,
  marks: [],
  metrics: [],
  nextSequence: 3,
  earliestSequence: 1,
  droppedEvents: 0,
})
it('groups concurrent operations separately and searches child names', () => {
  const events = page([
    span({}),
    span({
      spanId: 'child',
      parentSpanId: 'root',
      name: 'compress',
      timestampMs: 20,
      durationMs: 30,
      outcome: 'error',
    }),
    span({ correlationId: 'b', timestampMs: 30 }),
  ])
  expect(groupTraces(events, 'compress')).toEqual([
    { id: 'a', name: 'upload', start: 10, duration: 100, errors: 1, events: 2 },
  ])
  expect(groupTraces(events, '')[0].id).toBe('b')
})
it('uses a shared time axis and bounded parent depth, even for corrupt cycles', () => {
  const rows = waterfall([
    span({}),
    span({
      spanId: 'child',
      parentSpanId: 'root',
      timestampMs: 35,
      durationMs: 50,
    }),
  ])
  expect(rows[1]).toMatchObject({ depth: 1, offset: 0.25, width: 0.5 })
  expect(waterfall([span({ parentSpanId: 'root' })])[0].depth).toBe(0)
  expect(waterfall([])).toEqual([])
})
it('keeps metric units separate and limits plotted samples', () => {
  const samples = Array.from({ length: 60 }, (_, sequence) => ({
    name: 'throughput',
    correlationId: '',
    attributes: [],
    sequence,
    timestampMs: sequence,
    unit: 'bytes',
    value: sequence,
  }))
  const series = metricSeries([...samples, { ...samples[0], unit: 'count' }])
  expect(series).toHaveLength(2)
  expect(series[0].samples).toHaveLength(40)
  expect(series[0].samples[0].sequence).toBe(20)
  expect(series[0].max).toBe(59)
  expect(series[0]).toMatchObject({ retainedCount: 60, startMs: 20, endMs: 59 })
})

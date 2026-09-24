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

it('caps work for deeply nested traces while retaining the visible hierarchy', () => {
  let parentReads = 0
  const spans = Array.from({ length: 3000 }, (_, index) =>
    span({
      spanId: String(index),
      get parentSpanId() {
        parentReads++
        return index ? String(index - 1) : ''
      },
      timestampMs: index,
    })
  )
  // Install lazy getters after fixture construction so traversal reads are measured.
  spans.forEach((entry, index) =>
    Object.defineProperty(entry, 'parentSpanId', {
      get() {
        parentReads++
        return index ? String(index - 1) : ''
      },
    })
  )
  parentReads = 0
  const rows = waterfall(spans)
  expect(rows[1].depth).toBe(1)
  expect(rows[2999].depth).toBe(8)
  expect(parentReads).toBeLessThanOrEqual(spans.length * 9)
})

it('shows metrics across all correlations and computes retained-sample percentiles and outcomes', () => {
  const { recordingMetrics, operationMetrics } = require('./viewerModel')
  const data = page([
    span({ correlationId: 'a', durationMs: 10 }),
    span({ correlationId: 'b', durationMs: 30, outcome: 'error' }),
    span({ correlationId: 'b', outcome: 'cancelled' }),
    span({ outcome: 'interrupted' }),
  ])
  data.metrics = [
    {
      name: 'app.ready.after_tracer_init',
      value: 500,
      unit: 'ms',
      correlationId: '',
      attributes: [],
      timestampMs: 0,
      sequence: 10,
    },
  ]
  const metrics = recordingMetrics(data)
  expect(metrics[0]).toMatchObject({
    name: 'app.ready.after_tracer_init (ms)',
    latest: 500,
    median: 500,
    p95: 500,
  })
  expect(metrics[1]).toMatchObject({
    retainedCount: 2,
    min: 10,
    median: 20,
    p95: 30,
  })
  expect(operationMetrics(data.spans)[0]).toMatchObject({
    count: 4,
    errors: 1,
    errorRate: 50,
    cancelled: 1,
    interrupted: 1,
  })
})

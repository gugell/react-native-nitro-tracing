import { orderSpans } from './orderSpans'
import type { SpanEvent } from '../types'
const span = (id: number, parent: string): SpanEvent => ({
  spanId: String(id),
  parentSpanId: parent,
  name: 'work',
  sequence: id + 1,
  timestampMs: 0,
  durationMs: 1,
  attributes: [],
  correlationId: '',
  outcome: 'success',
})
it('orders a deep child-first completion stream without recursion', () => {
  const spans = Array.from({ length: 10000 }, (_, index) =>
    span(index, index ? String(index - 1) : '')
  ).reverse()
  const ordered = orderSpans(spans)
  expect(ordered.map((s) => s.spanId)).toEqual(
    [...spans].reverse().map((s) => s.spanId)
  )
})
it('rejects cycles before creating export handles and accepts evicted parents', () => {
  expect(() => orderSpans([span(1, '2'), span(2, '1')])).toThrow('cyclic')
  expect(orderSpans([span(1, 'evicted')])).toHaveLength(1)
})

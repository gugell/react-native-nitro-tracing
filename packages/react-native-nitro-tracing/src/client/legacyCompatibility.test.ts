import { createTraceClient } from './createTraceClient'
import type { TracingEntry } from './TracingSink'
let mockClock = 0
const mockSpans: Array<Record<string, unknown>> = []
const mockMarks: unknown[] = []
const mockMetrics: unknown[] = []
jest.mock('../index', () => ({
  Tracing: {
    startRecording: () => ({
      getStats: () => ({ nowMs: mockClock }),
      mark: (value: unknown) => mockMarks.push(value),
      recordMetric: (value: unknown) => mockMetrics.push(value),
      recordSpan: (value: Record<string, unknown>) => mockSpans.push(value),
      startSpan: (value: Record<string, unknown>) => {
        const start = mockClock
        return {
          end: (outcome: string) =>
            mockSpans.push({
              ...value,
              durationMs: mockClock - start,
              outcome,
            }),
        }
      },
      stop() {},
      dispose() {},
    }),
  },
}))
beforeEach(() => {
  mockClock = 0
  mockSpans.length = mockMarks.length = mockMetrics.length = 0
})
it('preserves concurrent upload correlation, repeated callback dedup, shared starts and clear', async () => {
  const client = createTraceClient({ performance: false })
  await client.start()
  const { trace } = client
  trace.mark('queued', { id: 'a' })
  mockClock = 1000
  trace.mark('queued', { id: 'b' })
  mockClock = 1500
  trace.measureSince('firstByte', 'queued', 'b')
  mockClock = 4000
  trace.measureSince('firstByte', 'queued', 'a')
  trace.measureSince('firstByte', 'queued', 'a')
  trace.measureSince('total', 'queued', 'missing')
  mockClock = 6000
  trace.measureSince('total', 'queued', 'a')
  expect(mockSpans.map((s) => [s.name, s.correlationId, s.durationMs])).toEqual(
    [
      ['firstByte', 'b', 500],
      ['firstByte', 'a', 4000],
      ['total', 'a', 6000],
    ]
  )
  trace.clear('a')
  trace.measureSince('afterClear', 'queued', 'a')
  expect(mockSpans).toHaveLength(3)
  await client.dispose()
})
it('deduplicates per measure and id across re-marking and different start names', async () => {
  const client = createTraceClient({ performance: false })
  await client.start()
  const { trace } = client
  trace.mark('queued', { id: 'a' })
  trace.measureSince('total', 'queued', 'a')
  trace.mark('queued', { id: 'a' })
  trace.measureSince('total', 'queued', 'a')
  trace.mark('other', { id: 'a' })
  trace.measureSince('total', 'other', 'a')
  expect(mockSpans).toHaveLength(1)
  trace.clear('a')
  trace.mark('queued', { id: 'a' })
  trace.measureSince('total', 'queued', 'a')
  expect(mockSpans).toHaveLength(2)
  await client.dispose()
})
it('retains legacy log lines, typed breadcrumb attributes and numeric/string metric values', async () => {
  const entries: Array<[string, TracingEntry]> = []
  const client = createTraceClient({
    performance: false,
    sink: (line, entry) => entries.push([line, entry]),
  })
  await client.start()
  client.trace.mark('queued', { id: 'upload-123456', bytes: 42, cached: false })
  client.trace.metric('throughput', 92.4, { id: 'upload-123456' })
  client.trace.metric('status', 'waiting')
  mockClock = 5000
  client.trace.measureSince('total', 'queued', 'upload-123456')
  expect(entries.map(([line]) => line)).toEqual([
    'queued [123456] {bytes=42 cached=false}',
    'throughput=92.4 [123456]',
    'status=waiting',
    'total 5000ms [123456]',
  ])
  expect(entries[0][1].attributes).toEqual({
    id: 'upload-123456',
    bytes: 42,
    cached: false,
  })
  expect(mockMetrics).toHaveLength(1)
  expect(mockMarks).toHaveLength(2) // textual metric retained as a native mark
  await client.dispose()
})
it('preserves async results and original failures even when the sink throws, and disabled work still runs', async () => {
  const sink = jest.fn(() => {
    throw new Error('broken logger')
  })
  const client = createTraceClient({ performance: false, sink })
  await client.start()
  expect(
    await client.trace.measure(
      'create',
      async () => {
        mockClock = 320
        return 'item'
      },
      { id: 'a' }
    )
  ).toBe('item')
  const failure = new Error('copy failed')
  await expect(
    client.trace.measure('copy', async () => {
      mockClock = 370
      throw failure
    })
  ).rejects.toBe(failure)
  expect(mockSpans.map((s) => [s.durationMs, s.outcome])).toEqual([
    [320, 'success'],
    [50, 'error'],
  ])
  expect(sink).toHaveBeenCalledTimes(2)
  await client.stop()
  client.trace.mark('ignored', { id: 'a' })
  client.trace.metric('ignored', 1)
  client.trace.measureSince('ignored', 'ignored', 'a')
  expect(await client.trace.measure('disabled', async () => 'value')).toBe(
    'value'
  )
  expect(mockSpans).toHaveLength(2)
  expect(mockMarks).toHaveLength(0)
  expect(mockMetrics).toHaveLength(0)
  expect(sink).toHaveBeenCalledTimes(2)
  await client.dispose()
})

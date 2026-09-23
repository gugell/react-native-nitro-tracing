import { recordPlayground } from './playground'
import type { Recording } from '../specs/Recording.nitro'
import type {
  MetricEvent,
  SpanEvent,
  SpanOptions,
  MetricOptions,
  ReadOptions,
  SpanOutcome,
} from '../types'
const fixture = (brokenCompletion = false) => {
  const spans: SpanEvent[] = []
  const metrics: MetricEvent[] = []
  let sequence = 0
  let identity = 0
  const stop = jest.fn()
  const dispose = jest.fn()
  const native = {
    stop,
    dispose,
    startSpan(options: SpanOptions) {
      const spanId = String(++identity)
      const timestampMs = Date.now()
      let ended = false
      return {
        spanId,
        recorded: true,
        end(outcome: SpanOutcome) {
          if (ended && !brokenCompletion) return
          ended = true
          spans.push({
            ...options,
            parentSpanId: options.parentSpanId ?? '',
            spanId,
            timestampMs,
            durationMs: Date.now() - timestampMs,
            outcome,
            sequence: ++sequence,
          })
        },
      }
    },
    recordMetric(options: MetricOptions) {
      metrics.push({
        ...options,
        timestampMs: Date.now(),
        sequence: ++sequence,
      })
    },
    async readEvents(options: ReadOptions) {
      const retained = [...spans, ...metrics]
        .filter((event) => event.sequence > options.afterSequence)
        .sort((a, b) => a.sequence - b.sequence)
        .slice(0, options.limit)
      return {
        spans: retained.filter((event) => 'spanId' in event),
        metrics: retained.filter((event) => 'value' in event),
        marks: [],
        nextSequence: retained.at(-1)?.sequence ?? options.afterSequence,
        earliestSequence: 1,
        droppedEvents: 0,
      }
    },
  }
  return { recording: native as unknown as Recording, stop, dispose }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
it('reports native scenario checks and preserves the existing recording', async () => {
  const native = fixture()
  const pending = recordPlayground(native.recording)
  await jest.runAllTimersAsync()
  const result = await pending
  expect(result.passed).toBe(true)
  expect(result.checks).toHaveLength(6)
  expect(result.checks.every((check) => check.passed)).toBe(true)
  expect(result.correlationId).toMatch(/^playground-/)
  expect(native.stop).not.toHaveBeenCalled()
  expect(native.dispose).not.toHaveBeenCalled()
})
it('reports failed idempotence based on retained events rather than assuming API correctness', async () => {
  const pending = recordPlayground(fixture(true).recording)
  await jest.runAllTimersAsync()
  const result = await pending
  expect(result.passed).toBe(false)
  expect(result.checks.find((check) => check.id === 'idempotent')?.passed).toBe(
    false
  )
})

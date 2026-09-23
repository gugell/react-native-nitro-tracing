import type { Recording } from '../specs/Recording.nitro'
import type { SpanEvent, MetricEvent } from '../types'
export type PlaygroundCheckId =
  'nested' | 'concurrency' | 'cancelled' | 'idempotent' | 'error' | 'metrics'
export interface PlaygroundReport {
  correlationId: string
  checks: { id: PlaygroundCheckId; passed: boolean }[]
  passed: boolean
}
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
/** Adds a small isolated scenario; never resets or stops the user's recording. */
export const recordPlayground = async (
  current: Recording
): Promise<PlaygroundReport> => {
  const identity = current.startSpan({
    name: 'playground.run',
    correlationId: '',
    attributes: [],
  })
  const correlationId = `playground-${identity.spanId}`
  identity.end('success')
  const root = current.startSpan({
    name: 'playground.pipeline',
    correlationId,
    attributes: [{ key: 'source', value: 'playground' }],
  })
  const start = (name: string) =>
    current.startSpan({
      name,
      correlationId,
      parentSpanId: root.spanId,
      attributes: [],
    })
  try {
    const first = start('playground.concurrent')
    const second = start('playground.concurrent')
    await Promise.all([
      delay(30).then(() => first.end('success')),
      delay(60).then(() => second.end('success')),
    ])
    const cancelled = start('playground.cancelled')
    cancelled.end('cancelled')
    const repeated = start('playground.idempotent')
    repeated.end('success')
    repeated.end('error')
    const failed = start('playground.error')
    failed.end('error')
    for (const value of [20, 45, 80])
      current.recordMetric({
        name: 'playground.throughput',
        correlationId,
        attributes: [],
        value,
        unit: 'byte/second',
      })
    root.end('success')
    const spans: SpanEvent[] = []
    const metrics: MetricEvent[] = []
    let afterSequence = 0
    // Native recordings cap at 100000 events. Retain only this scenario while scanning.
    for (let pageIndex = 0; pageIndex < 100; pageIndex++) {
      const page = await current.readEvents({ afterSequence, limit: 1000 })
      spans.push(
        ...page.spans.filter(
          (event) =>
            event.correlationId === correlationId ||
            event.spanId === root.spanId
        )
      )
      metrics.push(
        ...page.metrics.filter((event) => event.correlationId === correlationId)
      )
      if (
        page.nextSequence <= afterSequence ||
        page.spans.length + page.marks.length + page.metrics.length < 1000
      )
        break
      afterSequence = page.nextSequence
    }
    const concurrent = spans.filter(
      (span) => span.name === 'playground.concurrent'
    )
    const repeatedEvents = spans.filter(
      (span) => span.spanId === repeated.spanId
    )
    const checks: PlaygroundReport['checks'] = [
      {
        id: 'nested',
        passed:
          spans.length === 6 &&
          spans
            .filter((span) => span.spanId !== root.spanId)
            .every((span) => span.parentSpanId === root.spanId),
      },
      {
        id: 'concurrency',
        passed:
          concurrent.length === 2 &&
          concurrent[0].spanId !== concurrent[1].spanId &&
          Math.max(...concurrent.map((span) => span.timestampMs)) <=
            Math.min(
              ...concurrent.map((span) => span.timestampMs + span.durationMs)
            ),
      },
      {
        id: 'cancelled',
        passed: spans.some(
          (span) =>
            span.spanId === cancelled.spanId && span.outcome === 'cancelled'
        ),
      },
      {
        id: 'idempotent',
        passed:
          repeatedEvents.length === 1 &&
          repeatedEvents[0].outcome === 'success',
      },
      {
        id: 'error',
        passed: spans.some(
          (span) => span.spanId === failed.spanId && span.outcome === 'error'
        ),
      },
      {
        id: 'metrics',
        passed:
          metrics.length === 3 &&
          metrics.map((metric) => metric.value).join(',') === '20,45,80',
      },
    ]
    return {
      correlationId,
      checks,
      passed: checks.every((check) => check.passed),
    }
  } catch (error) {
    try {
      root.end('error')
    } catch {}
    throw error
  }
}

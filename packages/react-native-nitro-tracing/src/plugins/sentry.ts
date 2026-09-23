import type * as Sentry from '@sentry/react-native'
import type { SpanEvent } from '../types'
import type { TracePlugin } from './TracePlugin'
/** Optional Sentry capabilities; SDK initialization and consent remain app-owned. */
export interface SentryPluginOptions {
  /** Inject an installed SDK. This module has no runtime SDK dependency. */
  sentry: Pick<typeof Sentry, 'getClient' | 'spanToJSON' | 'startInactiveSpan'>
  /** Capture observable SDK spans locally. Defaults to false; sampling applies. */
  captureSpans?: boolean
  /** Explicitly opt into sending retained span names/timing/status to Sentry on stop. Defaults to false. */
  exportSpans?: boolean
  /** Only these sanitized custom attribute keys may leave the device. Defaults to none. */
  exportedAttributeKeys?: readonly string[]
}
/** Optional SDK measurements and opt-in export; neither direction is enabled implicitly. */
export function createSentryPlugin(options: SentryPluginOptions): TracePlugin {
  return { id: 'sentry', start({ recording, reportError }) {
    const { sentry } = options
    const stats = recording.getStats()
    const anchor = stats.startedAtUnixMs
    const client = sentry.getClient()
    if (options.captureSpans && !client) throw new Error('Initialize Sentry before enabling local capture')
    const unsubscribe = options.captureSpans ? client!.on('spanEnd', (span) => {
      try {
        const data = sentry.spanToJSON(span)
        if (data.data?.['nitro.exported'] || data.timestamp === undefined) return
        const start = data.start_timestamp * 1000 - anchor
        if (start < 0) return
        recording.recordSpan({
          name: (data.description || data.op || 'sentry.span').slice(0, 128),
          correlationId: data.trace_id, timestampMs: start,
          sourceSpanId: `sentry:${data.trace_id}:${data.span_id}`,
          sourceParentSpanId: data.parent_span_id ? `sentry:${data.trace_id}:${data.parent_span_id}` : undefined,
          durationMs: Math.max(0, (data.timestamp - data.start_timestamp) * 1000),
          outcome: data.status && data.status !== 'ok' ? 'error' : 'success',
          attributes: [{ key: 'source', value: 'sentry' }, { key: 'sentry.span_id', value: data.span_id }, { key: 'sentry.parent_span_id', value: data.parent_span_id || '' }],
        })
      } catch (error) { reportError(error) }
    }) : undefined
    return {
      stop() { unsubscribe?.() },
      async flush() {
        if (options.exportSpans !== true) return
        if (!sentry.getClient()) throw new Error('Initialize Sentry before exporting traces')
        const spans: SpanEvent[] = []
        let cursor = 0
        while (true) {
          const page = await recording.readEvents({ afterSequence: cursor, limit: 1000 })
          spans.push(...page.spans.filter((s) => !s.attributes.some((a) => a.key === 'source' && a.value === 'sentry')))
          if (page.nextSequence === cursor) break
          cursor = page.nextSequence
        }
        const remaining = new Map(spans.map((span) => [span.spanId, span]))
        const handles = new Map<string, ReturnType<typeof sentry.startInactiveSpan>>()
        const ordered: SpanEvent[] = []
        const keys = new Set(options.exportedAttributeKeys ?? [])
        while (remaining.size) {
          let progressed = false
          for (const [id, span] of remaining) {
            if (span.parentSpanId && remaining.has(span.parentSpanId)) continue
            const parentSpan = handles.get(span.parentSpanId)
            const exported = sentry.startInactiveSpan({
              name: span.name, op: 'nitro.trace', startTime: (anchor + span.timestampMs) / 1000,
              parentSpan: parentSpan ?? null, forceTransaction: !parentSpan,
              attributes: {
                ...Object.fromEntries(span.attributes.filter((a) => keys.has(a.key)).map((a) => [a.key, a.value])),
                'nitro.exported': true, 'nitro.span_id': id,
                'nitro.parent_missing': Boolean(span.parentSpanId && !parentSpan), 'nitro.outcome': span.outcome,
              },
            })
            exported.setStatus(span.outcome === 'success' ? { code: 1 } : { code: 2, message: span.outcome })
            handles.set(id, exported); ordered.push(span); remaining.delete(id); progressed = true
          }
          if (!progressed) throw new Error('Cannot export cyclic span parents')
        }
        for (const span of ordered.reverse()) handles.get(span.spanId)!.end((anchor + span.timestampMs + span.durationMs) / 1000)
      },
    }
  } }
}

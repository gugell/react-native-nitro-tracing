import type { TracingEntry } from '../client/TracingSink'
import type performance from 'react-native-performance'
import type { PerformanceObserver } from 'react-native-performance'
import type { TracePlugin } from './TracePlugin'
/** Default measurement-source dependencies; supports the installed RN performance API. */
export interface PerformancePluginOptions {
  /** Same clock used by the supplied observer's entries. */
  performance: typeof performance
  /** PerformanceObserver from react-native-performance. */
  PerformanceObserver: typeof PerformanceObserver
}
/** Observe user timing without patching globals, clearing shared buffers or timing network bodies. */
export function createPerformancePlugin(
  api: PerformancePluginOptions,
  onEntry?: (entry: TracingEntry) => void
): TracePlugin {
  return {
    id: 'performance',
    start({ recording, reportError }) {
      const offset = recording.getStats().nowMs - api.performance.now()
      let stopped = false
      const ingest = (
        entries: ReturnType<PerformanceObserver['takeRecords']>
      ) => {
        if (stopped) return
        for (const entry of entries) {
          try {
            const timestampMs = entry.startTime + offset
            if (timestampMs < 0) continue // Previous history is outside this recording.
            const data = entry as typeof entry & {
              value?: unknown
              detail?: { id?: unknown; unit?: unknown }
            }
            onEntry?.({
              name: entry.name,
              entryType: entry.entryType,
              durationMs: entry.duration,
              value:
                typeof data.value === 'string' || typeof data.value === 'number'
                  ? data.value
                  : undefined,
              attributes: data.detail,
            })
            const context = {
              name: entry.name.slice(0, 128),
              correlationId:
                typeof data.detail?.id === 'string'
                  ? data.detail.id.slice(0, 128)
                  : '',
              attributes: [
                { key: 'source', value: 'performance' },
                { key: 'source.startTimeMs', value: String(entry.startTime) },
              ],
            }
            if (entry.entryType === 'longtask')
              recording.recordSpan({
                ...context,
                name: 'js.longtask',
                timestampMs,
                durationMs: entry.duration,
                outcome: 'success',
              })
            else if (entry.entryType === 'measure')
              recording.recordSpan({
                ...context,
                timestampMs,
                durationMs: entry.duration,
                outcome: 'success',
              })
            else if (entry.entryType === 'mark')
              recording.mark({ ...context, timestampMs })
            else if (
              entry.entryType === 'metric' &&
              typeof data.value === 'number' &&
              Number.isFinite(data.value)
            )
              recording.recordMetric({
                ...context,
                timestampMs,
                value: data.value,
                unit:
                  typeof data.detail?.unit === 'string'
                    ? data.detail.unit.slice(0, 32)
                    : 'unspecified',
              })
          } catch (error) {
            reportError(error)
          }
        }
      }
      const observer = new api.PerformanceObserver((list) =>
        ingest(list.getEntries())
      )
      // Global RN observers reject unknown types; react-native-performance lacks longtask.
      const supported = (
        api.PerformanceObserver as { supportedEntryTypes?: readonly string[] }
      ).supportedEntryTypes
      const entryTypes = ['mark', 'measure', 'metric', 'longtask'].filter(
        (type) => (supported ? supported.includes(type) : type !== 'longtask')
      )
      try {
        observer.observe({ entryTypes } as never)
      } catch (error) {
        observer.disconnect()
        throw error
      }
      return {
        stop() {
          if (stopped) return
          try {
            ingest(observer.takeRecords())
          } finally {
            stopped = true
            observer.disconnect()
          }
        },
      }
    },
  }
}

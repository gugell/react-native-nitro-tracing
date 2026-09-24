import {
  createRuntimeMetricsPlugin,
  type RuntimeMetricsOptions,
} from '../plugins/runtimeMetrics'
import {
  formatTracingEntry,
  type TracingEntry,
  type TracingSink,
} from './TracingSink'
import type { Recording } from '../specs/Recording.nitro'
import type { RecordingOptions } from '../types'
import type { PerformancePluginOptions } from '../plugins/performance'
import { createPerformancePlugin } from '../plugins/performance'
import { startPlugins } from '../plugins/startPlugins'
import type { PluginHandle, TracePlugin } from '../plugins/TracePlugin'
import type { ReleaseProfilerPlugin } from '../plugins/releaseProfiler'
import { recordPlayground, type PlaygroundReport } from './playground'

export type ClientAttributes = Record<
  string,
  string | number | boolean | undefined
>
export interface TraceClientOptions {
  /** Optional app log/breadcrumb output; failures never affect measured work. */
  sink?: TracingSink
  plugins?: TracePlugin[]
  performance?: false | PerformancePluginOptions
  /** Opt in to foreground JS event-loop and frame-callback metrics. */
  runtimeMetrics?: boolean | RuntimeMetricsOptions
  onError?: (error: unknown) => void
  recordingOptions?: Partial<RecordingOptions>
  share?: (recording: Recording) => Promise<void>
  shareProfile?: (path: string) => Promise<void>
  /** Start Hermes sampling with each recording; stopped and saved with it. */
  autoProfile?: boolean
  profiler?: ReleaseProfilerPlugin
}
export interface TraceClientSnapshot {
  visible: boolean
  recording: boolean
  busy: boolean
  disposed: boolean
  error?: string
  profiling: boolean
  profilePath?: string
  playground?: PlaygroundReport
}
/** Each client exclusively owns its recording and producers. Consumers must dispose it. */
export function createTraceClient(options: TraceClientOptions = {}) {
  let recording: Recording | undefined
  let handle: PluginHandle | undefined
  const readinessStartMs = globalThis.performance.now()
  let readyReported = false
  let enabled = false
  let disposed = false
  let pending = 0
  let tail = Promise.resolve()
  let snapshot: TraceClientSnapshot = {
    visible: false,
    recording: false,
    busy: false,
    disposed: false,
    profiling: false,
  }
  const listeners = new Set<() => void>()
  const marks = new Map<
    string,
    { marks: Map<string, number>; emitted: Set<string> }
  >()
  const publish = (next: Partial<TraceClientSnapshot> = {}) => {
    snapshot = {
      ...snapshot,
      recording: enabled,
      disposed,
      busy: pending > 0,
      profiling: options.profiler?.isProfiling() ?? false,
      profilePath: options.profiler?.getProfilePath(),
      ...next,
    }
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        /* Observers cannot interrupt recording ownership. */
      }
    }
  }
  const reportError = (error: unknown) => {
    publish({ error: String(error) })
    try {
      options.onError?.(error)
    } catch {
      /* Diagnostics cannot change measured operations. */
    }
  }
  const safely = <T>(work: () => T): T | undefined => {
    try {
      return work()
    } catch (error) {
      reportError(error)
      return undefined
    }
  }
  const emit = (entry: TracingEntry) => {
    if (options.sink)
      safely(() => options.sink!(formatTracingEntry(entry), entry))
  }
  const enqueue = (work: () => Promise<void>) => {
    if (disposed) return Promise.reject(new Error('Trace client is disposed'))
    pending++
    publish()
    const result = tail.then(async () => {
      try {
        if (disposed) throw new Error('Trace client is disposed')
        await work()
      } finally {
        pending--
        publish()
      }
    })
    tail = result.catch(reportError)
    return result
  }
  const stopCurrent = async () => {
    enabled = false
    try {
      await handle?.stop()
    } finally {
      handle = undefined
      recording?.stop()
      marks.clear()
      publish()
    }
  }
  const startCurrent = async () => {
    await stopCurrent()
    if (disposed) throw new Error('Trace client is disposed')
    recording?.dispose()
    recording = undefined
    const { Tracing } = require('../index') as typeof import('../index')
    recording = Tracing.startRecording({
      maxEvents: 3000,
      maxBytes: 2 * 1024 * 1024,
      maxActiveSpans: 256,
      spanTimeoutMs: 30 * 60 * 1000,
      ...options.recordingOptions,
    })
    publish({ error: undefined, playground: undefined })
    try {
      const plugins = [...(options.plugins ?? [])]
      if (options.performance !== false) {
        const api =
          options.performance ??
          (() => {
            const { default: performance, PerformanceObserver } =
              require('react-native-performance') as typeof import('react-native-performance')
            return { performance, PerformanceObserver }
          })()
        plugins.unshift(
          createPerformancePlugin(api, options.sink ? emit : undefined)
        )
      }
      if (options.runtimeMetrics)
        plugins.push(
          createRuntimeMetricsPlugin(
            options.runtimeMetrics === true ? {} : options.runtimeMetrics
          )
        )
      if (options.profiler) plugins.push(options.profiler)
      handle = startPlugins(recording, plugins, reportError)
    } catch (error) {
      try {
        await stopCurrent()
      } catch (cleanupError) {
        reportError(cleanupError)
      }
      try {
        recording?.dispose()
      } finally {
        recording = undefined
      }
      throw error
    }
    enabled = true
    if (options.autoProfile && options.profiler)
      safely(() => options.profiler!.startProfiling())
    publish()
  }
  const context = (name: string, attributes?: ClientAttributes) => ({
    name,
    correlationId: String(attributes?.id ?? ''),
    attributes: Object.entries(attributes ?? {})
      .filter(([, value]) => value !== undefined)
      .slice(0, 32)
      .map(([key, value]) => ({
        key: key.slice(0, 64),
        value: String(value).slice(0, 512),
      })),
  })
  const trace = {
    mark(name: string, attributes?: ClientAttributes) {
      safely(() => {
        if (!enabled || !recording) return
        recording.mark(context(name, attributes))
        emit({ name, entryType: 'mark', durationMs: 0, attributes })
        if (typeof attributes?.id === 'string') {
          let bucket = marks.get(attributes.id)
          if (!bucket) {
            if (marks.size >= 512) marks.delete(marks.keys().next().value!)
            bucket = { marks: new Map(), emitted: new Set() }
            marks.set(attributes.id, bucket)
          }
          if (bucket.marks.size >= 64 && !bucket.marks.has(name))
            bucket.marks.delete(bucket.marks.keys().next().value!)
          bucket.marks.set(name, recording.getStats().nowMs)
        }
      })
    },
    metric(
      name: string,
      value: number | string,
      attributes?: ClientAttributes
    ) {
      safely(() => {
        if (!enabled || !recording) return
        const numeric = Number(value)
        if (Number.isFinite(numeric))
          recording.recordMetric({
            ...context(name, attributes),
            value: numeric,
            unit: String(attributes?.unit ?? 'count'),
          })
        else recording.mark(context(name, { ...attributes, value }))
        emit({ name, entryType: 'metric', durationMs: 0, value, attributes })
      })
    },
    async measure<T>(
      name: string,
      fn: () => Promise<T>,
      attributes?: ClientAttributes
    ): Promise<T> {
      const started =
        enabled && options.sink ? globalThis.performance.now() : undefined
      const span = safely(() =>
        enabled ? recording?.startSpan(context(name, attributes)) : undefined
      )
      try {
        const value = await fn()
        safely(() => span?.end('success'))
        return value
      } catch (error) {
        safely(() => span?.end('error'))
        throw error
      } finally {
        if (started !== undefined)
          emit({
            name,
            entryType: 'measure',
            durationMs: Math.max(0, globalThis.performance.now() - started),
            attributes,
          })
      }
    },
    measureSince(
      name: string,
      startName: string,
      id: string,
      attributes?: ClientAttributes
    ) {
      safely(() => {
        if (!enabled || !recording) return
        const bucket = marks.get(id)
        const start = bucket?.marks.get(startName)
        if (
          start === undefined ||
          bucket!.emitted.has(name) ||
          bucket!.emitted.size >= 64
        )
          return
        bucket!.emitted.add(name)
        const durationMs = Math.max(0, recording.getStats().nowMs - start)
        recording.recordSpan({
          ...context(name, { ...attributes, id, startName }),
          timestampMs: start,
          durationMs,
          outcome: 'success',
        })
        emit({
          name,
          entryType: 'measure',
          durationMs,
          attributes: { ...attributes, id },
        })
      })
    },
    clear(id: string) {
      marks.delete(id)
    },
  }
  return {
    /** Once per client lifetime: elapsed time from client creation to the app-defined ready signal. */
    reportAppReady() {
      if (readyReported || !enabled) return
      readyReported = true
      trace.metric(
        'app.ready.after_tracer_init',
        Math.max(0, globalThis.performance.now() - readinessStartMs),
        {
          unit: 'ms',
          source: 'app-readiness',
          definition:
            'Tracer initialization to app ready signal; excludes earlier JS and native startup',
        }
      )
    },
    trace,
    start: () => enqueue(startCurrent),
    stop: () => enqueue(stopCurrent),
    clear: () =>
      enqueue(async () => {
        const wasEnabled = enabled
        await startCurrent()
        if (!wasEnabled) await stopCurrent()
      }),
    getRecording: () => recording,
    getError: () => snapshot.error,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    open() {
      if (!disposed) publish({ visible: true })
    },
    close() {
      publish({ visible: false })
    },
    reportError,
    canShare: Boolean(options.share),
    canProfile: Boolean(options.profiler),
    canShareProfile: Boolean(options.shareProfile),
    export: () =>
      enqueue(async () => {
        if (!recording || !options.share) return
        await stopCurrent()
        await options.share(recording)
      }),
    toggleProfile: () =>
      enqueue(async () => {
        if (!enabled || !options.profiler) return
        if (options.profiler.isProfiling())
          await options.profiler.stopProfiling()
        else options.profiler.startProfiling()
      }),
    shareProfile: () =>
      enqueue(async () => {
        const path = options.profiler?.getProfilePath()
        if (path) await options.shareProfile?.(path)
      }),
    playground: () =>
      enqueue(async () => {
        if (enabled && recording)
          publish({ playground: await recordPlayground(recording) })
      }),
    dispose() {
      if (disposed) return tail
      disposed = true
      enabled = false
      publish({ visible: false })
      const result = tail.then(async () => {
        try {
          await stopCurrent()
        } finally {
          try {
            recording?.dispose()
          } finally {
            recording = undefined
            listeners.clear()
          }
        }
      })
      tail = result.catch(reportError)
      return result
    },
  }
}
export type TraceClient = ReturnType<typeof createTraceClient>

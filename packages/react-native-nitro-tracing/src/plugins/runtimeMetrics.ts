import type { TracePlugin } from './TracePlugin'
export interface RuntimeMetricsOptions {
  /** Reporting interval in ms, minimum 250; default 1000. */
  intervalMs?: number
  /** Observe JS requestAnimationFrame callbacks (not native UI frames). Default true. */
  frames?: boolean
}
/** Injectable clock/lifecycle surface for deterministic tests and alternate hosts. */
export interface RuntimeMetricsHost {
  now(): number
  isActive(): boolean
  subscribe(listener: (active: boolean) => void): () => void
  requestFrame(callback: () => void): number
  cancelFrame(id: number): void
}
const nativeHost = (): RuntimeMetricsHost => {
  const { AppState } = require('react-native') as typeof import('react-native')
  return {
    now: () => globalThis.performance.now(),
    isActive: () => AppState.currentState === 'active',
    subscribe: (listener) => {
      const subscription = AppState.addEventListener('change', (state) =>
        listener(state === 'active')
      )
      return () => subscription.remove()
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
  }
}
/** Low-volume foreground JS health samples. No per-frame native calls or UI FPS claims. */
export function createRuntimeMetricsPlugin(
  options: RuntimeMetricsOptions = {},
  host?: RuntimeMetricsHost
): TracePlugin {
  const interval = options.intervalMs ?? 1000
  if (!Number.isFinite(interval) || interval < 250)
    throw new Error('Runtime metrics interval must be at least 250ms')
  return {
    id: 'runtime-metrics',
    start({ recording, reportError }) {
      const api = host ?? nativeHost()
      let stopped = false
      let active = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let frame: number | undefined
      let started = 0
      let previousFrame: number | undefined
      let frames = 0
      let maxGap = 0
      let longGaps = 0
      const reset = () => {
        started = api.now()
        frames = 0
        maxGap = 0
        longGaps = 0
      }
      const emit = (name: string, value: number, unit: string) => {
        try {
          recording.recordMetric({
            name,
            value,
            unit,
            correlationId: '',
            attributes: [
              { key: 'source', value: 'js-runtime' },
              { key: 'scope', value: 'foreground' },
              { key: 'windowMs', value: String(api.now() - started) },
            ],
          })
        } catch (error) {
          reportError(error)
        }
      }
      const onFrame = () => {
        if (stopped || !active) return
        const now = api.now()
        if (previousFrame !== undefined) {
          const gap = Math.max(0, now - previousFrame)
          maxGap = Math.max(maxGap, gap)
          if (gap > 50) longGaps++
        }
        previousFrame = now
        frames++
        frame = api.requestFrame(onFrame)
      }
      const tick = () => {
        if (stopped || !active) return
        const elapsed = api.now() - started
        emit('js.event_loop.delay', Math.max(0, elapsed - interval), 'ms')
        if (options.frames !== false && elapsed > 0) {
          emit(
            'js.frame_callback.rate',
            (frames * 1000) / elapsed,
            'callbacks/s'
          )
          if (frames > 1) emit('js.frame_gap.max', maxGap, 'ms')
          emit('js.frame_gap.over_50ms', longGaps, 'count')
        }
        reset()
        timer = setTimeout(tick, interval)
      }
      const suspend = () => {
        clearTimeout(timer)
        if (frame !== undefined) api.cancelFrame(frame)
        frame = undefined
      }
      const change = (next: boolean) => {
        if (stopped || next === active) return
        active = next
        previousFrame = undefined
        suspend()
        reset()
        if (active) {
          timer = setTimeout(tick, interval)
          if (options.frames !== false) frame = api.requestFrame(onFrame)
        }
      }
      const unsubscribe = api.subscribe(change)
      change(api.isActive())
      return {
        stop() {
          stopped = true
          active = false
          suspend()
          unsubscribe()
        },
      }
    },
  }
}

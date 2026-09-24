import type { TracePlugin } from './TracePlugin'
export interface NativeMetricsOptions {
  /** Metric window; 250–60000 ms. Default 1000. */
  intervalMs?: number
  /** Main-thread frame metrics (ui.fps, ui.frame_gap.max, ui.frames.slow/frozen). Default true. */
  frames?: boolean
}
/**
 * Native measurement layer: a sampler thread writes process.cpu, process.memory and
 * main-thread frame windows straight into the recording, with no per-frame JS work.
 * Alternative or complement to Sentry's measurements; each metric carries source=native.
 */
export function createNativeMetricsPlugin(
  options: NativeMetricsOptions = {}
): TracePlugin {
  return {
    id: 'native-metrics',
    start({ recording }) {
      recording.startNativeSampling({
        intervalMs: options.intervalMs ?? 1000,
        frames: options.frames ?? true,
      })
      return { stop: () => recording.stopNativeSampling() }
    },
  }
}

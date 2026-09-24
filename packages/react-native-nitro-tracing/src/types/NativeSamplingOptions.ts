/** Native sampler settings for Recording.startNativeSampling. */
export interface NativeSamplingOptions {
  /** Window length for CPU, memory and frame metrics; 250–60000 ms. */
  intervalMs: number
  /** Observe main-thread display callbacks (CADisplayLink / Choreographer). */
  frames: boolean
}

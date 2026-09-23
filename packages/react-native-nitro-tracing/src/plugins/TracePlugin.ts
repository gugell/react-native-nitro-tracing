import type { Recording } from '../specs/Recording.nitro'
/** Shared native destination supplied to measurement and export plugins. */
export interface PluginContext {
  /** Active native recording. */
  recording: Recording
  /** Surface plugin failures without changing application operations. */
  reportError(error: unknown): void
}
/** Cleanup owned by a started plugin. */
export interface PluginHandle {
  /** Disconnect observers and finish export before native recording disposal. */
  stop(): void | Promise<void>
  /** Optional exporter flush after sources stop and native history freezes. */
  flush?(): void | Promise<void>
}
/** Optional measurement source, exporter or profiler integration. */
export interface TracePlugin {
  /** Unique stable configuration identity. */
  readonly id: string
  /** Start once per recording; must roll back resources if setup throws. */
  start(context: PluginContext): PluginHandle
}

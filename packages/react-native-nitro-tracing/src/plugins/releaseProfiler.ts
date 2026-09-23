import type { TraceSpan } from '../specs/TraceSpan.nitro'
import type { PluginContext, TracePlugin } from './TracePlugin'
/** Injected optional react-native-release-profiler module; never imported by core. */
export interface ReleaseProfilerApi {
  /** Start the process-wide Hermes sampler; false means unavailable. */
  startProfiling(): boolean | void
  /** Stop and save a local profile artifact. */
  stopProfiling(saveToDownloads?: boolean): Promise<string>
}
/** Manually controlled profiler integration. Sampling never starts on plugin setup. */
export interface ReleaseProfilerPlugin extends TracePlugin {
  /** Start one session owned by this plugin. */
  startProfiling(): void
  /** Finish profiling and return the artifact's local path. */
  stopProfiling(): Promise<string>
  /** Whether this plugin owns an active or stopping profile. */
  isProfiling(): boolean
  /** Last successful artifact; not sent to remote exporters. */
  getProfilePath(): string | undefined
}
// Hermes profiling is process-wide, so two plugin instances must not compete.
let owner: object | undefined
/** Attach manual Hermes profile controls to a recording. */
export function createReleaseProfilerPlugin(api: ReleaseProfilerApi): ReleaseProfilerPlugin {
  const identity = {}
  let context: PluginContext | undefined
  let active = false
  let span: TraceSpan | undefined
  let path: string | undefined
  let stopping: Promise<string> | undefined
  const plugin: ReleaseProfilerPlugin = {
    id: 'release-profiler',
    start(next) {
      if (context) throw new Error('Release profiler plugin is already attached')
      context = next
      return { async stop() {
        try { if (active) await plugin.stopProfiling() } finally { context = undefined }
      } }
    },
    startProfiling() {
      if (!context) throw new Error('Attach release-profiler plugin before profiling')
      if (owner) throw new Error('A release profiler session is already active')
      if (api.startProfiling() === false) throw new Error('Hermes sampling profiler is unavailable in this build')
      owner = identity; active = true; path = undefined
      try { span = context.recording.startSpan({ name: 'hermes.profile', correlationId: '', attributes: [{ key: 'source', value: 'release-profiler' }] }) }
      catch (error) { context.reportError(error) }
    },
    stopProfiling() {
      if (stopping) return stopping
      if (!active) return Promise.reject(new Error('No release profiler session is active'))
      stopping = (async () => {
        try { path = await api.stopProfiling(false); span?.end('success'); return path }
        catch (error) { span?.end('error'); throw error }
        finally { active = false; if (owner === identity) owner = undefined; span = undefined; stopping = undefined }
      })()
      return stopping
    },
    isProfiling: () => active,
    getProfilePath: () => path,
  }
  return plugin
}

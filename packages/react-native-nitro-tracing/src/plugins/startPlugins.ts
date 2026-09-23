import type { Recording } from '../specs/Recording.nitro'
import type { PluginHandle, TracePlugin } from './TracePlugin'
/** Start optional integrations. Failures are isolated; stop waits for all cleanup. */
export function startPlugins(recording: Recording, plugins: readonly TracePlugin[], onError: (error: unknown) => void): PluginHandle {
  const handles: PluginHandle[] = []
  const ids = new Set<string>()
  for (const plugin of plugins) {
    if (ids.has(plugin.id)) throw new Error(`Duplicate tracing plugin: ${plugin.id}`)
    ids.add(plugin.id)
  }
  const reportError = (error: unknown) => { try { onError(error) } catch { /* Error reporters cannot break capture. */ } }
  for (const plugin of plugins) {
    try { handles.push(plugin.start({ recording, reportError })) } catch (error) { reportError(error) }
  }
  let stopping: Promise<void> | undefined
  return { stop() {
    if (!stopping) stopping = (async () => {
      for (const handle of [...handles].reverse()) {
        try { await handle.stop() } catch (error) { reportError(error) }
      }
      try { recording.stop() } catch (error) { reportError(error) }
      for (const handle of handles) {
        try { await handle.flush?.() } catch (error) { reportError(error) }
      }
    })()
    return stopping
  } }
}

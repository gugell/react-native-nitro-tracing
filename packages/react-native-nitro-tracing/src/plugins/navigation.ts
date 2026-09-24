import type { TraceSpan } from '../specs/TraceSpan.nitro'
import type { TracePlugin } from './TracePlugin'
/** Structural subset of a React Navigation container ref (expo-router: useNavigationContainerRef()). */
export interface NavigationRefLike {
  addListener(event: 'state' | 'ready', listener: () => void): () => void
  getCurrentRoute(): { name: string; key?: string } | undefined
  /** React Navigation logs an error when getCurrentRoute() runs before mount. */
  isReady?(): boolean
}
export interface NavigationPluginOptions {
  /** Defaults to requestAnimationFrame. */
  requestFrame?: (callback: () => void) => unknown
}
/**
 * Per focused route: a `navigation.enter` mark, a `screen <name>` visit span (dwell time)
 * and a `navigation.transition` metric from state change to the second frame callback.
 * The transition is a render-opportunity estimate, not content readiness.
 */
export function createNavigationPlugin(
  ref: NavigationRefLike,
  options: NavigationPluginOptions = {}
): TracePlugin {
  return {
    id: 'navigation',
    start({ recording, reportError }) {
      const requestFrame =
        options.requestFrame ??
        ((callback: () => void) => requestAnimationFrame(callback))
      let visit: TraceSpan | undefined
      let current: string | undefined
      let visits = 0
      let stopped = false
      const enter = () => {
        if (stopped) return
        try {
          if (ref.isReady?.() === false) return
          const route = ref.getCurrentRoute()
          const key = route && (route.key ?? route.name)
          if (!route || key === current) return
          current = key
          visit?.end('success')
          visit = undefined
          const correlationId = `screen:${++visits}`
          const attributes = [
            { key: 'source', value: 'navigation' },
            { key: 'screen', value: route.name.slice(0, 1024) },
          ]
          const startedAt = recording.getStats().nowMs
          recording.mark({
            name: 'navigation.enter',
            correlationId,
            attributes,
          })
          visit = recording.startSpan({
            name: `screen ${route.name}`.slice(0, 200),
            correlationId,
            attributes,
          })
          requestFrame(() =>
            requestFrame(() => {
              if (stopped) return
              try {
                recording.recordMetric({
                  name: 'navigation.transition',
                  value: recording.getStats().nowMs - startedAt,
                  unit: 'ms',
                  correlationId,
                  attributes,
                })
              } catch (error) {
                reportError(error)
              }
            })
          )
        } catch (error) {
          reportError(error)
        }
      }
      // The initial route emits `ready`, not `state`; single-screen apps would record nothing.
      const unsubscribers = [
        ref.addListener('ready', enter),
        ref.addListener('state', enter),
      ]
      enter()
      return {
        stop() {
          stopped = true
          for (const unsubscribe of unsubscribers) unsubscribe()
          visit?.end('success')
        },
      }
    },
  }
}
/** For apps without React Navigation (custom tabs): pass to createNavigationPlugin, call setScreen on change. */
export function createScreenTracker(initial?: string) {
  let route = initial ? { name: initial } : undefined
  const listeners = new Set<() => void>()
  return {
    addListener(_event: 'state' | 'ready', listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    getCurrentRoute: () => route,
    setScreen(name: string) {
      if (route?.name === name) return
      route = { name }
      for (const listener of listeners) listener()
    },
  }
}

import type { TracePlugin } from './TracePlugin'
type Fetch = typeof fetch
export interface NetworkPluginOptions {
  /** Defaults to the global XMLHttpRequest, which backs axios and React Native's polyfilled fetch. */
  XMLHttpRequest?: { prototype: XMLHttpRequest }
  /** Object whose `fetch` is wrapped. Defaults to globalThis. */
  fetchHost?: { fetch?: Fetch }
  /** Skip matching URLs. Defaults to Metro symbolication requests. */
  ignore?: (url: string) => boolean
}
/** Path without origin/query; numeric, UUID and long hex segments become `:id` so requests group. */
export const urlTemplate = (url: string) =>
  url
    .split(/[?#]/)[0]
    .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
    .replace(
      /\/(\d+|[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{16,})(?=\/|$)/gi,
      '/:id'
    ) || '/'
/**
 * Opt-in request timing: method, URL without query, status and duration. Bodies and headers
 * are never read. XMLHttpRequest spans end at loadend; native fetch spans (expo/fetch,
 * nitro-fetch) end when response headers arrive, since reading bodies is left to the app.
 */
export function createNetworkPlugin(
  options: NetworkPluginOptions = {}
): TracePlugin {
  const ignore =
    options.ignore ?? ((url: string) => url.includes('/symbolicate'))
  return {
    id: 'network',
    start({ recording, reportError }) {
      let active = true
      const record = (
        method: string,
        url: string,
        startedAt: number,
        status: number,
        failure?: 'cancelled' | 'error'
      ) => {
        if (!active) return
        try {
          recording.recordSpan({
            name: `${method} ${urlTemplate(url)}`.slice(0, 200),
            correlationId: '',
            timestampMs: startedAt,
            durationMs: Math.max(0, recording.getStats().nowMs - startedAt),
            outcome:
              failure ?? (status === 0 || status >= 400 ? 'error' : 'success'),
            attributes: [
              { key: 'source', value: 'network' },
              { key: 'method', value: method },
              { key: 'url', value: url.split(/[?#]/)[0].slice(0, 1024) },
              { key: 'status', value: String(status) },
            ],
          })
        } catch (error) {
          reportError(error)
        }
      }

      const proto = (options.XMLHttpRequest ?? globalThis.XMLHttpRequest)
        ?.prototype
      const open = proto?.open
      const send = proto?.send
      const requests = new WeakMap<
        XMLHttpRequest,
        { method: string; url: string }
      >()
      const patchedOpen = function (
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        ...rest: unknown[]
      ) {
        if (active && !ignore(String(url)))
          requests.set(this, {
            method: String(method).toUpperCase(),
            url: String(url),
          })
        return (open as (...args: unknown[]) => void).call(
          this,
          method,
          url,
          ...rest
        )
      }
      const patchedSend = function (
        this: XMLHttpRequest,
        body?: Document | XMLHttpRequestBodyInit | null
      ) {
        const request = requests.get(this)
        if (active && request) {
          try {
            const startedAt = recording.getStats().nowMs
            let failure: 'cancelled' | 'error' | undefined
            this.addEventListener('abort', () => (failure = 'cancelled'))
            this.addEventListener('timeout', () => (failure = 'error'))
            this.addEventListener('error', () => (failure = 'error'))
            this.addEventListener('loadend', () =>
              record(
                request.method,
                request.url,
                startedAt,
                this.status,
                failure
              )
            )
          } catch (error) {
            reportError(error)
          }
        }
        return send!.call(this, body)
      }
      if (proto) {
        proto.open = patchedOpen as typeof proto.open
        proto.send = patchedSend
      }

      // whatwg-fetch marks itself `polyfill` and already runs through the XHR hook above.
      const host = options.fetchHost ?? (globalThis as { fetch?: Fetch })
      const originalFetch = host.fetch
      const wrapFetch =
        typeof originalFetch === 'function' &&
        !(originalFetch as Fetch & { polyfill?: boolean }).polyfill
      const patchedFetch: Fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        if (!active || ignore(url)) return originalFetch!(input, init)
        const method = String(
          init?.method ??
            (typeof input === 'object' && 'method' in input
              ? input.method
              : 'GET')
        ).toUpperCase()
        let startedAt = 0
        try {
          startedAt = recording.getStats().nowMs
        } catch (error) {
          reportError(error)
        }
        try {
          const response = await originalFetch!(input, init)
          record(method, url, startedAt, response.status)
          return response
        } catch (error) {
          record(
            method,
            url,
            startedAt,
            0,
            (error as { name?: string })?.name === 'AbortError'
              ? 'cancelled'
              : 'error'
          )
          throw error
        }
      }
      if (wrapFetch) host.fetch = patchedFetch

      return {
        stop() {
          active = false
          // ponytail: if another library wrapped after us, leave our pass-through wrappers in place.
          if (proto && proto.open === (patchedOpen as unknown))
            proto.open = open!
          if (proto && proto.send === patchedSend) proto.send = send!
          if (wrapFetch && host.fetch === patchedFetch)
            host.fetch = originalFetch
        },
      }
    },
  }
}

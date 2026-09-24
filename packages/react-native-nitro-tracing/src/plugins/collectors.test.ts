import { createNavigationPlugin, createScreenTracker } from './navigation'
import { createNetworkPlugin, urlTemplate } from './network'
import { createErrorsPlugin } from './errors'
import type { Recording } from '../specs/Recording.nitro'

const fakeRecording = () => {
  let now = 0
  const calls: { kind: string; options: any }[] = []
  const recording = {
    getStats: () => ({ nowMs: now }),
    mark: (options: unknown) => calls.push({ kind: 'mark', options }),
    recordMetric: (options: unknown) => calls.push({ kind: 'metric', options }),
    recordSpan: (options: unknown) => calls.push({ kind: 'span', options }),
    startSpan: (options: unknown) => {
      calls.push({ kind: 'start', options })
      return {
        end: (outcome: string) => calls.push({ kind: 'end', options: outcome }),
      }
    },
  } as unknown as Recording
  return { recording, calls, advance: (ms: number) => (now += ms) }
}
const reportError = (error: unknown) => {
  throw error
}

it('records one visit per route change and a two-frame transition', () => {
  const { recording, calls, advance } = fakeRecording()
  let route: { name: string; key: string } | undefined
  const listeners: Record<string, () => void> = {}
  const listener = () => listeners.state()
  const frames: (() => void)[] = []
  const handle = createNavigationPlugin(
    {
      addListener: (event, next) => (
        (listeners[event] = next),
        () => delete listeners[event]
      ),
      getCurrentRoute: () => {
        if (!route) throw new Error('read before ready')
        return route
      },
      isReady: () => route !== undefined,
    },
    { requestFrame: (callback) => frames.push(callback) }
  ).start({ recording, reportError })
  // Container not mounted yet at start; its initial route arrives via `ready`.
  route = { name: 'Home', key: 'home-1' }
  listeners.ready()
  listener() // Same route: ignored.
  route = { name: 'Cart', key: 'cart-1' }
  advance(10)
  listener()
  advance(40)
  frames.splice(0).forEach((frame) => frame())
  frames.splice(0).forEach((frame) => frame())
  handle.stop()
  expect(listeners).toEqual({})
  expect(calls.map((c) => c.kind)).toEqual([
    'mark',
    'start',
    'end',
    'mark',
    'start',
    'metric',
    'metric',
    'end',
  ])
  expect(calls[3].options.attributes).toContainEqual({
    key: 'screen',
    value: 'Cart',
  })
  expect(
    calls.filter((c) => c.kind === 'metric').map((c) => c.options.value)
  ).toEqual([50, 40])
})

it('times XHR requests without query strings and restores the prototype', () => {
  const { recording, calls, advance } = fakeRecording()
  class FakeXHR {
    status = 0
    listeners: Record<string, () => void> = {}
    open(_method: string, _url: string) {}
    send() {}
    addEventListener(type: string, listener: () => void) {
      this.listeners[type] = listener
    }
  }
  const originalOpen = FakeXHR.prototype.open
  // XHR-backed polyfill: must not be wrapped a second time.
  const polyfill = Object.assign(async () => new Response(), { polyfill: true })
  const fetchHost = { fetch: polyfill as unknown as typeof fetch }
  const handle = createNetworkPlugin({
    XMLHttpRequest: FakeXHR as unknown as { prototype: XMLHttpRequest },
    fetchHost,
  }).start({ recording, reportError })
  expect(fetchHost.fetch).toBe(polyfill)
  const request = new FakeXHR()
  request.open('get', 'https://api.test/orders/42?token=secret')
  request.send()
  advance(30)
  request.status = 503
  request.listeners.loadend()
  const ignored = new FakeXHR()
  ignored.open('POST', 'http://localhost:8081/symbolicate')
  ignored.send()
  handle.stop()
  expect(FakeXHR.prototype.open).toBe(originalOpen)
  expect(calls).toHaveLength(1)
  expect(calls[0].options).toMatchObject({
    name: 'GET /orders/:id',
    durationMs: 30,
    outcome: 'error',
  })
  expect(JSON.stringify(calls[0].options)).not.toContain('secret')
  expect(
    urlTemplate('/users/3f2a9c1e-1111-2222-3333-444455556666/avatar')
  ).toBe('/users/:id/avatar')
})

it('records uncaught errors, keeps the previous handler and restores it', () => {
  const { recording, calls } = fakeRecording()
  const seen: unknown[] = []
  let handler = (error: unknown) => void seen.push(error)
  const previous = handler
  const errorUtils = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next: typeof handler) => (handler = next),
  }
  const handle = createErrorsPlugin({ errorUtils }).start({
    recording,
    reportError,
  })
  handler(new TypeError('bad'))
  handle.stop()
  expect(seen).toHaveLength(1)
  expect(handler).toBe(previous)
  expect(calls[0].options.attributes).toContainEqual({
    key: 'message',
    value: 'TypeError: bad',
  })
})

it('times native fetch to response headers and records failures', async () => {
  const { recording, calls, advance } = fakeRecording()
  const native = jest.fn(async (input: RequestInfo | URL) => {
    advance(20)
    if (String(input).includes('fail')) throw new TypeError('offline')
    return { status: 201 } as Response
  })
  const fetchHost = { fetch: native as unknown as typeof fetch }
  const handle = createNetworkPlugin({ fetchHost }).start({
    recording,
    reportError,
  })
  await fetchHost.fetch('https://api.test/items?q=1', { method: 'post' })
  await expect(fetchHost.fetch('https://api.test/fail')).rejects.toThrow(
    'offline'
  )
  handle.stop()
  expect(fetchHost.fetch).toBe(native)
  expect(
    calls.map((c) => [c.options.name, c.options.durationMs, c.options.outcome])
  ).toEqual([
    ['POST /items', 20, 'success'],
    ['GET /fail', 20, 'error'],
  ])
})

it('tracks custom tab screens without React Navigation', () => {
  const { recording, calls } = fakeRecording()
  const tracker = createScreenTracker('upload')
  const handle = createNavigationPlugin(tracker, {
    requestFrame: () => undefined,
  }).start({ recording, reportError })
  tracker.setScreen('upload') // unchanged
  tracker.setScreen('live')
  handle.stop()
  tracker.setScreen('settings') // after stop: ignored
  expect(
    calls
      .filter((c) => c.kind === 'mark')
      .map((c) => c.options.attributes[1].value)
  ).toEqual(['upload', 'live'])
})

import type { Recording } from '../specs/Recording.nitro'
import { startPlugins } from './startPlugins'
import { createPerformancePlugin } from './performance'
import { createSentryPlugin, type SentryPluginOptions } from './sentry'
import { createReleaseProfilerPlugin } from './releaseProfiler'
function fixture() {
  const log: string[] = []
  const native = {
    getStats: jest.fn(() => ({
      startedAtUnixMs: 1000,
      nowMs: 10,
      sessionId: 'test',
    })),
    recordSpan: jest.fn(),
    mark: jest.fn(),
    recordMetric: jest.fn(),
    startSpan: jest.fn(() => ({ end: jest.fn() })),
    stop: jest.fn(() => {
      log.push('freeze')
    }),
    readEvents: jest.fn().mockResolvedValue({
      spans: [],
      marks: [],
      metrics: [],
      nextSequence: 0,
    }),
  }
  return { native, recording: native as unknown as Recording, log }
}
it('disconnects sources, freezes native history, then flushes exporters exactly once', async () => {
  const { recording, log } = fixture()
  const runner = startPlugins(
    recording,
    [
      {
        id: 'x',
        start: () => ({
          stop() {
            log.push('stop')
          },
          flush() {
            log.push('flush')
          },
        }),
      },
    ],
    jest.fn()
  )
  await runner.stop()
  await runner.stop()
  expect(log).toEqual(['stop', 'freeze', 'flush'])
})
it('isolates startup/cleanup failures while closing all other plugins', async () => {
  const { recording, native } = fixture()
  const error = jest.fn()
  const close = jest.fn()
  const runner = startPlugins(
    recording,
    [
      {
        id: 'fail',
        start() {
          throw new Error('fail')
        },
      },
      { id: 'ok', start: () => ({ stop: close }) },
    ],
    error
  )
  await runner.stop()
  expect(error).toHaveBeenCalledTimes(1)
  expect(close).toHaveBeenCalledTimes(1)
  expect(native.stop).toHaveBeenCalledTimes(1)
})
it('maps the performance clock and retains durations without clearing shared entries', () => {
  const { recording, native } = fixture()
  let callback: (list: { getEntries(): unknown[] }) => void = () => undefined
  const disconnect = jest.fn()
  class Observer {
    constructor(cb: typeof callback) {
      callback = cb
    }
    observe() {}
    takeRecords() {
      return [{ name: 'last', entryType: 'mark', startTime: 108 }]
    }
    disconnect() {
      disconnect()
    }
  }
  const plugin = createPerformancePlugin({
    performance: { now: () => 100 },
    PerformanceObserver: Observer,
  } as unknown as Parameters<typeof createPerformancePlugin>[0])
  const handle = plugin.start({ recording, reportError: jest.fn() })
  callback({
    getEntries: () => [
      { name: 'work', entryType: 'measure', startTime: 105, duration: 25 },
      { name: 'point', entryType: 'mark', startTime: 106 },
      { name: 'metric', entryType: 'metric', startTime: 107, value: 3 },
    ],
  })
  expect(native.recordSpan).toHaveBeenCalledWith(
    expect.objectContaining({ timestampMs: 15, durationMs: 25 })
  )
  expect(native.mark).toHaveBeenCalledWith(
    expect.objectContaining({ timestampMs: 16 })
  )
  expect(native.recordMetric).toHaveBeenCalledWith(
    expect.objectContaining({ timestampMs: 17 })
  )
  handle.stop()
  handle.stop()
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(native.mark).toHaveBeenLastCalledWith(
    expect.objectContaining({ name: 'last', timestampMs: 18 })
  )
})
it('does not start Hermes implicitly and serializes repeated stop requests', async () => {
  const { recording } = fixture()
  let finish: (path: string) => void = () => undefined
  const api = {
    startProfiling: jest.fn(() => true),
    stopProfiling: jest.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        })
    ),
  }
  const plugin = createReleaseProfilerPlugin(api)
  const handle = plugin.start({ recording, reportError: jest.fn() })
  expect(api.startProfiling).not.toHaveBeenCalled()
  plugin.startProfiling()
  expect(() => plugin.startProfiling()).toThrow('already active')
  const first = plugin.stopProfiling()
  const second = plugin.stopProfiling()
  expect(first).toBe(second)
  await Promise.resolve()
  finish('/cache/profile.cpuprofile')
  await first
  expect(plugin.getProfilePath()).toBe('/cache/profile.cpuprofile')
  expect(api.stopProfiling).toHaveBeenCalledTimes(1)
  await handle.stop()
})
it('Sentry does not export or subscribe unless explicitly configured', async () => {
  const { recording } = fixture()
  const on = jest.fn()
  const send = jest.fn()
  const sentry = {
    getClient: () => ({ on }),
    startInactiveSpan: send,
    spanToJSON: jest.fn(),
  } as unknown as SentryPluginOptions['sentry']
  const runner = startPlugins(
    recording,
    [createSentryPlugin({ sentry })],
    jest.fn()
  )
  await runner.stop()
  expect(on).not.toHaveBeenCalled()
  expect(send).not.toHaveBeenCalled()
})
it('exports measured Sentry timestamps and parent handles, children ending first', async () => {
  const { recording, native } = fixture()
  const ends: string[] = []
  const child = {
    name: 'child',
    spanId: 'c',
    parentSpanId: 'p',
    timestampMs: 5,
    durationMs: 4,
    outcome: 'error',
    attributes: [{ key: 'secret', value: 'never export' }],
    correlationId: '',
    sequence: 1,
  }
  const parent = {
    ...child,
    name: 'parent',
    spanId: 'p',
    parentSpanId: '',
    timestampMs: 0,
    durationMs: 10,
    sequence: 2,
  }
  native.readEvents
    .mockResolvedValueOnce({ spans: [child, parent], nextSequence: 2 })
    .mockResolvedValue({ spans: [], nextSequence: 2 })
  const send = jest.fn((options) => ({
    end: jest.fn((time) => ends.push(`${options.name}:${time}`)),
    setStatus: jest.fn(),
  }))
  const sentry = {
    getClient: () => ({}),
    startInactiveSpan: send,
    spanToJSON: jest.fn(),
  } as unknown as SentryPluginOptions['sentry']
  const errors = jest.fn()
  const runner = startPlugins(
    recording,
    [createSentryPlugin({ sentry, exportSpans: true })],
    errors
  )
  await runner.stop()
  expect(errors).not.toHaveBeenCalled()
  expect(send.mock.calls[0][0]).toMatchObject({
    name: 'parent',
    startTime: 1,
    parentSpan: null,
  })
  expect(send.mock.calls[1][0].parentSpan).toBe(send.mock.results[0].value)
  expect(send.mock.calls[1][0].attributes.secret).toBeUndefined()
  expect(ends).toEqual(['child:1.009', 'parent:1.01'])
})
it('captures Sentry measurements locally and excludes our exported spans', async () => {
  const { recording, native } = fixture()
  let cb: (span: unknown) => void = () => undefined
  const unsubscribe = jest.fn()
  const on = jest.fn((_hook, callback) => {
    cb = callback
    return unsubscribe
  })
  const data = {
    start_timestamp: 1.01,
    timestamp: 1.03,
    trace_id: 'trace',
    span_id: 'span',
    description: 'SDK work',
    data: {},
  }
  const sentry = {
    getClient: () => ({ on }),
    startInactiveSpan: jest.fn(),
    spanToJSON: jest.fn(() => data),
  } as unknown as SentryPluginOptions['sentry']
  const runner = startPlugins(
    recording,
    [createSentryPlugin({ sentry, captureSpans: true })],
    jest.fn()
  )
  cb({})
  expect(native.recordSpan).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'SDK work',
      timestampMs: 10,
      correlationId: 'trace',
    })
  )
  data.data = { 'nitro.exported': true }
  cb({})
  expect(native.recordSpan).toHaveBeenCalledTimes(1)
  await runner.stop()
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})

it('recovers profiler ownership after a synchronous native stop failure', async () => {
  const { recording } = fixture()
  const api = {
    startProfiling: jest.fn(() => true),
    stopProfiling: jest
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('native stop')
      })
      .mockResolvedValue('/cache/second.cpuprofile'),
  }
  const plugin = createReleaseProfilerPlugin(api)
  const handle = plugin.start({ recording, reportError: jest.fn() })
  plugin.startProfiling()
  await expect(plugin.stopProfiling()).rejects.toThrow('native stop')
  plugin.startProfiling()
  await expect(plugin.stopProfiling()).resolves.toBe('/cache/second.cpuprofile')
  expect(api.stopProfiling).toHaveBeenCalledTimes(2)
  expect(plugin.isProfiling()).toBe(false)
  await handle.stop()
})

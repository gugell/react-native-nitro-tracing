import { createReleaseProfilerPlugin } from '../plugins/releaseProfiler'
import { createTraceClient } from './createTraceClient'
import type { Recording } from '../specs/Recording.nitro'
const mockFactory = jest.fn()
jest.mock('../index', () => ({
  Tracing: { startRecording: (...args: unknown[]) => mockFactory(...args) },
}))
const recording = () => ({
  getStats: jest.fn(() => ({ nowMs: 10, recording: true })),
  startSpan: jest.fn(() => ({ end: jest.fn() })),
  mark: jest.fn(),
  recordMetric: jest.fn(),
  recordSpan: jest.fn(),
  stop: jest.fn(),
  dispose: jest.fn(),
})
beforeEach(() => {
  mockFactory.mockReset()
  mockFactory.mockImplementation(recording)
})
it('owns independent recordings and visibility with stable snapshots', async () => {
  const first = createTraceClient({ performance: false })
  const second = createTraceClient({ performance: false })
  expect(first.getSnapshot()).toBe(first.getSnapshot())
  first.open()
  expect(first.getSnapshot().visible).toBe(true)
  expect(second.getSnapshot().visible).toBe(false)
  await first.start()
  await second.start()
  expect(first.getRecording()).not.toBe(second.getRecording())
  await first.dispose()
  expect(first.getRecording()).toBeUndefined()
  expect(second.getSnapshot().recording).toBe(true)
  await expect(first.start()).rejects.toThrow('disposed')
  await second.dispose()
})
it('preserves work and rejection even when tracing fails, without stats on the hot path', async () => {
  const client = createTraceClient({ performance: false })
  await client.start()
  const current = client.getRecording() as unknown as ReturnType<
    typeof recording
  >
  const error = new Error('original')
  await expect(
    client.trace.measure('work', async () => {
      throw error
    })
  ).rejects.toBe(error)
  expect(current.startSpan.mock.results[0].value.end).toHaveBeenCalledWith(
    'error'
  )
  current.startSpan.mockImplementationOnce(() => {
    throw new Error('native failure')
  })
  await expect(client.trace.measure('work', async () => 42)).resolves.toBe(42)
  client.trace.metric('count', 2)
  client.trace.mark('done')
  expect(current.getStats).not.toHaveBeenCalled()
  await client.dispose()
})
it('imports elapsed spans once per operation and releases correlation bookkeeping', async () => {
  const client = createTraceClient({ performance: false })
  await client.start()
  const current = client.getRecording() as unknown as ReturnType<
    typeof recording
  >
  client.trace.mark('queued', { id: 'a' })
  current.getStats.mockReturnValue({ nowMs: 30, recording: true })
  client.trace.measureSince('total', 'queued', 'a')
  client.trace.measureSince('total', 'queued', 'a')
  expect(current.recordSpan).toHaveBeenCalledTimes(1)
  expect(current.recordSpan).toHaveBeenCalledWith(
    expect.objectContaining({
      timestampMs: 10,
      durationMs: 20,
      outcome: 'success',
    })
  )
  client.trace.clear('a')
  client.trace.measureSince('other', 'queued', 'a')
  expect(current.recordSpan).toHaveBeenCalledTimes(1)
  await client.dispose()
})
it('waits for producer cleanup before disposing native history', async () => {
  let finish!: () => void
  let entered!: () => void
  const stopping = new Promise<void>((resolve) => {
    entered = resolve
  })
  const client = createTraceClient({
    performance: false,
    plugins: [
      {
        id: 'test',
        start: () => ({
          stop: () =>
            new Promise<void>((resolve) => {
              finish = resolve
              entered()
            }),
        }),
      },
    ],
  })
  await client.start()
  const current = client.getRecording() as unknown as ReturnType<
    typeof recording
  >
  const disposal = client.dispose()
  await stopping
  expect(current.dispose).not.toHaveBeenCalled()
  finish()
  await disposal
  expect(current.dispose).toHaveBeenCalledTimes(1)
})
it('freezes native history before invoking the configured sharing adapter', async () => {
  const share = jest.fn(async (current: Recording) => {
    expect(current.stop).toHaveBeenCalled()
  })
  const client = createTraceClient({ performance: false, share })
  await client.start()
  await client.export()
  expect(share).toHaveBeenCalledWith(client.getRecording(), 'recording')
  expect(client.getSnapshot().recording).toBe(false)
  await client.dispose()
})
it('retains plugin errors for inspection and notifies subscribers', async () => {
  const client = createTraceClient({
    performance: false,
    plugins: [
      {
        id: 'bad',
        start() {
          throw new Error('plugin failed')
        },
      },
    ],
  })
  const listener = jest.fn()
  const unsubscribe = client.subscribe(listener)
  await client.start()
  expect(client.getError()).toContain('plugin failed')
  expect(listener).toHaveBeenCalled()
  unsubscribe()
  await client.dispose()
})

it('releases native allocation when plugin configuration fails', async () => {
  const plugin = { id: 'duplicate', start: () => ({ stop() {} }) }
  const client = createTraceClient({
    performance: false,
    plugins: [plugin, plugin],
  })
  await expect(client.start()).rejects.toThrow('Duplicate')
  expect(mockFactory.mock.results[0].value.dispose).toHaveBeenCalledTimes(1)
  expect(client.getRecording()).toBeUndefined()
  await client.dispose()
})
it('cancels a queued start when the owner disposes immediately', async () => {
  const client = createTraceClient({ performance: false })
  const start = client.start()
  const disposal = client.dispose()
  await expect(start).rejects.toThrow('disposed')
  await disposal
  expect(mockFactory).not.toHaveBeenCalled()
  expect(client.getSnapshot().recording).toBe(false)
})

it('automatically profiles recordings and saves on stop, then restarts cleanly', async () => {
  const api = {
    startProfiling: jest.fn(),
    stopProfiling: jest.fn(async () => '/tmp/profile'),
  }
  const client = createTraceClient({
    performance: false,
    autoProfile: true,
    profiler: createReleaseProfilerPlugin(api),
  })
  await client.start()
  expect(client.getSnapshot().profiling).toBe(true)
  await client.stop()
  expect(api.stopProfiling).toHaveBeenCalledTimes(1)
  expect(client.getSnapshot().profilePath).toBe('/tmp/profile')
  await client.start()
  expect(api.startProfiling).toHaveBeenCalledTimes(2)
  await client.dispose()
  expect(api.stopProfiling).toHaveBeenCalledTimes(2)
})
it('keeps tracing available when automatic sampling is unsupported', async () => {
  const client = createTraceClient({
    performance: false,
    autoProfile: true,
    profiler: createReleaseProfilerPlugin({
      startProfiling: () => false,
      stopProfiling: async () => '',
    }),
  })
  await client.start()
  expect(client.getSnapshot().recording).toBe(true)
  expect(client.getSnapshot().profiling).toBe(false)
  expect(client.getError()).toContain('unavailable')
  await client.dispose()
})

it('records app readiness once per client lifetime with an explicit client initialization boundary', async () => {
  const clock = jest
    .spyOn(globalThis.performance, 'now')
    .mockReturnValue(1000000)
  const client = createTraceClient({ performance: false })
  clock.mockReturnValue(1000320)
  client.reportAppReady()
  await client.start()
  client.reportAppReady()
  client.reportAppReady()
  const current = mockFactory.mock.results[0].value
  expect(current.recordMetric).toHaveBeenCalledTimes(1)
  expect(current.recordMetric).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'app.ready.after_tracer_init',
      unit: 'ms',
      value: 320,
    })
  )
  await client.stop()
  await client.start()
  client.reportAppReady()
  expect(mockFactory.mock.results[1].value.recordMetric).not.toHaveBeenCalled()
  clock.mockRestore()
  await client.dispose()
})

import {
  createRuntimeMetricsPlugin,
  type RuntimeMetricsHost,
} from './runtimeMetrics'
import type { Recording } from '../specs/Recording.nitro'
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
it('reports real elapsed window rates and stalls, excludes background, and cleans up', async () => {
  let now = 0
  let callback: (() => void) | undefined
  let state!: (active: boolean) => void
  const remove = jest.fn()
  const host: RuntimeMetricsHost = {
    now: () => now,
    isActive: () => true,
    subscribe: (listener) => {
      state = listener
      return remove
    },
    requestFrame: (frame) => {
      callback = frame
      return 1
    },
    cancelFrame: jest.fn(),
  }
  const recordMetric = jest.fn()
  const handle = createRuntimeMetricsPlugin({}, host).start({
    recording: { recordMetric } as unknown as Recording,
    reportError: jest.fn(),
  })
  now = 10
  callback!()
  now = 30
  callback!()
  now = 100
  callback!()
  now = 1200
  jest.advanceTimersByTime(1000)
  const values = Object.fromEntries(
    recordMetric.mock.calls.map(([entry]) => [entry.name, entry.value])
  )
  expect(values).toEqual({
    'js.event_loop.delay': 200,
    'js.frame_callback.rate': 2.5,
    'js.frame_gap.max': 70,
    'js.frame_gap.over_50ms': 1,
  })
  state(false)
  now = 20000
  jest.advanceTimersByTime(10000)
  expect(recordMetric).toHaveBeenCalledTimes(4)
  state(true)
  now = 21000
  jest.advanceTimersByTime(1000)
  expect(recordMetric.mock.calls[4][0]).toMatchObject({
    name: 'js.event_loop.delay',
    value: 0,
  })
  await handle.stop()
  const count = recordMetric.mock.calls.length
  callback!()
  jest.advanceTimersByTime(5000)
  expect(recordMetric).toHaveBeenCalledTimes(count)
  expect(remove).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})
it('rejects sampling intervals that would create excessive work', () => {
  for (const intervalMs of [0, -1, NaN, Infinity, 100])
    expect(() => createRuntimeMetricsPlugin({ intervalMs })).toThrow('250ms')
})

import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { useTraceViewer, type Viewer } from './useTraceViewer'
import type { TraceClient } from '../client/createTraceClient'

it('updates observable counters without rerendering held content and applies queued data explicitly', async () => {
  ;(
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  jest.useFakeTimers()
  let sequence = 1
  let renders = 0
  let viewer!: Viewer
  let renderer!: ReactTestRenderer
  const snapshot = { visible: true, recording: true }
  const readEvents = jest.fn(
    async ({ afterSequence }: { afterSequence: number }) => ({
      spans: [],
      metrics: [],
      marks:
        sequence > afterSequence
          ? [
              {
                sequence,
                name: 'mark',
                correlationId: '',
                timestampMs: sequence,
                attributes: [],
              },
            ]
          : [],
      nextSequence: Math.max(afterSequence, sequence),
      earliestSequence: 1,
      droppedEvents: 0,
    })
  )
  const recording = {
    readEvents,
    getStats: () => ({
      sessionId: 'one',
      eventCount: sequence,
      nowMs: sequence * 1000,
      droppedEvents: 0,
    }),
  }
  const client = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    getRecording: () => recording,
    getError: () => undefined,
  } as unknown as TraceClient
  function Probe() {
    renders++
    viewer = useTraceViewer(client)
    return null
  }
  try {
    await act(async () => {
      renderer = create(React.createElement(Probe))
    })
    await act(async () => viewer.setHolding(true))
    const heldRenders = renders
    sequence = 2
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000)
    })
    expect(renders).toBe(heldRenders)
    expect(viewer.page.marks).toHaveLength(1)
    expect(viewer.telemetry.stats.peek()?.eventCount).toBe(2)
    expect(viewer.telemetry.pending.peek()?.nextSequence).toBe(2)
    expect(readEvents.mock.calls.at(-1)?.[0].afterSequence).toBe(1)
    await act(async () => viewer.apply())
    expect(viewer.page.marks).toHaveLength(2)
    expect(viewer.telemetry.pending.peek()).toBeUndefined()
    await act(async () => renderer.unmount())
    const reads = readEvents.mock.calls.length
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000)
    })
    expect(readEvents).toHaveBeenCalledTimes(reads)
  } finally {
    jest.useRealTimers()
  }
})

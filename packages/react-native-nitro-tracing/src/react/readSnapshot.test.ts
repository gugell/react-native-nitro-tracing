import { readSnapshot } from './readSnapshot'
import type { Recording } from '../specs/Recording.nitro'
it('reads all retained pages beyond the old 3000 event cap', async () => {
  const readEvents = jest.fn(async ({ afterSequence, limit }) => {
    const end = Math.min(4500, afterSequence + limit)
    return {
      spans: [],
      metrics: [],
      marks: Array.from({ length: end - afterSequence }, (_, i) => ({
        sequence: afterSequence + i + 1,
        name: 'mark',
        correlationId: '',
        timestampMs: i,
        attributes: [],
      })),
      nextSequence: end,
      earliestSequence: 1,
      droppedEvents: 0,
    }
  })
  const page = await readSnapshot({
    getStats: () => ({ eventCount: 4500 }),
    readEvents,
  } as unknown as Recording)
  expect(page.marks).toHaveLength(4500)
  expect(page.nextSequence).toBe(4500)
  expect(readEvents).toHaveBeenCalledTimes(5)
})
it('stops when the native cursor does not advance', async () => {
  const readEvents = jest.fn(async () => ({
    spans: [],
    marks: [],
    metrics: [],
    nextSequence: 0,
    earliestSequence: 0,
    droppedEvents: 0,
  }))
  await readSnapshot({
    getStats: () => ({ eventCount: 4500 }),
    readEvents,
  } as unknown as Recording)
  expect(readEvents).toHaveBeenCalledTimes(1)
})

it('transfers only new events and preserves unchanged collections', async () => {
  const marks = Array.from({ length: 4500 }, (_, i) => ({
    sequence: i + 1,
    name: 'mark',
    correlationId: '',
    timestampMs: i,
    attributes: [],
  }))
  const previous = {
    spans: [],
    metrics: [],
    marks,
    nextSequence: 4500,
    earliestSequence: 1,
    droppedEvents: 0,
  }
  const added = { ...marks[0], sequence: 4501 }
  const readEvents = jest.fn(async () => ({
    ...previous,
    marks: [added],
    nextSequence: 4501,
  }))
  const next = await readSnapshot(
    {
      getStats: () => ({ eventCount: 4501 }),
      readEvents,
    } as unknown as Recording,
    previous
  )
  expect(readEvents).toHaveBeenCalledTimes(1)
  expect(readEvents).toHaveBeenCalledWith({ afterSequence: 4500, limit: 1000 })
  expect(next.marks).toHaveLength(4501)
  expect(next.marks[0]).toBe(previous.marks[0])
  expect(next.spans).toBe(previous.spans)
  expect(next.metrics).toBe(previous.metrics)
})

it('returns the same snapshot when no data changes', async () => {
  const previous = {
    spans: [],
    metrics: [],
    marks: [],
    nextSequence: 12,
    earliestSequence: 13,
    droppedEvents: 12,
  }
  const readEvents = jest.fn(async () => ({ ...previous }))
  const next = await readSnapshot(
    { getStats: () => ({ eventCount: 0 }), readEvents } as unknown as Recording,
    previous
  )
  expect(next).toBe(previous)
})

it('removes evicted history even when no new events arrive', async () => {
  const marks = [1, 2, 3].map((sequence) => ({
    sequence,
    name: 'm',
    timestampMs: 0,
    correlationId: '',
    attributes: [],
  }))
  const previous = {
    spans: [],
    metrics: [],
    marks,
    nextSequence: 3,
    earliestSequence: 1,
    droppedEvents: 0,
  }
  const readEvents = jest.fn(async () => ({
    ...previous,
    marks: [],
    earliestSequence: 3,
    droppedEvents: 2,
  }))
  const next = await readSnapshot(
    { getStats: () => ({ eventCount: 1 }), readEvents } as unknown as Recording,
    previous
  )
  expect(next.marks.map((event) => event.sequence)).toEqual([3])
  expect(next.droppedEvents).toBe(2)
})

it('drains multiple delta pages without rereading retained history', async () => {
  const readEvents = jest.fn(async ({ afterSequence, limit }) => {
    const end = Math.min(7001, afterSequence + limit)
    return {
      spans: [],
      metrics: [],
      marks: Array.from({ length: end - afterSequence }, (_, i) => ({
        sequence: afterSequence + i + 1,
        name: 'm',
        timestampMs: 0,
        correlationId: '',
        attributes: [],
      })),
      nextSequence: end,
      earliestSequence: 4501,
      droppedEvents: 4500,
    }
  })
  const previous = {
    spans: [],
    marks: [],
    metrics: [],
    nextSequence: 4500,
    earliestSequence: 4501,
    droppedEvents: 4500,
  }
  const next = await readSnapshot(
    {
      getStats: () => ({ eventCount: 2501 }),
      readEvents,
    } as unknown as Recording,
    previous
  )
  expect(readEvents).toHaveBeenCalledTimes(3)
  expect(next.marks).toHaveLength(2501)
  expect(next.nextSequence).toBe(7001)
})

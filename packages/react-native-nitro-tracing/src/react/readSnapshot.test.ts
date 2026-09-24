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

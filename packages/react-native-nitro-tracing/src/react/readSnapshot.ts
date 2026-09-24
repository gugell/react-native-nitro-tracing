import type { Recording } from '../specs/Recording.nitro'
import type { TracePage } from '../types'
/** Bound work to retained history at read start, not an arbitrary UI result limit. */
export async function readSnapshot(recording: Recording): Promise<TracePage> {
  const page: TracePage = {
    spans: [],
    marks: [],
    metrics: [],
    nextSequence: 0,
    earliestSequence: 0,
    droppedEvents: 0,
  }
  const budget = Math.max(1, Math.ceil(recording.getStats().eventCount / 1000))
  for (let i = 0; i < budget; i++) {
    const batch = await recording.readEvents({
      afterSequence: page.nextSequence,
      limit: 1000,
    })
    const previous = page.nextSequence
    page.spans.push(...batch.spans)
    page.marks.push(...batch.marks)
    page.metrics.push(...batch.metrics)
    page.nextSequence = batch.nextSequence
    page.earliestSequence = batch.earliestSequence
    page.droppedEvents = batch.droppedEvents
    if (
      batch.nextSequence === previous ||
      batch.spans.length + batch.marks.length + batch.metrics.length < 1000
    )
      break
  }
  return page
}

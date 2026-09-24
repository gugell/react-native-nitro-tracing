import type { Recording } from '../specs/Recording.nitro'
import type { TracePage } from '../types'
/** Bound work to retained history at read start, not an arbitrary UI result limit. */
export async function readSnapshot(
  recording: Recording,
  previous?: TracePage
): Promise<TracePage> {
  const page: TracePage = {
    spans: [],
    marks: [],
    metrics: [],
    nextSequence: previous?.nextSequence ?? 0,
    earliestSequence: 0,
    droppedEvents: 0,
  }
  const budget = Math.max(1, Math.ceil(recording.getStats().eventCount / 1000))
  for (let i = 0; i < budget; i++) {
    const batch = await recording.readEvents({
      afterSequence: page.nextSequence,
      limit: 1000,
    })
    const cursor = page.nextSequence
    page.spans.push(...batch.spans)
    page.marks.push(...batch.marks)
    page.metrics.push(...batch.metrics)
    page.nextSequence = batch.nextSequence
    page.earliestSequence = batch.earliestSequence
    page.droppedEvents = batch.droppedEvents
    if (
      batch.nextSequence === cursor ||
      batch.spans.length + batch.marks.length + batch.metrics.length < 1000
    )
      break
  }
  if (!previous) return page
  if (
    page.nextSequence === previous.nextSequence &&
    page.earliestSequence === previous.earliestSequence &&
    page.droppedEvents === previous.droppedEvents
  )
    return previous
  const keep = <T extends { sequence: number }>(old: T[], added: T[]): T[] => {
    const evicted = old.length > 0 && old[0].sequence < page.earliestSequence
    if (!evicted && added.length === 0) return old
    return [
      ...(evicted
        ? old.filter((event) => event.sequence >= page.earliestSequence)
        : old),
      ...added,
    ]
  }
  return {
    ...page,
    spans: keep(previous.spans, page.spans),
    marks: keep(previous.marks, page.marks),
    metrics: keep(previous.metrics, page.metrics),
  }
}

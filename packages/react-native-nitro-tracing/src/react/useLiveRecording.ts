import { useEffect, useState } from 'react'
import type { TraceClient } from '../client/createTraceClient'
import type { Recording } from '../specs/Recording.nitro'
import type { TracePage } from '../types'
import { readSnapshot } from './readSnapshot'
/** Incremental polling of the active recording; unchanged snapshots keep their identity. */
export function useLiveRecording(
  client: TraceClient,
  active: boolean,
  intervalMs = 1000
) {
  const [page, setPage] = useState<TracePage>()
  useEffect(() => {
    if (!active) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let cached: TracePage | undefined
    let cachedRecording: Recording | undefined
    const tick = async () => {
      try {
        const recording = client.getRecording()
        if (recording) {
          if (recording !== cachedRecording) {
            cached = undefined
            cachedRecording = recording
          }
          cached = await readSnapshot(recording, cached)
          if (!cancelled) setPage(cached)
        }
      } catch (error) {
        client.reportError(error)
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs)
      }
    }
    void tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [client, active, intervalMs])
  return page
}

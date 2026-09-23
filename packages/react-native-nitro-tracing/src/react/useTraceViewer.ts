import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { TraceClient } from '../client/createTraceClient'
import type { RecordingStats, TracePage } from '../types'
import { groupTraces, metricSeries, waterfall } from './viewerModel'
const empty: TracePage = {
  spans: [],
  marks: [],
  metrics: [],
  nextSequence: 0,
  earliestSequence: 0,
  droppedEvents: 0,
}
export const useTraceViewer = (client: TraceClient) => {
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot
  )
  const { visible } = snapshot
  const [tab, setTab] = useState<
    'overview' | 'traces' | 'metrics' | 'playground'
  >('traces')
  const [page, setPage] = useState(empty)
  const [stats, setStats] = useState<RecordingStats>()
  const [error, setError] = useState<string>()
  const [query, setQuery] = useState('')
  const [selected, select] = useState<string>()
  const [spanId, selectSpan] = useState<string>()

  useEffect(() => {
    if (!visible) {
      setPage(empty)
      setStats(undefined)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const recording = client.getRecording()
        if (recording) {
          const snapshot: TracePage = {
            ...empty,
            spans: [],
            marks: [],
            metrics: [],
          }
          // Bound each refresh to native retention. Never accumulate a second JS history.
          for (let i = 0; i < 3; i++) {
            const batch = await recording.readEvents({
              afterSequence: snapshot.nextSequence,
              limit: 1000,
            })
            snapshot.spans.push(...batch.spans)
            snapshot.marks.push(...batch.marks)
            snapshot.metrics.push(...batch.metrics)
            snapshot.nextSequence = batch.nextSequence
            snapshot.earliestSequence = batch.earliestSequence
            snapshot.droppedEvents = batch.droppedEvents
            if (
              batch.spans.length + batch.marks.length + batch.metrics.length <
              1000
            )
              break
          }
          if (!cancelled && recording === client.getRecording()) {
            setPage(snapshot)
            setStats(recording.getStats())
          }
        }
        if (!cancelled) setError(client.getError())
      } catch (failure) {
        if (!cancelled) setError(String(failure))
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 1000)
      }
    }
    void refresh()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [visible, client])
  const groups = useMemo(() => groupTraces(page, query), [page, query])
  const totalTraces = useMemo(() => groupTraces(page, '').length, [page])
  const selectedId = groups.some((group) => group.id === selected)
    ? selected
    : groups[0]?.id
  const matches = (id: string) => (id || 'uncorrelated') === selectedId
  const rows = waterfall(
    page.spans.filter((span) => matches(span.correlationId))
  )
  const span = rows.find((row) => row.span.spanId === spanId)?.span
  const metrics = metricSeries(
    page.metrics.filter((metric) => matches(metric.correlationId))
  )
  const marks = page.marks.filter((mark) => matches(mark.correlationId))
  const act = async (work: () => void | Promise<void>) => {
    try {
      await work()
    } catch (failure) {
      setError(String(failure))
    }
  }
  return {
    ...snapshot,
    playgroundResult: snapshot.playground,
    tab,
    setTab,
    summary: {
      traces: totalTraces,
      spans: page.spans.length,
      marks: page.marks.length,
      metrics: page.metrics.length,
    },
    openPlaygroundTrace: () => {
      if (snapshot.playground) {
        setQuery(snapshot.playground.correlationId)
        select(snapshot.playground.correlationId)
        setTab('traces')
      }
    },
    canShare: client.canShare,
    canProfile: client.canProfile,
    canShareProfile: client.canShareProfile,
    toggleProfile: () => void act(client.toggleProfile),
    shareProfile: () => void act(client.shareProfile),
    visible,
    close: client.close,
    stats,
    error,
    query,
    setQuery,
    groups: groups.slice(0, 100),
    truncated:
      groups.length > 100 ||
      rows.length > 100 ||
      marks.length > 100 ||
      metrics.length > 40 ||
      (stats?.eventCount ?? 0) > 3000,
    selectedId,
    select,
    rows: rows.slice(0, 100),
    span,
    selectSpan,
    metrics: metrics.slice(0, 40),
    marks: marks.slice(0, 100),
    busy: snapshot.busy,
    start: () => void act(client.start),
    stop: () => void act(client.stop),
    clear: () => void act(client.clear),
    export: () => void act(client.export),
    playground: () => void act(client.playground),
  }
}

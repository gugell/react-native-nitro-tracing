import { createStore } from './store'
import { readSnapshot } from './readSnapshot'
import {
  useCallback,
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { TraceClient } from '../client/createTraceClient'
import type { RecordingStats, TracePage, SpanEvent, MarkEvent } from '../types'
import {
  buildTraces,
  defaultQuery,
  queryEvents,
  queryTraces,
  traceForSpan,
  type ExplorerMode,
  type Query,
  type Trace,
} from './explorerModel'
import { recordingMetrics, operationMetrics } from './viewerModel'
import {
  buildTimeline,
  currentScreen,
  defaultBudgets,
  summarizeTopics,
  type Budgets,
} from './topics'
export type Metric = ReturnType<typeof recordingMetrics>[number]
export type Detail =
  | { kind: 'trace'; value: Trace }
  | { kind: 'span'; value: SpanEvent }
  | { kind: 'mark'; value: MarkEvent }
  | { kind: 'metric'; value: Metric }
export type Tab = 'overview' | 'timeline' | 'explore' | 'metrics' | 'tools'
export interface Telemetry {
  stats?: RecordingStats
  error?: string
  pending?: Pick<TracePage, 'nextSequence' | 'earliestSequence'>
}
const empty = (): TracePage => ({
  spans: [],
  marks: [],
  metrics: [],
  nextSequence: 0,
  earliestSequence: 0,
  droppedEvents: 0,
})
export const useTraceViewer = (
  client: TraceClient,
  budgets?: Partial<Budgets>
) => {
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    client.getSnapshot
  )
  const [tab, setTab] = useState<Tab>('overview')
  const [mode, setMode] = useState<ExplorerMode>('traces')
  const [page, setPage] = useState(empty)
  const [telemetry] = useState(() => createStore<Telemetry>({}))
  const setStats = (stats: RecordingStats) => telemetry.set({ stats })
  const setError = (error: string | undefined) => telemetry.set({ error })
  const pendingPage = useRef<TracePage | undefined>(undefined)
  const setPending = (value: TracePage | undefined) => {
    pendingPage.current = value
    telemetry.set({
      pending: value
        ? {
            nextSequence: value.nextSequence,
            earliestSequence: value.earliestSequence,
          }
        : undefined,
    })
  }
  const [queries, setQueries] = useState<Record<ExplorerMode, Query>>({
    traces: defaultQuery(),
    spans: defaultQuery(),
    marks: defaultQuery(),
  })
  const [details, setDetails] = useState<Detail[]>([])
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [metricQuery, setMetricQuery] = useState('')
  const [metricCategory, setMetricCategory] = useState('all')
  const [metricSort, setMetricSort] = useState('name')
  const offsets = useRef<Record<string, number>>({})
  const detailState = useRef<
    Record<
      string,
      {
        collapsed: string[]
        layout: 'waterfall' | 'list'
        attributes: string
        offset: number
      }
    >
  >({})
  const latestPage = useRef(page)
  const session = useRef<string | undefined>(undefined)
  const controls = useRef({ paused, holding, detail: details.length > 0 })
  controls.current = { paused, holding, detail: details.length > 0 }
  latestPage.current = page
  useEffect(() => {
    if (!snapshot.visible) return
    let cached: TracePage | undefined
    let cachedRecording: ReturnType<TraceClient['getRecording']>
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const recording = client.getRecording()
        if (recording) {
          if (cachedRecording !== recording) {
            cached = undefined
            cachedRecording = recording
          }
          const next = await readSnapshot(recording, cached)
          cached = next
          if (cancelled || recording !== client.getRecording()) return
          const current = recording.getStats()
          setStats(current)
          if (session.current !== current.sessionId) {
            session.current = current.sessionId
            setDetails([])
            setPending(undefined)
            setPage(next)
            setHolding(false)
            offsets.current = {}
            detailState.current = {}
            setQueries(
              (previous) =>
                Object.fromEntries(
                  Object.entries(previous).map(([key, q]) => [
                    key,
                    { ...q, from: '', to: '' },
                  ])
                ) as Record<ExplorerMode, Query>
            )
          } else if (
            controls.current.paused ||
            controls.current.holding ||
            controls.current.detail
          ) {
            if (
              next.nextSequence !== latestPage.current.nextSequence ||
              next.droppedEvents !== latestPage.current.droppedEvents
            )
              setPending(next)
          } else {
            setPage(next)
            setPending(undefined)
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
  }, [client, snapshot.visible])
  const traces = useMemo(() => buildTraces(page), [page.spans, page.marks])
  const metrics = useMemo(
    () => (tab === 'explore' ? [] : recordingMetrics(page)),
    [page, tab]
  )
  const collectors = snapshot.collectors
  const { appReadyMs, screenMs, requestMs, stallMs } = {
    ...defaultBudgets,
    ...budgets,
  }
  const summary = useMemo(
    () =>
      summarizeTopics(page, collectors ?? [], {
        appReadyMs,
        screenMs,
        requestMs,
        stallMs,
      }),
    [page, collectors, appReadyMs, screenMs, requestMs, stallMs]
  )
  const timeline = useMemo(
    () => (tab === 'timeline' ? buildTimeline(page, summary.issues) : []),
    [page, summary.issues, tab]
  )
  const screen = useMemo(() => currentScreen(page), [page.marks])
  const operations = useMemo(
    () => (tab === 'metrics' ? operationMetrics(page.spans) : []),
    [page.spans, tab]
  )
  const query = queries[mode]
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () =>
      mode === 'traces'
        ? queryTraces(traces, deferredQuery)
        : queryEvents(
            mode === 'spans' ? page.spans : page.marks,
            deferredQuery
          ),
    [mode, traces, page.spans, page.marks, deferredQuery]
  )
  const updateQuery = (patch: Partial<Query>) => {
    setHolding(true)
    setQueries((previous) => ({
      ...previous,
      [mode]: { ...previous[mode], ...patch },
    }))
    offsets.current[mode] = 0
  }
  const apply = () => {
    const pending = pendingPage.current
    if (pending) setPage(pending)
    setPending(undefined)
    setHolding(false)
  }
  const act = (work: () => void | Promise<void>) => {
    void Promise.resolve()
      .then(work)
      .catch((failure) => {
        setError(String(failure))
        client.reportError(failure)
      })
  }
  const detail = details[details.length - 1]
  // Stable identity lets memoized list rows skip re-rendering on live ticks.
  const open = useCallback((next: Detail) => {
    setHolding(true)
    setDetails((previous) => [...previous.slice(-31), next])
  }, [])
  const showEvents = (mode: 'spans' | 'marks', patch: Partial<Query>) => {
    setTab('explore')
    setMode(mode)
    setDetails([])
    setQueries((previous) => ({
      ...previous,
      [mode]: { ...defaultQuery(), ...patch },
    }))
    offsets.current[mode] = 0
    setHolding(true)
  }
  return {
    ...snapshot,
    client,
    tab,
    setTab: (next: Tab) => {
      setDetails([])
      setTab(next)
    },
    mode,
    setMode,
    page,
    telemetry,
    traces,
    topics: summary.topics,
    issues: summary.issues,
    timeline,
    screen,
    results,
    query,
    updateQuery,
    resetQuery: () => {
      setQueries((previous) => ({ ...previous, [mode]: defaultQuery() }))
      offsets.current[mode] = 0
    },
    loaded:
      mode === 'traces'
        ? traces.length
        : mode === 'spans'
          ? page.spans.length
          : page.marks.length,
    uncorrelated: useMemo(
      () =>
        page.spans.filter((s) => !s.correlationId).length +
        page.marks.filter((s) => !s.correlationId).length,
      [page.spans, page.marks]
    ),
    detail,
    detailState,
    details,
    open,
    back: () => setDetails((previous) => previous.slice(0, -1)),
    traceFor: (span: SpanEvent) => traceForSpan(traces, span),
    showSpans: (patch: Partial<Query>) => showEvents('spans', patch),
    showMarks: (patch: Partial<Query>) => showEvents('marks', patch),
    paused,
    holding,
    setHolding,
    apply,
    togglePause: () => {
      if (paused) apply()
      setPaused(!paused)
    },
    offsets,
    metrics,
    operations,
    metricQuery,
    setMetricQuery,
    metricCategory,
    setMetricCategory,
    metricSort,
    setMetricSort,
    start: () => act(client.start),
    stop: () => act(client.stop),
    export: () => act(client.export),
    sharePerfetto: () => act(() => client.shareTrace('perfetto')),
    toggleProfile: () => act(client.toggleProfile),
    shareProfile: () => act(client.shareProfile),
    playground: () => act(client.playground),
    playgroundResult: snapshot.playground,
    openPlayground: () => {
      setTab('explore')
      setMode('traces')
      setQueries((previous) => ({
        ...previous,
        traces: {
          ...defaultQuery(),
          correlation: snapshot.playground?.correlationId ?? '',
        },
      }))
    },
  }
}
export type Viewer = ReturnType<typeof useTraceViewer>

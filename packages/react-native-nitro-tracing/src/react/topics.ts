import type { MarkEvent, MetricEvent, SpanEvent, TracePage } from '../types'

export type TopicId =
  | 'startup'
  | 'screens'
  | 'network'
  | 'responsiveness'
  | 'resources'
  | 'errors'
  | 'custom'
export const topicIds: TopicId[] = [
  'startup',
  'screens',
  'network',
  'responsiveness',
  'resources',
  'errors',
  'custom',
]
/** Text-presentation glyphs (no color emoji) and system tints per topic. */
export const topicGlyph: Record<TopicId, { icon: string; color: string }> = {
  startup: { icon: '◴', color: '#ff9500' },
  screens: { icon: '▢', color: '#007aff' },
  network: { icon: '⇅', color: '#34c759' },
  responsiveness: { icon: '◷', color: '#5856d6' },
  errors: { icon: '△', color: '#ff3b30' },
  resources: { icon: '◫', color: '#30b0c7' },
  custom: { icon: '•', color: '#8e8e93' },
}
/** Local triage thresholds, not production SLOs. */
export interface Budgets {
  appReadyMs: number
  screenMs: number
  requestMs: number
  stallMs: number
}
export const defaultBudgets: Budgets = {
  appReadyMs: 2000,
  screenMs: 1000,
  requestMs: 1000,
  stallMs: 250,
}
export type AnyEvent = SpanEvent | MarkEvent | MetricEvent
export type IssueKind =
  | 'slowStartup'
  | 'slowScreen'
  | 'slowRequest'
  | 'failedRequest'
  | 'stall'
  | 'uiStall'
  | 'frozenFrames'
  | 'error'
export interface Issue {
  kind: IssueKind
  topic: TopicId
  title: string
  valueMs?: number
  budgetMs?: number
  event: AnyEvent
  /** Errors outrank budget overruns; overruns rank by value / budget. */
  severity: number
}
export interface TopicSummary {
  id: TopicId
  /** A collector is configured or the topic has events. */
  tracked: boolean
  count: number
  /** Nearest-rank p95 (screens: transition, network: duration) or latest app-ready. */
  value?: number
  /** Extra headline values, e.g. resources: latest cpu and memory. */
  values?: Record<string, string>
  issues: Issue[]
}
/** Collector plugin IDs that make a quiet topic "tracked" rather than "not tracked". */
const collectorsFor: Record<TopicId, string[]> = {
  startup: [],
  screens: ['navigation'],
  network: ['network', 'sentry'],
  responsiveness: ['runtime-metrics', 'native-metrics', 'sentry'],
  resources: ['native-metrics'],
  errors: ['errors'],
  custom: [],
}
export const attribute = (event: AnyEvent, key: string) =>
  event.attributes.find((a) => a.key === key)?.value
const isSpan = (event: AnyEvent): event is SpanEvent => 'spanId' in event
const isMetric = (event: AnyEvent): event is MetricEvent => 'unit' in event

export const topicOf = (event: AnyEvent): TopicId => {
  const source = attribute(event, 'source')
  if (
    event.name.startsWith('app.ready.') ||
    event.name.startsWith('app.start.')
  )
    return 'startup'
  if (event.name.startsWith('process.')) return 'resources'
  if (event.name.startsWith('ui.')) return 'responsiveness'
  if (source === 'navigation') return 'screens'
  if (source === 'network') return 'network'
  if (source === 'error') return 'errors'
  if (source === 'js-runtime' || event.name === 'js.longtask')
    return 'responsiveness'
  return 'custom'
}
const p95 = (values: number[]) => {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]
}
const over = (
  kind: IssueKind,
  topic: TopicId,
  title: string,
  event: AnyEvent,
  valueMs: number,
  budgetMs: number
): Issue | undefined =>
  valueMs > budgetMs
    ? {
        kind,
        topic,
        title,
        event,
        valueMs,
        budgetMs,
        severity: valueMs / budgetMs,
      }
    : undefined

export const summarizeTopics = (
  page: TracePage,
  collectors: readonly string[],
  budgets: Budgets = defaultBudgets
): { topics: TopicSummary[]; issues: Issue[] } => {
  const byTopic = new Map<TopicId, AnyEvent[]>(topicIds.map((id) => [id, []]))
  for (const event of [...page.spans, ...page.marks, ...page.metrics])
    byTopic.get(topicOf(event))!.push(event)
  const issues: Issue[] = []
  const add = (issue: Issue | undefined) => issue && issues.push(issue)
  for (const event of [...page.spans, ...page.marks, ...page.metrics]) {
    const topic = topicOf(event)
    if (isMetric(event)) {
      if (topic === 'startup')
        add(
          over(
            'slowStartup',
            topic,
            event.name,
            event,
            event.value,
            budgets.appReadyMs
          )
        )
      else if (event.name === 'navigation.transition')
        add(
          over(
            'slowScreen',
            topic,
            attribute(event, 'screen') ?? event.name,
            event,
            event.value,
            budgets.screenMs
          )
        )
      else if (event.name === 'ui.frame_gap.max')
        add(
          over(
            'uiStall',
            topic,
            event.name,
            event,
            event.value,
            budgets.stallMs
          )
        )
      else if (event.name === 'ui.frames.frozen' && event.value > 0)
        add({
          kind: 'frozenFrames',
          topic,
          title: `${event.value} frozen frames`,
          event,
          severity: 900,
        })
      else if (
        event.name === 'js.frame_gap.max' ||
        event.name === 'js.event_loop.delay'
      )
        add(
          over('stall', topic, event.name, event, event.value, budgets.stallMs)
        )
    } else if (isSpan(event)) {
      if (topic === 'network')
        add(
          event.outcome === 'error'
            ? {
                kind: 'failedRequest',
                topic,
                title: event.name,
                event,
                severity: 1000,
              }
            : over(
                'slowRequest',
                topic,
                event.name,
                event,
                event.durationMs,
                budgets.requestMs
              )
        )
      else if (event.name === 'js.longtask')
        add(
          over(
            'stall',
            topic,
            event.name,
            event,
            event.durationMs,
            budgets.stallMs
          )
        )
      else if (event.outcome === 'error')
        add({
          kind: 'error',
          topic: 'errors',
          title: event.name,
          event,
          severity: 1000,
        })
    } else if (topic === 'errors')
      add({
        kind: 'error',
        topic,
        title: attribute(event, 'message') ?? event.name,
        event,
        severity: 1000,
      })
  }
  issues.sort(
    (a, b) =>
      b.severity - a.severity || b.event.timestampMs - a.event.timestampMs
  )
  const topics = topicIds.map((id): TopicSummary => {
    const events = byTopic.get(id)!
    const own = issues.filter((issue) => issue.topic === id)
    const metricValues = (name: string) =>
      events
        .filter((e): e is MetricEvent => isMetric(e) && e.name === name)
        .map((e) => e.value)
    const spans = events.filter(isSpan)
    const summary = {
      id,
      tracked:
        id === 'custom' ||
        events.length > 0 ||
        collectorsFor[id].some((collector) => collectors.includes(collector)),
      issues: own,
    }
    switch (id) {
      case 'startup':
        return {
          ...summary,
          count: events.length,
          value: events.filter(isMetric).at(-1)?.value,
        }
      case 'screens':
        return {
          ...summary,
          count: events.filter((e) => e.name === 'navigation.enter').length,
          value: p95(metricValues('navigation.transition')),
        }
      case 'network':
        return {
          ...summary,
          count: spans.length,
          value: p95(spans.map((s) => s.durationMs)),
        }
      case 'resources': {
        const latest = (name: string) => {
          const values = metricValues(name)
          return values.length ? values[values.length - 1].toFixed(0) : '—'
        }
        return {
          ...summary,
          count: events.length,
          values: {
            cpu: latest('process.cpu'),
            memory: latest('process.memory'),
          },
        }
      }
      case 'responsiveness':
      case 'errors':
        return { ...summary, count: own.length }
      default:
        return { ...summary, count: spans.length }
    }
  })
  return { topics, issues }
}

export type TimelineItem =
  | { kind: 'screen'; key: string; name: string; timestampMs: number }
  | {
      kind: 'event'
      key: string
      event: AnyEvent
      topic: TopicId
      issue: boolean
    }
/**
 * Newest screen visit first, each followed by its events newest first. Visits come from
 * `navigation.enter` marks, so the active screen appears before its visit span completes.
 * Metrics are listed only when they are issues; periodic samples belong in Metrics.
 */
export const buildTimeline = (
  page: TracePage,
  issues: readonly Issue[],
  limit = 500
): TimelineItem[] => {
  const flagged = new Set<AnyEvent>(issues.map((issue) => issue.event))
  const visits = page.marks
    .filter(
      (m) =>
        m.name === 'navigation.enter' && attribute(m, 'source') === 'navigation'
    )
    .sort((a, b) => a.timestampMs - b.timestampMs)
  const visitSet = new Set<AnyEvent>(visits)
  const events = [
    ...page.spans.filter((s) => attribute(s, 'source') !== 'navigation'),
    ...page.marks.filter((m) => !visitSet.has(m)),
    ...page.metrics.filter((m) => flagged.has(m)),
  ]
    .sort((a, b) => b.timestampMs - a.timestampMs || b.sequence - a.sequence)
    .slice(0, limit)
  const groups = new Map<number, AnyEvent[]>()
  for (const event of events) {
    // ponytail: linear scan per event; binary search if visit counts grow large.
    let index = -1
    for (let i = visits.length - 1; i >= 0; i--)
      if (visits[i].timestampMs <= event.timestampMs) {
        index = i
        break
      }
    const group = groups.get(index) ?? []
    group.push(event)
    groups.set(index, group)
  }
  const items: TimelineItem[] = []
  for (let index = visits.length - 1; index >= -1; index--) {
    const group = groups.get(index) ?? []
    const visit = visits[index]
    if (!visit && !group.length) continue
    if (visits.length)
      items.push({
        kind: 'screen',
        key: visit ? `screen:${visit.sequence}` : 'screen:before',
        name: visit ? (attribute(visit, 'screen') ?? '') : '',
        timestampMs: visit?.timestampMs ?? 0,
      })
    for (const event of group)
      items.push({
        kind: 'event',
        key: `${'spanId' in event ? event.spanId : 'unit' in event ? 'metric' : 'mark'}:${event.sequence}`,
        event,
        topic: topicOf(event),
        issue: flagged.has(event),
      })
  }
  return items
}
export const currentScreen = (page: TracePage) => {
  let latest: MarkEvent | undefined
  for (const mark of page.marks)
    if (
      mark.name === 'navigation.enter' &&
      (!latest || mark.timestampMs >= latest.timestampMs)
    )
      latest = mark
  return latest && attribute(latest, 'screen')
}

export interface VisitSummary {
  /** Undefined when no navigation collector has recorded a screen yet. */
  screen?: string
  sinceMs?: number
  events: Extract<TimelineItem, { kind: 'event' }>[]
  requests: number
  stalls: number
  errors: number
  issues: number
}
/** The newest screen visit in a timeline: what happened on the screen the user is looking at. */
export const currentVisit = (items: readonly TimelineItem[]): VisitSummary => {
  const start = items.findIndex((item) => item.kind === 'screen')
  const header = start >= 0 ? items[start] : undefined
  const next = items.findIndex((item, i) => i > start && item.kind === 'screen')
  const events = items
    .slice(start + 1, start >= 0 && next >= 0 ? next : undefined)
    .filter((item) => item.kind === 'event')
  const count = (test: (item: (typeof events)[number]) => boolean) =>
    events.filter(test).length
  return {
    screen: header?.kind === 'screen' ? header.name : undefined,
    sinceMs: header?.kind === 'screen' ? header.timestampMs : undefined,
    events,
    requests: count((item) => item.topic === 'network'),
    stalls: count((item) => item.topic === 'responsiveness' && item.issue),
    errors: count(
      (item) =>
        item.topic === 'errors' ||
        ('outcome' in item.event && item.event.outcome === 'error')
    ),
    issues: count((item) => item.issue),
  }
}
/** Latest sample of a metric by name; undefined when not collected. */
export const latestMetric = (page: TracePage, name: string) => {
  let latest: MetricEvent | undefined
  for (const metric of page.metrics)
    if (
      metric.name === name &&
      (!latest || metric.timestampMs >= latest.timestampMs)
    )
      latest = metric
  return latest?.value
}

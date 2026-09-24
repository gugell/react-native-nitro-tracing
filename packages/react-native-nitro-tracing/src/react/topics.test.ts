import type { TracePage } from '../types'
import {
  buildTimeline,
  currentScreen,
  currentVisit,
  summarizeTopics,
} from './topics'

const source = (value: string) => [{ key: 'source', value }]
let sequence = 0
const span = (
  name: string,
  src: string,
  timestampMs: number,
  durationMs: number,
  outcome = 'success'
) => ({
  sequence: ++sequence,
  name,
  correlationId: '',
  attributes: source(src),
  spanId: `s${sequence}`,
  parentSpanId: '',
  timestampMs,
  durationMs,
  outcome: outcome as 'success',
})
const enter = (screen: string, timestampMs: number) => ({
  sequence: ++sequence,
  name: 'navigation.enter',
  correlationId: '',
  timestampMs,
  attributes: [...source('navigation'), { key: 'screen', value: screen }],
})
const metric = (
  name: string,
  src: string,
  value: number,
  timestampMs: number,
  extra: { key: string; value: string }[] = []
) => ({
  sequence: ++sequence,
  name,
  correlationId: '',
  timestampMs,
  unit: 'ms',
  value,
  attributes: [...source(src), ...extra],
})
const page = (): TracePage => ({
  spans: [
    span('GET /orders', 'network', 120, 1500),
    span('POST /pay', 'network', 130, 20, 'error'),
    span('GET /me', 'network', 10, 50),
    span('js.longtask', 'performance', 140, 400),
    span('checkout.submit', 'app', 150, 10, 'error'),
  ],
  marks: [
    enter('Home', 0),
    enter('Checkout', 100),
    {
      sequence: ++sequence,
      name: 'js.error',
      correlationId: '',
      timestampMs: 160,
      attributes: [...source('error'), { key: 'message', value: 'Boom' }],
    },
  ],
  metrics: [
    metric('navigation.transition', 'navigation', 1200, 101, [
      { key: 'screen', value: 'Checkout' },
    ]),
    metric('js.frame_gap.max', 'js-runtime', 30, 170),
  ],
  nextSequence: sequence,
  earliestSequence: 1,
  droppedEvents: 0,
})

it('ranks errors first, flags overruns per topic and reports untracked topics', () => {
  const { topics, issues } = summarizeTopics(page(), ['navigation', 'network'])
  expect(issues.map((i) => [i.kind, i.title])).toEqual([
    ['error', 'Boom'],
    ['error', 'checkout.submit'],
    ['failedRequest', 'POST /pay'],
    ['stall', 'js.longtask'],
    ['slowRequest', 'GET /orders'],
    ['slowScreen', 'Checkout'],
  ])
  const byId = Object.fromEntries(topics.map((topic) => [topic.id, topic]))
  expect(byId.screens).toMatchObject({ tracked: true, count: 2, value: 1200 })
  expect(byId.network).toMatchObject({ count: 3, value: 1500 })
  expect(byId.network.issues).toHaveLength(2)
  expect(byId.startup.tracked).toBe(false)
  expect(byId.responsiveness).toMatchObject({ tracked: true, count: 1 })
  const quiet = summarizeTopics(
    { ...page(), spans: [], marks: [], metrics: [] },
    ['errors']
  )
  expect(quiet.topics.find((t) => t.id === 'errors')!.tracked).toBe(true)
  expect(quiet.topics.find((t) => t.id === 'network')!.tracked).toBe(false)
})

it('groups events under the screen visit they happened in, newest first', () => {
  const current = page()
  const { issues } = summarizeTopics(current, [])
  const items = buildTimeline(current, issues)
  expect(
    items.map((item) =>
      item.kind === 'screen'
        ? `[${item.name}]`
        : `${item.event.name}${item.issue ? '!' : ''}`
    )
  ).toEqual([
    '[Checkout]',
    'js.error!',
    'checkout.submit!',
    'js.longtask!',
    'POST /pay!',
    'GET /orders!',
    'navigation.transition!',
    '[Home]',
    'GET /me',
  ])
  expect(currentScreen(current)).toBe('Checkout')
})

it('summarizes only the current screen visit', () => {
  const current = page()
  const { issues } = summarizeTopics(current, [])
  const visit = currentVisit(buildTimeline(current, issues))
  expect(visit).toMatchObject({
    screen: 'Checkout',
    sinceMs: 100,
    requests: 2,
    stalls: 1,
    errors: 3,
    issues: 6,
  })
  expect(visit.events.map((item) => item.event.name)).not.toContain('GET /me')
  const unnavigated = currentVisit(
    buildTimeline({ ...current, marks: [] }, issues)
  )
  expect(unnavigated.screen).toBeUndefined()
  expect(unnavigated.events.map((item) => item.event.name)).toContain('GET /me')
})

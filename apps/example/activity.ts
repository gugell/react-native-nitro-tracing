import type { TraceClient } from 'react-native-nitro-tracing/client'
import { createScreenTracker } from 'react-native-nitro-tracing/plugins'

/** Stand-in for navigation so the example needs no navigator. */
export const exampleScreens = createScreenTracker('Home')

/** Endpoints for generated requests. Point them at your own staging API to test it. */
export const activityUrls = {
  ok: 'https://example.com/',
  slow: 'https://httpbin.org/delay/2',
  // Nothing listens on the discard port, so this fails fast without a remote service.
  failed: 'http://127.0.0.1:9/',
}

const blockJs = (ms: number) => {
  const until = Date.now() + ms
  while (Date.now() < until);
}
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))
const request = (url: string) =>
  fetch(url).then(
    (response) => response.status,
    () => 0 // Failure is the point of the failed request; the collector records it.
  )
async function nestedSpans(client: TraceClient) {
  const recording = client.getRecording()
  if (!recording) return
  const correlationId = `generated:${Date.now()}`
  const parent = recording.startSpan({
    name: 'generated.operation',
    correlationId,
    attributes: [],
  })
  const child = (name: string) =>
    recording.startSpan({
      name,
      correlationId,
      parentSpanId: parent.spanId,
      attributes: [],
    })
  const load = child('generated.load')
  await delay(120)
  load.end('success')
  const save = child('generated.save')
  await delay(60)
  save.end('error')
  parent.end('error')
}
let screens = 0
const nextScreen = () => `Screen ${String.fromCharCode(65 + (screens++ % 3))}`

export interface Activity {
  label: string
  icon: string
  color: string
  description: string
  run: (client: TraceClient) => unknown
}
/**
 * Real activity for every inspector topic, driven through the installed collectors:
 * the screen tracker, XHR/fetch, the global error handler and JS scheduling. Use it to
 * check the inspector or any other instrumentation mounted in this app.
 */
export const activitySections: { title: string; items: Activity[] }[] = [
  {
    title: 'Screens',
    items: [
      {
        label: 'Screen Visit',
        icon: '▢',
        color: '#007aff',
        description:
          'Switches the tracked screen. The live sheet and Timeline start a new visit.',
        run: () => exampleScreens.setScreen(nextScreen()),
      },
      {
        label: 'Slow Screen',
        icon: '◔',
        color: '#ff9500',
        description:
          'Switches screen, then blocks JS for 1.2 s before the next frames: a real slow transition.',
        run: () => {
          exampleScreens.setScreen(nextScreen())
          blockJs(1200)
        },
      },
    ],
  },
  {
    title: 'Network',
    items: [
      {
        label: 'Request',
        icon: '⇅',
        color: '#34c759',
        description: `GET ${activityUrls.ok} through fetch; recorded by the network collector.`,
        run: () => request(activityUrls.ok),
      },
      {
        label: 'Slow Request',
        icon: '⧖',
        color: '#ff9500',
        description: `GET ${activityUrls.slow}, which responds after about 2 s.`,
        run: () => request(activityUrls.slow),
      },
      {
        label: 'Failed Request',
        icon: '⊘',
        color: '#ff3b30',
        description: `GET ${activityUrls.failed}: connection refused, recorded as a failed request.`,
        run: () => request(activityUrls.failed),
      },
    ],
  },
  {
    title: 'Performance',
    items: [
      {
        label: 'JS Stall',
        icon: '◷',
        color: '#5856d6',
        description:
          'Blocks the JS thread for 400 ms. Runtime metrics report the frame gap and timer delay.',
        run: () => blockJs(400),
      },
      {
        label: 'Event Burst',
        icon: '▦',
        color: '#30b0c7',
        description:
          'Records 500 marks at once to exercise retention, eviction and inspector rendering.',
        run: (client) => {
          for (let i = 0; i < 500; i++) client.trace.mark('generated.burst')
        },
      },
    ],
  },
  {
    title: 'Errors',
    items: [
      {
        label: 'JS Error',
        icon: '△',
        color: '#ff3b30',
        description:
          'Reports a non-fatal error to the global handler; LogBox shows it in development.',
        run: () =>
          ErrorUtils.getGlobalHandler()(
            new Error('Generated test error'),
            false
          ),
      },
      {
        label: 'Failing Spans',
        icon: '⋔',
        color: '#af52de',
        description:
          'A parent span with two children; the second child fails, so the trace shows an error.',
        run: nestedSpans,
      },
    ],
  },
]

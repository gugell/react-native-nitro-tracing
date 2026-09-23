const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
// Exercise the exact JS tracing engine installed by the React Native SDK.
const sentry = createRequire(
  require.resolve('@sentry/react-native/package.json')
)('@sentry/core')
const { createSentryPlugin } = require('../lib/commonjs/sentry.cjs')
const envelopes = []
const anchor = Date.now() - 100
const captured = []
const client = new sentry.ServerRuntimeClient({
  dsn: 'https://public@example.invalid/1',
  tracesSampleRate: 1,
  integrations: [],
  stackParser: () => [],
  // In-memory transport only: no network requests or external telemetry.
  transport: () => ({
    send: async (envelope) => {
      envelopes.push(envelope)
      return { statusCode: 200 }
    },
    flush: async () => true,
  }),
})
sentry.setCurrentClient(client)
client.init()
const common = { attributes: [], correlationId: '', outcome: 'success' }
const parent = {
  ...common,
  spanId: 'parent',
  parentSpanId: '',
  name: 'native parent',
  timestampMs: 20,
  durationMs: 30,
  sequence: 2,
}
const child = {
  ...common,
  spanId: 'child',
  parentSpanId: 'parent',
  name: 'native child',
  timestampMs: 25,
  durationMs: 10,
  sequence: 1,
}
const recording = {
  getStats: () => ({ startedAtUnixMs: anchor }),
  recordSpan: (event) => captured.push(event),
  readEvents: async ({ afterSequence }) => ({
    spans: afterSequence ? [] : [child, parent],
    nextSequence: 2,
  }),
}
async function run() {
  try {
    const errors = []
    const handle = createSentryPlugin({
      sentry,
      captureSpans: true,
      exportSpans: true,
    }).start({ recording, reportError: (error) => errors.push(error) })
    const source = sentry.startInactiveSpan({
      name: 'SDK measurement',
      forceTransaction: true,
      startTime: (anchor + 10) / 1000,
    })
    source.end((anchor + 15) / 1000)
    assert.equal(captured.length, 1)
    assert.equal(captured[0].name, 'SDK measurement')
    assert.ok(Math.abs(captured[0].durationMs - 5) < 0.001)
    await handle.stop()
    await handle.flush()
    await client.flush(1000)
    assert.deepEqual(errors, [])
    const transactions = envelopes
      .flatMap((envelope) => envelope[1])
      .filter((item) => item[0].type === 'transaction')
      .map((item) => item[1])
    const exported = transactions.find(
      (event) => event.transaction === 'native parent'
    )
    assert.ok(exported, 'native root transaction captured by real SDK')
    assert.equal(exported.start_timestamp, (anchor + 20) / 1000)
    assert.equal(exported.timestamp, (anchor + 50) / 1000)
    assert.equal(exported.spans.length, 1)
    assert.equal(exported.spans[0].description, 'native child')
    assert.equal(
      exported.spans[0].parent_span_id,
      exported.contexts.trace.span_id
    )
    assert.equal(exported.spans[0].start_timestamp, (anchor + 25) / 1000)
    assert.equal(exported.spans[0].timestamp, (anchor + 35) / 1000)
    assert.equal(captured.length, 1, 'export does not feed back into capture')
    console.log(
      'Real Sentry SDK capture, hierarchy, timestamps and in-memory envelopes passed'
    )
  } finally {
    await client.close(1000)
    sentry.setCurrentClient(undefined)
  }
}
run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

export const defaultLabels = {
  title: 'Performance inspector',
  eyebrow: 'DEVELOPER TOOLS',
  close: 'Close',
  recording: 'Recording live',
  stopped: 'Recording stopped',
  counters:
    '{{events}} events \u00b7 {{active}} active \u00b7 {{dropped}} dropped \u00b7 {{bytes}} bytes',
  start: 'Start new',
  stop: 'Stop',
  clear: 'Clear',
  export: 'Stop & export',
  retention: 'Bounded native history \u00b7 refreshes while open',
  traces: 'Traces',
  search: 'Search operation or correlation ID',
  traceSummary:
    '{{duration}} ms \u00b7 {{events}} events \u00b7 {{errors}} errors',
  empty: 'No traces yet. Use the app to capture activity.',
  waterfall: 'Span waterfall',
  noSpans: 'No completed spans in this trace.',
  spanDetails: 'Span {{id}} \u00b7 parent {{parent}} \u00b7 {{outcome}}',
  metrics: 'Metrics',
  operations: 'Operation outcomes',
  operationStats:
    '{{count}} spans · {{errors}} errors · {{errorRate}} error rate · {{cancelled}} cancelled · {{interrupted}} interrupted',
  metricsScope:
    'All traces · duration: series are derived from completed spans. Statistics cover retained samples, not the whole session.',
  emptyMetrics:
    'No samples yet. Use the app or run the playground. App-ready timing appears after a fresh launch; TTI requires an explicit readiness definition.',
  metricStats:
    'Latest {{latest}} · median {{median}} · min {{min}} · max {{max}} · p95 {{p95}} · {{count}} samples',
  marks: 'Marks',
  playground: 'Instrumentation playground',
  playgroundDescription:
    'Check nested spans, concurrent operations with the same name, cancellation, repeated completion, errors and metrics.',
  run: 'Run sample trace',
  profiling: 'CPU profile',
  profilingDescription:
    'Capture a native profiler artifact alongside this recording.',
  startProfile: 'Start CPU profile',
  stopProfile: 'Stop CPU profile',
  shareProfile: 'Share CPU profile',
  shareArtifact: 'Share performance recording',
  sharingUnavailable: 'File sharing is unavailable on this device.',
  cacheUnavailable: 'The application cache is unavailable.',
  truncated:
    'Showing up to 100 traces, spans and marks, and 40 metric series. Search to narrow traces; export includes all retained events.',
  overview: 'Overview',
  tabs: 'Inspector views',
  recordingSummary: 'Recording summary',
  summary:
    '{{traces}} traces · {{spans}} spans · {{marks}} marks · {{metrics}} metric samples loaded',
  session: 'Session {{id}} · elapsed {{elapsed}} ms',
  metricWindow:
    'Showing {{displayed}} / {{retained}} loaded samples · {{start}}–{{end}} ms since recording start',
  passed: 'PASS',
  failed: 'FAIL',
  scenarioResults: 'Scenario results',
  scenarioNotice:
    'Checks inspect retained native events; dropped or expired samples can fail a check.',
  scenarioNested: 'Explicit parent hierarchy',
  scenarioConcurrency: 'Overlapping spans with the same name',
  scenarioCancelled: 'Cancelled outcome',
  scenarioIdempotent: 'Repeated completion records once',
  scenarioError: 'Error outcome',
  scenarioMetrics: 'Native metric values',
  openScenario: 'Open scenario trace',
} as const
export type InspectorLabels = { [K in keyof typeof defaultLabels]: string }
export type InspectorLabelKey = keyof InspectorLabels
export type InspectorTranslator = (
  key: InspectorLabelKey,
  values?: Record<string, unknown>
) => string
export const createTranslator =
  (labels?: Partial<InspectorLabels>): InspectorTranslator =>
  (key, values) =>
    (labels?.[key] ?? defaultLabels[key]).replace(
      /{{(\w+)}}/g,
      (_, name: string) => String(values?.[name] ?? '')
    )

export const defaultLabels = {
  applyFilters: 'Apply filters',
  title: 'Performance',
  searchMatch: 'Search match',
  explore: 'Explore',
  profiles: 'Profiles',
  spans: 'Spans',
  events: 'events',
  actions: 'Actions',
  tools: 'Tools',
  back: 'Back',
  done: 'Done',
  details: 'Details',
  cancel: 'Cancel',
  filters: 'Filters & sort',
  sort: 'Sort',
  reset: 'Reset',
  exploreSearch: 'Search names, IDs or attributes',
  metricSearch: 'Search metrics',
  newest: 'Newest',
  oldest: 'Oldest',
  longest: 'Longest',
  shortest: 'Shortest',
  errors: 'Most errors',
  count: 'Most samples',
  name: 'Name',
  p95: 'Highest p95',
  source: 'Source',
  outcome: 'Outcome',
  success: 'Success',
  error: 'Error',
  cancelled: 'Cancelled',
  interrupted: 'Interrupted',
  noErrors: 'No recorded errors',
  minDuration: 'Minimum duration (ms)',
  from: 'From (ms since recording)',
  to: 'To (ms since recording)',
  correlation: 'Exact correlation ID',
  invalidRange: 'Enter nonnegative numbers, with From no later than To.',
  resultCount: '{{matching}} / {{loaded}} matching',
  traceRow: '{{spans}} spans · {{errors}} errors · {{source}}',
  noResults:
    'No matching events. Change filters or reset to see the retained recording.',
  uncorrelated: 'Uncorrelated',
  uncorrelatedHint:
    '{{count}} uncorrelated events are also available in Spans and Marks.',
  pauseUpdates: 'Pause updates',
  resumeUpdates: 'Resume updates',
  newEvents: 'Load {{count}} new events',
  detailFrozen:
    'Detail is held steady while capture continues. Return to load newer events.',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  missingParent: 'Parent is outside retained history.',
  wholeTrace: 'Show entire trace',
  similar: 'Find similar spans',
  parent: 'Parent',
  children: 'Children',
  attributes: 'Search attributes',
  evicted:
    'This event is outside retained history. Showing the last inspected snapshot.',
  all: 'All',
  runtime: 'Runtime',
  custom: 'Custom',
  metricBrief: 'Latest {{latest}} · p95 {{p95}} · {{count}} samples',
  metricSortNotice:
    'All retained traces. Numeric sorting compares raw values; check units when comparing series.',
  exportAll: 'Stop & share all trace JSON',
  replaceTitle: 'Replace current recording?',
  replaceDescription:
    'Start a new recording and discard the currently retained history. Export first to keep a copy.',
  retainedScope:
    'Counts and statistics cover retained history. Pause updates freezes this view, not recording or profiling.',
  lostHistory:
    '{{count}} events dropped or rejected; this history is incomplete.',
  slowest: 'Slowest spans',
  errorsOnly: 'Errors',
  profileSeparate:
    'CPU profiles are separate from trace JSON. Stop sampling to save and share the latest artifact.',
  noProfiler: 'No CPU profiler is configured for this client.',

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
    'All traces · app.ready.after_tracer_init measures tracer setup to app readiness, not TTI. duration: series are derived from completed spans. Statistics cover retained samples, not the whole session.',
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

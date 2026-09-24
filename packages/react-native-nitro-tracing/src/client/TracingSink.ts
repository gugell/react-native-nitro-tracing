/** Optional compatibility output for app logs and breadcrumbs, separate from native retention. */
export interface TracingEntry {
  name: string
  entryType: string
  durationMs: number
  value?: number | string
  attributes?: Record<string, unknown>
}
export type TracingSink = (line: string, entry: TracingEntry) => void
export function formatTracingEntry(entry: TracingEntry): string {
  const attributes = entry.attributes
  const id = attributes?.id
  const suffix = typeof id === 'string' ? ` [${id.slice(-6)}]` : ''
  const details = Object.entries(attributes ?? {})
    .filter(([key, value]) => key !== 'id' && value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
  const detail = details.length ? ` {${details.join(' ')}}` : ''
  const label =
    entry.entryType === 'metric'
      ? `${entry.name}=${entry.value}`
      : entry.entryType === 'measure'
        ? `${entry.name} ${entry.durationMs.toFixed(0)}ms`
        : entry.name
  return `${label}${suffix}${detail}`
}

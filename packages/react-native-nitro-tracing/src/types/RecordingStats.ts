/** Snapshot of a recording, returned by Recording.getStats. */
export interface RecordingStats {
  /** Recording identity. */
  sessionId: string
  /** Wall-clock anchor in Unix milliseconds, for correlation/export only. */
  startedAtUnixMs: number
  /** Native elapsed milliseconds at snapshot time. */
  nowMs: number
  /** Whether writes are accepted. */
  recording: boolean
  /** Retained completed events. */
  eventCount: number
  /** Accounted native payload bytes, including active spans. */
  retainedBytes: number
  /** Evicted or rejected event/span count. */
  droppedEvents: number
  /** Open spans. */
  activeSpans: number
}

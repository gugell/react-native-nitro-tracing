/** Native retention limits for Tracing.startRecording. All fields are required. */
export interface RecordingOptions {
  /** Maximum completed events retained; 1–100000. */
  maxEvents: number
  /** Retained payload budget including active spans; 1024–67108864 bytes. */
  maxBytes: number
  /** Maximum simultaneously active spans; 1–10000. */
  maxActiveSpans: number
  /** Expire abandoned spans on the next recorder access; milliseconds. */
  spanTimeoutMs: number
}

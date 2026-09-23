/** Attributes retained in a recording. Values should be sanitized at the producer. */
export interface TraceAttribute {
  /** Attribute name. */
  key: string
  /** Sanitized scalar representation. */
  value: string
}

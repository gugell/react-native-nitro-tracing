/** Bounded page query for Recording.readEvents; sequence zero starts at history. */
export interface ReadOptions {
  /** Exclusive completion sequence cursor. */
  afterSequence: number
  /** Maximum total events returned across all arrays; 1–1000. */
  limit: number
}

import { useEffect } from 'react'
import type { TraceClient } from '../client/createTraceClient'
/** Report the consumer's ready signal after a frame opportunity. Not native launch time or guaranteed TTI. */
export function useAppReadyMetric(client: TraceClient, ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const frame = requestAnimationFrame(() => client.reportAppReady())
    return () => cancelAnimationFrame(frame)
  }, [client, ready])
}

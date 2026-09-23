import { useEffect, useState } from 'react'
import {
  createTraceClient,
  type TraceClient,
} from 'react-native-nitro-tracing/client'
import {
  createExpoTraceSharing,
  registerTraceDevMenu,
} from 'react-native-nitro-tracing/expo'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'
import * as profiler from 'react-native-release-profiler'
/** Recreate ownership for every mount/refresh; dispose only that effect's client. */
export function useExampleTracing() {
  const [client, setClient] = useState<TraceClient>()
  useEffect(() => {
    const next = createTraceClient({
      ...createExpoTraceSharing(),
      profiler: createReleaseProfilerPlugin(profiler),
      onError: console.warn,
    })
    setClient(next)
    void next
      .start()
      .then(() => {
        if (__DEV__ && !next.getSnapshot().disposed)
          return registerTraceDevMenu(next)
      })
      .catch(next.reportError)
    return () => {
      void next.dispose().catch(console.warn)
    }
  }, [])
  return client
}

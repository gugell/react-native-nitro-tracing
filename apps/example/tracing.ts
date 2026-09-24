import { useEffect, useState } from 'react'
import {
  createTraceClient,
  type TraceClient,
} from 'react-native-nitro-tracing/client'
import {
  createExpoTraceSharing,
  registerTraceDevMenu,
} from 'react-native-nitro-tracing/expo'
import {
  createErrorsPlugin,
  createNativeMetricsPlugin,
  createNavigationPlugin,
  createNetworkPlugin,
} from 'react-native-nitro-tracing/plugins'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'
import * as profiler from 'react-native-release-profiler'
import { exampleScreens } from './activity'
/** Recreate ownership for every mount/refresh; dispose only that effect's client. */
export function useExampleTracing() {
  const [client, setClient] = useState<TraceClient>()
  useEffect(() => {
    const next = createTraceClient({
      ...createExpoTraceSharing(),
      runtimeMetrics: true,
      // On demand (Tools or Flag): continuous sampling raced Fast Refresh and a dev
      // reload mid-profile aborts in Hermes' sampler.
      autoProfile: false,
      profiler: createReleaseProfilerPlugin(profiler),
      plugins: [
        createNativeMetricsPlugin(),
        createNavigationPlugin(exampleScreens),
        createNetworkPlugin(),
        createErrorsPlugin(),
      ],
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

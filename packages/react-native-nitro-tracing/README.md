# react-native-nitro-tracing

In-app performance tracing for React Native, for development, custom and UAT builds. It records spans, marks and metrics into a bounded C++ recorder. Native collectors measure frames, CPU and memory, and a live inspector runs inside the app. Recordings export to [Perfetto](https://ui.perfetto.dev).

Requires the New Architecture, Hermes and [`react-native-nitro-modules`](https://nitro.margelo.com) ^0.37.1, in a development or native build. Expo Go cannot load it.

```sh
npx expo install react-native-nitro-tracing react-native-nitro-modules
# inspector and overlay:
npx expo install react-native-safe-area-context @legendapp/list
```

```ts
import { createTraceClient } from 'react-native-nitro-tracing/client'
import { createExpoTraceSharing } from 'react-native-nitro-tracing/expo'
import {
  createErrorsPlugin,
  createNativeMetricsPlugin,
  createNavigationPlugin,
  createNetworkPlugin,
} from 'react-native-nitro-tracing/plugins'

export const tracing = createTraceClient({
  ...createExpoTraceSharing(),
  runtimeMetrics: true,
  plugins: [
    createNativeMetricsPlugin(),
    createNavigationPlugin(navigationRef),
    createNetworkPlugin(),
    createErrorsPlugin(),
  ],
})
await tracing.start()
```

```tsx
import { TraceInspector, TraceOverlay } from 'react-native-nitro-tracing/react'

{
  showTracing && (
    <>
      <TraceOverlay client={tracing} />
      <TraceInspector client={tracing} />
    </>
  )
}
```

The package never gates itself on `__DEV__`; the app decides which builds include it. Tap **Flag** when something feels slow: it marks the moment and captures a CPU profile. **Share trace** sends a Perfetto file without stopping the recording.

## Entry points

| Import                                        | Contains                                                                    | Peers                                                                                                         |
| --------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `react-native-nitro-tracing`                  | Native `Tracing` API                                                        | `react-native-nitro-modules`                                                                                  |
| `react-native-nitro-tracing/client`           | `createTraceClient`: lifecycle, `trace` facade, share, flag                 | —                                                                                                             |
| `react-native-nitro-tracing/plugins`          | Native metrics, navigation, network, errors, runtime metrics, `TracePlugin` | —                                                                                                             |
| `react-native-nitro-tracing/react`            | `TraceInspector`, `TraceOverlay`, `useAppReadyMetric`, `defaultLabels`      | `react-native-safe-area-context`, `@legendapp/list`; optional `react-native-bottom-tabs`, `expo-glass-effect` |
| `react-native-nitro-tracing/expo`             | Share sheet adapter, dev menu item                                          | `expo-file-system`, `expo-sharing`, `expo-dev-client`                                                         |
| `react-native-nitro-tracing/performance`      | Performance API marks and measures                                          | optional `react-native-performance`                                                                           |
| `react-native-nitro-tracing/sentry`           | Sentry as a measurement layer, and span export                              | `@sentry/react-native`                                                                                        |
| `react-native-nitro-tracing/release-profiler` | Hermes CPU profiles for Flag and Tools                                      | `react-native-release-profiler`                                                                               |

## Documentation

[Getting started](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/getting-started.md) ·
[Collectors](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/collectors.md) ·
[Inspector and overlay](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/inspector.md) ·
[Exporting traces](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/exporting.md) ·
[Native API](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/native-api.md) ·
[Architecture](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/architecture.md) ·
[Troubleshooting](https://github.com/gugell/react-native-nitro-tracing/blob/main/docs/troubleshooting.md) ·
[Changelog](https://github.com/gugell/react-native-nitro-tracing/blob/main/packages/react-native-nitro-tracing/CHANGELOG.md)

MIT

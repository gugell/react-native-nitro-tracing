# Getting started

## Install

```sh
npx expo install react-native-nitro-tracing react-native-nitro-modules
```

Then install the peers for the parts you use. Each entry point loads only its own peers, so the core never pulls in UI or SDK code.

| You use                                   | Install                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Inspector and overlay (`/react`)          | `react-native-safe-area-context` (>=5.7 <6), `@legendapp/list` (3.x)                                 |
| Native tabs, menus and Liquid Glass (iOS) | `react-native-bottom-tabs` (>=1.4 <2), `expo-glass-effect` (>=56). Optional; RN fallbacks otherwise. |
| Dev menu item and file sharing (`/expo`)  | `expo-dev-client`, `expo-file-system`, `expo-sharing` (>=56)                                         |
| Performance API marks (`/performance`)    | `react-native-performance` (>=6). Optional; falls back to RN's global API.                           |
| Sentry as a measurement layer (`/sentry`) | `@sentry/react-native` (>=7.11 <9)                                                                   |
| Hermes CPU profiles (`/release-profiler`) | `react-native-release-profiler`                                                                      |

Native modules must be dependencies of the **app**, not only of this package: autolinking only sees the app's own dependencies, and a second copy of a native module breaks at runtime.

Rebuild the native app after installing: `npx expo run:ios` / `npx expo run:android`, or your own build pipeline. A JS reload does not add native code.

## Create the client

Create one client per app, in your service or setup layer, not inside a component.

```ts
import { createTraceClient } from 'react-native-nitro-tracing/client'
import { createExpoTraceSharing } from 'react-native-nitro-tracing/expo'
import {
  createErrorsPlugin,
  createNativeMetricsPlugin,
  createNavigationPlugin,
  createNetworkPlugin,
} from 'react-native-nitro-tracing/plugins'
import { createReleaseProfilerPlugin } from 'react-native-nitro-tracing/release-profiler'
import * as ReleaseProfiler from 'react-native-release-profiler'

export const tracing = createTraceClient({
  ...createExpoTraceSharing(), // share(), shareProfile()
  runtimeMetrics: true, // JS event loop and frame callbacks
  profiler: createReleaseProfilerPlugin(ReleaseProfiler), // Flag and Tools capture CPU profiles
  plugins: [
    createNativeMetricsPlugin(), // UI fps, slow/frozen frames, CPU, memory
    createNavigationPlugin(navigationRef), // screens and transitions
    createNetworkPlugin(), // XHR and native fetch
    createErrorsPlugin(), // uncaught JS errors
  ],
  onError: (error) => console.warn('[tracing]', error),
})

await tracing.start()
```

Every collector is optional. [Collectors](collectors.md) describes what each one records. A topic with no collector shows **Not tracked** in the inspector, so a missing signal is never mistaken for a healthy one.

With expo-router, pass `useNavigationContainerRef()` to `createNavigationPlugin`. For a custom tab container that is not a navigator, use `createScreenTracker()` and call `setScreen(name)` when the tab changes.

## Mount the UI

```tsx
import { TraceInspector, TraceOverlay } from 'react-native-nitro-tracing/react'

export function Root() {
  return (
    <>
      <App />
      {showTracing && (
        <>
          <TraceOverlay client={tracing} bottomOffset={tabBarHeight} />
          <TraceInspector client={tracing} />
        </>
      )}
    </>
  )
}
```

Mount both last, so the overlay draws above the app. `bottomOffset` docks the overlay's sheet above your own tab bar. The inspector is a full-screen modal; open it from the overlay (long-press the bubble), the dev menu, or `tracing.open()`.

## Choose which builds include it

The package never gates itself on `__DEV__`. The app decides who gets tracing:

```ts
const showTracing = __DEV__ || process.env.EXPO_PUBLIC_TRACING === '1' // e.g. set for UAT builds only
```

Recording has a cost: native sampling runs on its own thread (one window per second by default), and collectors wrap XHR and fetch. Keep it out of store builds unless you want it there.

In development builds, add the inspector to the Expo dev menu:

```ts
import { registerTraceDevMenu } from 'react-native-nitro-tracing/expo'

if (__DEV__) await registerTraceDevMenu(tracing)
```

`registerTraceDevMenu` uses Expo's `registerDevMenuItems`. If the app already registers its own items, compose them in the same call.

## Record something

- Every collector records automatically once the client starts.
- Wrap app work with the client's trace facade:

  ```ts
  const result = await tracing.trace.measure(
    'checkout.submit',
    () => submit(order),
    {
      id: order.id,
    }
  )
  tracing.trace.mark('checkout.opened', { id: order.id })
  ```

- Record startup readiness once the first screen is usable:

  ```tsx
  import { useAppReadyMetric } from 'react-native-nitro-tracing/react'

  useAppReadyMetric(tracing, isReady) // app.ready.after_tracer_init
  ```

  It records once, after `isReady` turns true and a frame renders. It measures time from client creation, so it excludes native launch and JS work before the client existed. It is not TTI, TTID or TTFD.

## Share a trace

Tap **Flag** in the overlay when something feels slow. It marks the moment and, with a profiler attached, captures 10 s of CPU profile. Then tap **Share trace** and open the file at [ui.perfetto.dev](https://ui.perfetto.dev). See [Exporting traces](exporting.md).

## Tear down

```ts
await tracing.dispose()
```

Dispose stops collectors, stops any running profile, and releases native history.

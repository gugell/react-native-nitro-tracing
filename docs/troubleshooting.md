# Troubleshooting

## The app aborts on reload while profiling

The crash is `invalid pthread_t passed to pthread_kill` on the `hermes-sampling` thread. Hermes' sampling profiler is process-wide. If a development reload (Fast Refresh full reload, Metro restart, dev menu Reload) tears down the JS runtime while it samples, the sampler signals a thread that no longer exists.

Keep `autoProfile` off in development and profile on demand: **Flag** (bounded, 10 s by default) or the inspector's Tools. Do not reload during a profile.

## `A release profiler session is already active`

Only one plugin instance can own the Hermes sampler. This happens when a new client starts profiling before the previous one finished stopping, typically with `autoProfile` and Fast Refresh. Profile on demand, or dispose the old client before creating a new one.

## Android crashes opening the inspector: `The style on this component requires your app theme to be Theme.MaterialComponents`

This came from `react-native-bottom-tabs` on Android, whose Material tab bar needs a MaterialComponents or Material3 app theme. The inspector now uses native tabs on iOS only, so update the package. Android uses the package's own tab bar.

## A topic says "Not tracked"

No collector for that topic is running. The row names what enables it; see [Collectors](collectors.md).

## Network shows nothing (Expo SDK 52+)

Expo installs a native `fetch` (`expo/fetch`) that bypasses `XMLHttpRequest`. The network collector wraps it too. If requests are still missing, check that the plugin starts before the requests are made, and that `ignore` does not match them. Transfers made in native code (OkHttp, URLSession, upload engines) are invisible to JS collectors; record them with a custom collector.

## The initial screen is missing from Screens

React Navigation emits `ready` for the first route, not `state`. The navigation collector handles both. If your navigator mounts later than the client starts, the first route appears once the container is ready. Custom tab containers need `createScreenTracker()` and `setScreen()`.

## Duplicate-key warnings from LegendList, or many events merged into one span

Two events share a span ID. Custom collectors must give each event a unique `sourceSpanId`. Truncating long IDs from the front collapses IDs that share a prefix, so keep the unique tail. The inspector keys rows by sequence, so the list itself stays correct.

## "Lost N spans, M marks; this history is incomplete"

Spans or marks exceeded the budget and the oldest were evicted. Raise `recordingOptions.maxEvents` / `maxBytes`, or record fewer events. Metric samples do not cause this: they roll within their half of the buffer.

## The inspector is laggy

- Close it while measuring. It renders while visible, and search runs on the JS thread.
- Use **Freeze view** to stop list updates while reading.
- In development, logging and dev-mode React dominate. Judge performance in a release or UAT build.

## Stale code after updating a local tarball

pnpm caches extracted tarballs by version, and Metro caches transforms. Bump the version when you repack, then restart Metro with `--clear`. Native changes (C++, Kotlin, Objective-C++) need a native rebuild. A JS reload is not enough.

## `clang-format` not found

macOS does not put `clang-format` on `PATH`. `pnpm format:native:check` falls back to Xcode's copy through `xcrun`, or install it with `brew install clang-format`.

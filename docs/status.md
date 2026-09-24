# Status

Snapshot: 2026-09-24, branch `inspector-topics`, package `0.5.7` (next release 0.6.0).

Goal: in-app performance tooling that works in dev, custom and UAT builds. Trace, catch slowness, and export traces for Perfetto.

## Verified

Verified on an iPhone 13 Pro Max and a Pixel 7a (dev builds), through a production host app and the example app. Checks: 66 JS tests, native recorder, export and sampler tests, typecheck, prettier and clang-format.

| Area           | State                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recorder (C++) | Bounded ring buffer. Metric samples may fill at most half, so long sessions keep their spans. Builds on armeabi-v7a.                                   |
| Native sampler | CPU, memory, UI fps, frame gap, and slow and frozen frames. iOS uses CADisplayLink; Android uses Choreographer.                                        |
| Export         | Perfetto / Chrome Trace Event JSON with lanes per source, the recording JSON, and the Hermes CPU profile.                                              |
| Collectors     | Native metrics, navigation and screens, network (XHR and native fetch), errors, Sentry (optional measurement layer), performance API, runtime metrics. |
| Inspector      | Summary (topics and issues), Timeline by screen, Explore (search, sort, filter), Metrics with units, trace waterfall.                                  |
| Native UI      | iOS: native tab bar with Liquid Glass, native menus, and glass surfaces. Android: the package's own tab bar and sheets.                                |
| Live overlay   | Draggable FPS bubble, and a peek/half sheet with UI and JS fps, CPU, memory, requests, stalls and errors, plus Flag and Share.                         |
| Localization   | Labels live in the package; `labels` / `translate` override them.                                                                                      |

## Known issues

- React Native 0.85's Android `HermesSamplingProfiler.disable()` re-enables sampling. The package stops Hermes directly after each profile and before reloads; other code calling that Java API is still affected.
- Android uses the package's own tab bar, because the Material tab bar needs a MaterialComponents app theme.

## Checklist

### Before UAT

- [ ] Run a release/UAT build on both platforms, covering: ProGuard, the overlay's show/hide flag, and sampler overhead with Hermes release settings.
- [x] Raise the default `maxEvents` for multi-hour sessions (10000 events, 6 MB; metrics use at most half).
- [x] Flag an issue with a bounded CPU profile, linked from the Perfetto export (`client.flag()`, `flagProfileMs`).
- [x] Guard the profiler against runtime teardown: stops really stop Hermes sampling (RN 0.85 Android binds `disable()` to `enable`), and a ReactHost before-destroy guard stops it before reloads.
- [x] Release tooling: release-it, conventional changelog, pack check, trusted-publishing workflow (see [releasing](releasing.md)).
- [ ] First npm publication (0.6.0), then configure the trusted publisher. Hosts use a vendored tarball until then.

### Polish

- [x] Summary topic headlines use formatted units.
- [x] Fix the example app's profiler race on Fast Refresh (profiling is on demand now).
- [ ] Android native tabs with image icons, if a host opts into a MaterialComponents theme.
- [x] Say what was lost: stats split `droppedEvents` into spans, marks and metric samples, and the inspector names them.

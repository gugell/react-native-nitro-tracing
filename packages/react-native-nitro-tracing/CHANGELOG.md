# Changelog

## 0.6.0

First public release. In-app performance tracing for React Native, for development, custom and UAT builds.

### Features

- **native:** bounded C++ recorder with a monotonic clock, explicit parent IDs, and source span IDs that link parents completing after their children.
- **native:** native sampler thread for UI fps, max frame gap, slow and frozen frames (CADisplayLink / Choreographer), process CPU and memory.
- **native:** `Recording.exportTraceEvents()` writes Chrome Trace Event / Perfetto JSON: a lane per source, instants for marks, and counters for metrics.
- **native:** metric samples may use at most half of the buffer and roll over within it, so long sessions keep their spans. Only lost spans and marks count as dropped history.
- **client:** `createTraceClient` owns the recording lifecycle, plugins, the `trace` facade (`mark`, `metric`, `measure`, `measureSince`) and sharing.
- **client:** `shareTrace('perfetto')` shares a trace without stopping the recording.
- **client:** `flag(note?)` marks a problem and captures a bounded Hermes CPU profile (`flagProfileMs`, default 10 s). The profile is linked from the export.
- **client:** keeps 10000 events / 6 MB by default for multi-hour UAT sessions.
- **plugins:** collectors for native metrics, navigation and screens (`createScreenTracker` for custom tabs), network (XHR and native fetch), JS errors, runtime metrics and the Performance API.
- **plugins:** Sentry as an alternative measurement layer: frames and app start map onto the same metric names. Optional span export.
- **inspector:**
  - Summary triages issues by topic: startup, screens, network, responsiveness, resources, errors.
  - Timeline groups events by screen visit.
  - Explore has search, sort and draft filters, with trace waterfalls.
  - Metrics carry units.
- **inspector:** native tab bar with Liquid Glass and native menus on iOS; React Native fallbacks elsewhere. Labels are localizable in the package.
- **inspector:** live overlay with a draggable FPS bubble, a non-modal sheet for the current screen, and Flag and Share buttons.
- **example:** Instruments-style activity generators for screens, network, stalls and errors.

### Bug Fixes

- **native:** armeabi-v7a builds compile (size_t narrowing).
- **inspector:** lists key rows by event sequence, so collectors that reuse a span ID cannot corrupt them.
- **inspector:** Android no longer crashes on AppCompat hosts: native tabs are iOS-only.

### Documentation

- Guides for getting started, collectors, inspector and overlay, exporting, native API, architecture, troubleshooting and releasing.

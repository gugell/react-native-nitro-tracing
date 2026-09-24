# Exporting traces

A recording can leave the device in three forms.

| Format             | How                                                                    | Stops recording | Open with                                                      |
| ------------------ | ---------------------------------------------------------------------- | --------------- | -------------------------------------------------------------- |
| Perfetto trace     | `client.shareTrace('perfetto')`, overlay **Share trace**, Share ⇪ menu | No              | [ui.perfetto.dev](https://ui.perfetto.dev), `chrome://tracing` |
| Recording JSON     | `client.export()`, Share ⇪ → Recording JSON                            | Yes             | Any JSON tool; lossless, `schemaVersion: 1`                    |
| Hermes CPU profile | `client.shareProfile()`, Share ⇪ → CPU profile                         | No              | Chrome DevTools Performance, speedscope                        |

Serialization runs off the JS thread (`recording.exportTraceEvents()` / `exportJson()`). Exported files contain the attributes you recorded, so do not record secrets.

## Perfetto trace

Chrome Trace Event JSON, aligned on one clock:

- **Spans** become slices. Each source gets its own lane (`network`, `navigation`, `upload-engine`, `app`…). Concurrent spans get extra lanes, so nesting stays valid.
- **Marks** (including flags and `js.error`) become instant events.
- **Metrics** become counter tracks: UI and JS fps, CPU, memory, frame gaps.

Open a flagged trace, find the `flag` instant, and read across the lanes: what was on the network, which screen was entering, whether the UI or JS thread stalled.

## Flag a problem

```ts
tracing.flag('checkout froze') // also the overlay's Flag button
```

`flag(note?)` records a `flag` mark. When a `profiler` is attached and idle, it also samples Hermes for `flagProfileMs` (default 10000; `0` records only the mark):

- the profile window appears as a `hermes.profile` span in the Perfetto export;
- when it finishes, a `hermes.profile.saved` mark carries the `.cpuprofile` path, and **Share ⇪ → CPU profile** shares that file.

A second flag inside the window adds a mark without starting another profile. Symbolicate release-build profiles with `react-native-release-profiler`'s tooling. There is no in-app flamegraph.

## Share adapters

`createExpoTraceSharing()` writes a temporary file and opens the native share sheet, then removes the file. To upload traces yourself, supply your own adapter:

```ts
createTraceClient({
  share: async (recording, format) => {
    const body =
      format === 'perfetto'
        ? await recording.exportTraceEvents()
        : await recording.exportJson()
    await uploadToYourBucket(body, `${format}.json`)
  },
  shareProfile: async (path) => uploadFile(path),
})
```

`format` is `'recording'` or `'perfetto'`. The export freezes a snapshot first, so it matches what the inspector showed.

## Retention

The client keeps 10000 events and 6 MB by default (`recordingOptions` overrides both). Metric samples may use at most half of the events: once they reach it, each new sample replaces the oldest sample. So an hour of 1 s sampling never pushes spans out, and a multi-hour UAT session keeps its traces. Spans and marks beyond the budget evict the oldest events, and `droppedEvents` counts them. The inspector says so when it happens.

`maxBytes` estimates retained payload, not process memory. Snapshot copies and export strings allocate temporarily on top of it.

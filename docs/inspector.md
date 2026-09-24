# Inspector and overlay

Both components come from `react-native-nitro-tracing/react` and take the same `client`. Mount them last at the app root.

```tsx
<TraceOverlay client={tracing} bottomOffset={tabBarHeight} budgets={budgets} />
<TraceInspector client={tracing} budgets={budgets} />
```

## Live overlay

`TraceOverlay` is for watching the app while you use it.

- **Bubble.** Shows UI fps from native metrics, or JS frame-callback fps without them. It turns red when the current screen has issues. Drag it anywhere; it snaps to the nearest edge.
- **Tap** opens a non-modal sheet. The app stays usable above it. The sheet streams the current screen visit: time on screen, UI and JS fps, CPU, memory, requests, stalls, errors, and the newest events. Drag or tap the grabber to switch between peek and half height.
- **Flag** marks the moment you noticed a problem and, with a profiler attached, captures a CPU profile of it. See [Exporting traces](exporting.md#flag-a-problem).
- **Share trace** shares a Perfetto trace without stopping the recording.
- **Long-press** the bubble, or tap Inspector, to open the full inspector.

It polls the recording every 2 s while the sheet is closed and every second while it is open. `bottomOffset` keeps the sheet above the app's own tab bar. The overlay sits below the app's own native modals.

## Inspector

`TraceInspector` is a full-screen modal with four tabs. On iOS with `react-native-bottom-tabs` installed, it uses a native `UITabBarController`: Liquid Glass on iOS 26, and the bar shrinks on scroll. Inactive tabs are lazy and frozen, so live updates only render the visible tab. Android and apps without the peer get the package's own tab bar.

The header shows the recording state, elapsed time, event count and current screen, with two menus:

| Menu    | Actions                                                                                 |
| ------- | --------------------------------------------------------------------------------------- |
| Share ⇪ | Perfetto trace; Recording JSON (stops recording); CPU profile when one exists           |
| More ⋯  | Stop/Start recording; Start new recording; Freeze view; Tools (CPU profile, playground) |

Menus are native action sheets on iOS.

**Summary** lists issues first: retained events over a budget, failed requests, stalls, frozen frames and errors. Below them is one row per topic: Startup, Screens, Network, Responsiveness, Resources, Errors and Custom spans. A topic without a collector says **Not tracked** and names what enables it. The tab badge counts issues.

**Timeline** lists events newest first, grouped under the screen visit in which they happened.

**Explore** has Traces, Spans and Marks lists. Each has:

- search;
- sort (newest, oldest, longest, errors, count, name);
- filters, applied as a draft: outcome, source, duration and time range, and exact correlation ID.

Opening a trace shows its waterfall. Opening a span shows its attributes, parent and children, and similar spans.

**Metrics** lists every series, split into All, Runtime, Operations and Custom, and sorted by name, count or p95. Values carry units (`3.65 s`, `1.21 GB`, `42%`). A series opens a chart with latest, median, min, max and p95. Operations also lists per-span-name counts, error rates, and cancelled and interrupted spans.

Metrics cover the whole recording, not the selected trace. Statistics use retained samples: p95 is nearest-rank, charts show the newest 40, and eviction can bias them. Missing data is never shown as zero. `duration:` series come from successful and failed spans; cancelled and interrupted spans are counted separately.

**Tools** (More ⋯) starts and stops a CPU profile by hand and runs the **playground**. The playground records deterministic nested, concurrent, cancelled and failing spans, so you can check the inspector and exports without app traffic. It is not a benchmark.

### Live updates

While you scroll or read a detail, new events queue instead of moving the list. The **N new events** banner applies them. **Freeze view** holds the displayed snapshot; recording continues. Only new events cross the bridge on each poll.

If the header says **Lost 12 spans, 3 marks**, those events were evicted or rejected and the history is incomplete. Metric samples roll over by design and are not counted as lost.

## Budgets

Issues come from local thresholds. They are triage hints, not production percentiles.

```tsx
<TraceInspector client={tracing} budgets={{ requestMs: 800, stallMs: 200 }} />
```

| Budget       | Default | Issue when                                   |
| ------------ | ------- | -------------------------------------------- |
| `appReadyMs` | 2000    | `app.ready.after_tracer_init` exceeds it     |
| `screenMs`   | 1000    | a screen transition exceeds it               |
| `requestMs`  | 1000    | a request exceeds it (failures always count) |
| `stallMs`    | 250     | a JS or UI frame gap exceeds it              |

## Localization

All strings live in the package. Override some with `labels`, or route every key through your i18n with `translate`:

```tsx
import { defaultLabels } from 'react-native-nitro-tracing/react'

<TraceInspector client={tracing} labels={{ overview: 'Übersicht' }} />
<TraceInspector client={tracing} translate={(key, params) => i18n.t(`tracing.${key}`, params)} />
```

`defaultLabels` lists every key with its English text and `{{param}}` placeholders.

## Overhead

- The inspector renders only while it is visible, and only the visible tab.
- Rows are memoized and lists are virtualized (LegendList).
- Search runs on the JS thread with deferred queries.

An open inspector still costs JS time, so close it while measuring a workload. The overlay's sheet is lighter, but it also polls.

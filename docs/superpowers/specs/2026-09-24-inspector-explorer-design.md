# Inspector explorer redesign — review draft

## Goal

Find slow, failed, or related work quickly on a phone, inspect its context, and return without losing filters or position. All UI, query behavior and view models remain in the standalone package. The host app continues supplying configuration, localization, readiness and SDK destinations only.

## Chosen direction and alternatives

Recommend a mobile Explorer → Detail flow, retaining a compact recording toolbar. A dashboard-first design makes health visible but adds navigation before finding a specific span. A desktop-style table/sidebar would be dense and difficult to operate on a Pixel-sized viewport. On tablets the same explorer can use a master/detail layout later; no separate desktop UI is needed now.

## Navigation

Four top-level destinations: Overview, Explore, Metrics, Profiles. Move Playground into an overflow Tools menu.

- Overview: recording health, retention/lost-history indication, app readiness and JS health summaries; slowest operations and errors link to prefiltered Explore results.
- Explore: segmented Traces / Spans / Marks. Search, visible active filter chips, result count, sort and filter controls. Selecting a row opens a dedicated detail screen, not an expanding section beneath the list.
- Metrics: Runtime / Operations / Custom category chips, search and sort. Runtime contains JS scheduling/readiness; Operations contains span-derived latency/outcomes; Custom contains other explicit samples. A metric opens a chart and sample statistics with units, source, definition, sample count and time range.
- Profiles: current sampler status, start/stop, latest artifact and Share. CPU artifact and trace JSON remain clearly separate. No unsupported flamegraph is implied.

## Compact shell

One header with back/title/close. One status strip with recording indicator, elapsed time and retained event count. Recording actions are a compact menu: Stop recording, Export trace JSON, Start new recording. Export retains its current stop-then-share behavior and states that in its label/help. Starting a new recording explicitly identifies that it replaces retained history. UI refresh is a separate action called Pause updates; it does not stop recording or CPU profiling.

Example Explore layout:

    Performance                 ● Recording   02:14
    Overview  Explore  Metrics  Profiles
    Traces | Spans | Marks
    Search names, IDs, attributes…
    [Errors ×] [Sentry ×] [≥100 ms ×]  Reset
    18 / 246 matching             Slowest ↓  Filters
    upload.segment                   1,284 ms
    ERROR · Sentry · 12 spans · 2m ago
    GET /mediaSegments                 241 ms
    OK · Sentry · 6 spans · 2m ago

## Query semantics

Search is case-insensitive substring matching over name, correlation ID, span ID and retained attribute keys/values. No opaque query language is required initially. Filter groups combine with AND; multiple values within one group combine with OR. Apply filtering and sorting to the entire loaded recording before UI pagination. Explain when native retention has removed history. Show matching / loaded counts and a Reset action for empty results.

| Control          | Traces                                                      | Spans                                                       | Marks                  |
| ---------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| Outcome          | Has error / no recorded errors                              | Success / error / cancelled / interrupted                   | Not offered            |
| Source           | Any member matches                                          | Native/app, Performance, Sentry, profiler, runtime, unknown | Same source mapping    |
| Time range       | Overlaps selected recording-relative interval               | Overlaps interval                                           | Timestamp in interval  |
| Minimum duration | Trace wall-clock range                                      | Span duration                                               | Not offered            |
| Correlation ID   | Exact match                                                 | Exact match                                                 | Exact match            |
| Sort             | Newest / oldest / longest / most errors / most spans / name | Newest / oldest / longest / shortest / name                 | Newest / oldest / name |

Sort defaults to newest, with a stable identity/sequence tiebreaker. Source is determined from existing event attributes; missing values are shown as unknown or the explicitly known producer, never guessed from the operation name. Trace-level filters retain full trace membership for detail/context. A trace match does not prune its children.

Do not manufacture a single trace from every event with an empty correlation ID. Correlated groups appear as traces. Uncorrelated root span trees can use their explicit parent hierarchy. Remaining uncorrelated events are searchable in Spans or Marks, with a visible uncorrelated count. Metrics never become synthetic traces.

Filters persist independently for each Explore mode and survive detail navigation and modal close during the same client session. A new recording resets time range, selections and list position; text/source/outcome preferences remain, with their chips visible. Defaults contain no hidden filter. Export exports the full retained recording and says so, regardless of view filters.

## Detail views

Trace detail has a compact summary, wall-clock range, errors and event counts. Switch between Waterfall and Span list. Hierarchy branches collapse, with a descendant count; Expand all / Collapse all are available. Keep a common timeline scale. Filtered search matches are highlighted without silently dropping parents. Missing parents and evicted context are visibly identified.

Span detail shows full operation name, outcome, duration, relative start/end, source, IDs and searchable key/value attributes. Parent and children are navigable. Actions include Show entire trace and Find similar spans. Use readable attribute rows instead of a raw JSON dump; copyable JSON can remain in overflow.

Back restores the previous list scroll position, selected row and filters. If retention evicts a selected event, keep the last inspected detail with an 'outside retained history' notice until the user leaves it; do not jump to another event.

## Live updates and performance

Native capture stays bounded and unchanged. Poll only while the inspector is visible. Use virtualized lists with stable keys and bounded pages; avoid nested ScrollViews. Update visible row summaries at a controlled cadence. While inspecting a detail or using filters, queue arriving events behind a 'New events' action rather than moving the row under the user's finger. Pause updates freezes the loaded view while capture continues. Resume merges the latest retained data and reports eviction.

Queries, source classification, sorting, time intersection and hierarchy visibility live in pure view-model modules. Hooks own refresh/selection/navigation state; components render controls and rows. Keep the native API and application instrumentation unchanged. Statistics explicitly use retained samples and preserve the current distinction between JS frame callbacks and native UI frames.

## Validation

Unit-test compound filters, exact correlation, stable sorting/ties, interval boundaries, matching child → full-trace inclusion, uncorrelated grouping, cyclic/missing parent handling and collapsed descendants. Test navigation state and retention eviction without synthetic fake telemetry. Verify on Pixel 7a: search/filter/sort; open span → parent → back; collapse hierarchy; pause UI while native count advances; metrics remain recording-wide; share sheet cancellation; large retained dataset scrolling. Verify TypeScript, package/app tests, Metro bundle, accessibility roles/selected states, long names, empty states and Android safe-area layout.

## Scope and follow-up

First implementation delivers the shared shell, Explore query model and lists, trace/span details, meaningful metric categories and profile destination. It does not add new native collectors, persistence across app restarts, saved recordings, CPU flamegraphs or remote Sentry queries. Subsequent priorities are comparison of recorded runs and pinned metric budgets after the core exploration workflow works well.
